const prisma = require('../db');
const { generateDepositAddress, deleteBlockCypherForwarding } = require('./crypto.service');
const { formatTxnId } = require('../utils/formatters');
const { parsePaginationParams, buildPagination } = require('../utils/pagination');
const balanceService = require('./balance.service');
const { getCachedUsdPrice } = require('./price.service');

const TIERS = [
  { name: 'basic',     minSpent: 0,    cashback: 0.005 },
  { name: 'preferred', minSpent: 1000, cashback: 0.010 },
  { name: 'gold',      minSpent: 2000, cashback: 0.013 },
  { name: 'platinum',  minSpent: 5000, cashback: 0.015 },
];

function getTierInfo(totalSpent) {
  const spent = parseFloat(totalSpent);
  let tier = TIERS[0];
  for (const t of TIERS) if (spent >= t.minSpent) tier = t;
  const idx = TIERS.indexOf(tier);
  const next = TIERS[idx + 1] || null;
  return { ...tier, remaining: next ? Math.max(0, next.minSpent - spent) : 0 };
}

function getDaysLeft() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDay - now.getDate();
}

async function getWallet(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { points: true, totalSpent: true },
  });
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  const tierInfo = getTierInfo(user.totalSpent);
  const [{ balance, holdings, pricesComplete }, commissionPct] = await Promise.all([
    balanceService.getUserBalance(userId),
    balanceService.getCommissionPct(),
  ]);

  return {
    balance,          // USD, live: Σ holding × current price
    holdings,         // [{ currency, amount, price, usd }]
    pricesComplete,
    pricedAt:   new Date().toISOString(),
    commissionPct,    // taken on each deposit, shown before the customer tops up
    points:     user.points,
    totalSpent: parseFloat(user.totalSpent),
    tier:       tierInfo.name,
    cashback:   tierInfo.cashback,
    remaining:  tierInfo.remaining,
    daysLeft:   getDaysLeft(),
  };
}

async function createDeposit(userId, currency) {
  const ALLOWED = ['BTC', 'LTC', 'DOGE', 'ETH', 'XMR'];
  if (!ALLOWED.includes(currency)) {
    throw Object.assign(new Error('Unsupported currency.'), { status: 422 });
  }

  // Return the existing active deposit if one is still open — avoids burning a BlockCypher forward slot.
  const existing = await prisma.deposit.findFirst({
    where: {
      userId,
      currency,
      status:    { in: ['awaiting', 'partial'] },
      expiresAt: { gt: new Date() },
      address:   { not: 'pending' },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return {
      depositId: existing.id,
      address:   existing.address,
      currency:  existing.currency,
      expiresAt: existing.expiresAt,
    };
  }

  // Free expired BlockCypher forwards before requesting a new one.
  await cleanupExpiredDeposits().catch(e =>
    console.error('[createDeposit] pre-cleanup error:', e.message)
  );

  const setting = await prisma.siteSetting.findUnique({ where: { key: 'deposit_expiry_hours' } });
  const expiryHours = parseInt(setting?.value) || 12;
  const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

  const deposit = await prisma.deposit.create({
    data: { userId, currency, address: 'pending', status: 'awaiting', expiresAt },
  });

  let address, hookId, ethIndex;
  try {
    ({ address, hookId, ethIndex } = await generateDepositAddress(currency, deposit.id));
  } catch (e) {
    await prisma.deposit.delete({ where: { id: deposit.id } }).catch(() => {});
    throw e;
  }

  const updated = await prisma.deposit.update({
    where: { id: deposit.id },
    data:  { address, hookId: hookId || null, ethIndex: ethIndex || null },
  });

  return {
    depositId: updated.id,
    address:   updated.address,
    currency:  updated.currency,
    expiresAt: updated.expiresAt,
  };
}

// Credits a deposit from the crypto amount actually received. The commission is
// taken here: the customer's holding grows by the net amount only, and the
// commission stays on the deposit address for the super admin's reserve sweep.
async function confirmDepositManually(depositId, cryptoAmount, adminId, txHash = null) {
  const gross = balanceService.round8(parseFloat(cryptoAmount));
  if (!(gross > 0)) throw Object.assign(new Error('Received amount must be positive.'), { status: 422 });

  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw Object.assign(new Error('Deposit not found.'), { status: 404 });

  const allowedStatuses = adminId
    ? ['awaiting', 'partial', 'expired']  // admins can recover expired deposits
    : ['awaiting', 'partial'];
  if (!allowedStatuses.includes(deposit.status)) {
    throw Object.assign(new Error('Deposit cannot be confirmed.'), { status: 422 });
  }

  // Price is informative only (USD shown on the transaction, minimum check):
  // the credit itself is in crypto, so a missing price never blocks a deposit.
  const price = await getCachedUsdPrice(deposit.currency);
  const grossUsd = price ? balanceService.round2(gross * price) : 0;

  const minSetting = await prisma.siteSetting.findUnique({ where: { key: 'min_deposit' } });
  const minDeposit = parseFloat(minSetting?.value) || 0;
  if (minDeposit > 0 && price && grossUsd < minDeposit) {
    throw Object.assign(
      new Error(`Deposit of $${grossUsd.toFixed(2)} is below the minimum of $${minDeposit.toFixed(2)}.`),
      { status: 422 }
    );
  }

  const pct = await balanceService.getCommissionPct();
  const { commission, net } = balanceService.splitDeposit(gross, pct);
  const netUsd = price ? balanceService.round2(net * price) : 0;

  await prisma.$transaction(async tx => {
    const txn = await tx.transaction.create({
      data: {
        frontendId:   formatTxnId(Date.now()),
        userId:       deposit.userId,
        type:         'deposit',
        amount:       netUsd,
        currency:     deposit.currency,
        cryptoAmount: net,
        rate:         price || null,
        status:       'confirmed',
        note:         `Deposit #${deposit.id} — ${gross} ${deposit.currency} received, ${pct}% fee (${commission} ${deposit.currency})`,
        ...(txHash ? { txHash } : {}),
      },
    });

    await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        transactionId:    txn.id,
        status:           'confirmed',
        amountReceived:   gross,
        usdCredited:      netUsd,
        commissionPct:    pct,
        commissionAmount: commission,
        netAmount:        net,
        confirmedAt:      new Date(),
      },
    });

    await balanceService.credit(tx, deposit.userId, deposit.currency, net);
  });

  const { balance } = await balanceService.getUserBalance(deposit.userId);
  return { newBalance: balance, credited: net, commission, currency: deposit.currency };
}

async function getTransactions(userId, { type, page = 1, limit = 20 } = {}) {
  const { page: p, limit: l } = parsePaginationParams({ page, limit });
  const where = { userId, ...(type ? { type } : {}) };

  const [total, transactions] = await prisma.$transaction([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (p - 1) * l,
      take:    l,
    }),
  ]);

  return { transactions, pagination: buildPagination(p, l, total) };
}

async function getDeposits(userId, { page = 1, limit = 20 } = {}) {
  const { page: p, limit: l } = parsePaginationParams({ page, limit });
  const where = { userId };

  const [total, deposits] = await prisma.$transaction([
    prisma.deposit.count({ where }),
    prisma.deposit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:    (p - 1) * l,
      take:    l,
    }),
  ]);

  return {
    deposits: deposits.map(d => ({
      ...d,
      shortId: d.id.toString().padStart(8, '0').slice(-8),
    })),
    pagination: buildPagination(p, l, total),
  };
}

async function cleanupExpiredDeposits() {
  const now = new Date();
  const expired = await prisma.deposit.findMany({
    where: {
      status:    { in: ['awaiting', 'partial'] },
      expiresAt: { lt: now },
    },
    select: { id: true, hookId: true, currency: true },
  });

  if (expired.length === 0) return 0;

  await Promise.all(
    expired
      .filter(d => d.hookId && ['BTC', 'LTC', 'DOGE'].includes(d.currency))
      .map(d => deleteBlockCypherForwarding(d.currency, d.hookId))
  );

  await prisma.deposit.updateMany({
    where: { id: { in: expired.map(d => d.id) } },
    data:  { status: 'expired' },
  });

  return expired.length;
}

module.exports = {
  getWallet,
  createDeposit,
  confirmDepositManually,
  getTransactions,
  getDeposits,
  cleanupExpiredDeposits,
};
