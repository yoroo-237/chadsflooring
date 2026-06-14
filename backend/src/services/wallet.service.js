const prisma = require('../db');
const { generateDepositAddress } = require('./crypto.service');
const { formatTxnId } = require('../utils/formatters');
const { parsePaginationParams, buildPagination } = require('../utils/pagination');

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
    select: { balance: true, points: true, totalSpent: true },
  });
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  const tierInfo = getTierInfo(user.totalSpent);

  return {
    balance:    parseFloat(user.balance),
    points:     user.points,
    totalSpent: parseFloat(user.totalSpent),
    tier:       tierInfo.name,
    cashback:   tierInfo.cashback,
    remaining:  tierInfo.remaining,
    daysLeft:   getDaysLeft(),
  };
}

async function createDeposit(userId, currency) {
  const ALLOWED = ['BTC', 'DOGE', 'LTC', 'XMR'];
  if (!ALLOWED.includes(currency)) {
    throw Object.assign(new Error('Unsupported currency.'), { status: 422 });
  }

  const setting = await prisma.siteSetting.findUnique({ where: { key: 'deposit_expiry_hours' } });
  const expiryHours = parseInt(setting?.value) || 12;
  const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

  // Create deposit first to get the DB id (needed for address derivation)
  const deposit = await prisma.deposit.create({
    data: { userId, currency, address: '', status: 'awaiting', expiresAt },
  });

  const address = await generateDepositAddress(currency, userId, deposit.id);

  const updated = await prisma.deposit.update({
    where: { id: deposit.id },
    data:  { address },
  });

  return {
    depositId: updated.id,
    address:   updated.address,
    currency:  updated.currency,
    expiresAt: updated.expiresAt,
  };
}

async function confirmDepositManually(depositId, usdAmount, adminId) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw Object.assign(new Error('Deposit not found.'), { status: 404 });
  if (!['awaiting', 'partial'].includes(deposit.status)) {
    throw Object.assign(new Error('Deposit cannot be confirmed.'), { status: 422 });
  }

  return prisma.$transaction(async tx => {
    const txn = await tx.transaction.create({
      data: {
        frontendId: formatTxnId(Date.now()),
        userId:     deposit.userId,
        type:       'deposit',
        amount:     usdAmount,
        currency:   deposit.currency,
        status:     'confirmed',
        note:       `Deposit #${deposit.id}`,
      },
    });

    await tx.deposit.update({
      where: { id: deposit.id },
      data: {
        transactionId: txn.id,
        status:        'confirmed',
        usdCredited:   usdAmount,
        confirmedAt:   new Date(),
      },
    });

    await tx.user.update({
      where: { id: deposit.userId },
      data:  { balance: { increment: usdAmount } },
    });

    const updatedUser = await tx.user.findUnique({
      where:  { id: deposit.userId },
      select: { balance: true },
    });
    return { newBalance: parseFloat(updatedUser.balance) };
  });
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

module.exports = {
  getWallet,
  createDeposit,
  confirmDepositManually,
  getTransactions,
  getDeposits,
};
