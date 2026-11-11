const prisma = require('../db');
const { generateDepositAddress, deleteBlockCypherForwarding, incomingPayments } = require('./crypto.service');
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

const depositView = d => ({
  id:             d.id,
  depositId:      d.id,
  address:        d.address,
  currency:       d.currency,
  status:         d.status,
  expiresAt:      d.expiresAt,
  amountExpected: d.amountExpected,
  orderId:        d.orderId,
});

// `orderId` / `minutes` / `expected`: an order's own deposit (its payment window, the
// gross amount asked for); without them, a wallet top-up.
async function createDeposit(userId, currency, { orderId = null, minutes = null, expected = null } = {}) {
  const ALLOWED = ['BTC', 'LTC', 'DOGE', 'ETH', 'XMR'];
  if (!ALLOWED.includes(currency)) {
    throw Object.assign(new Error('Unsupported currency.'), { status: 422 });
  }

  // A top-up reuses the open top-up of the same coin — avoids burning a BlockCypher hook slot.
  // An order always gets its own address: its payments are counted against that order.
  if (!orderId) {
    const existing = await prisma.deposit.findFirst({
      where: {
        userId,
        currency,
        orderId:   null,
        status:    { in: ['awaiting', 'partial'] },
        expiresAt: { gt: new Date() },
        address:   { not: 'pending' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return depositView(existing);
  }

  // Free expired BlockCypher forwards before requesting a new one.
  await cleanupExpiredDeposits().catch(e =>
    console.error('[createDeposit] pre-cleanup error:', e.message)
  );

  const setting = await prisma.siteSetting.findUnique({ where: { key: 'deposit_expiry_hours' } });
  const expiryHours = parseInt(setting?.value) || 12;
  const expiresAt = new Date(Date.now() + (minutes ? minutes * 60 * 1000 : expiryHours * 3600 * 1000));

  const deposit = await prisma.deposit.create({
    data: { userId, currency, address: 'pending', status: 'awaiting', expiresAt, orderId, amountExpected: expected },
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

  return depositView(updated);
}

// Credits one payment received on a deposit address (the crypto amount actually received).
// The commission is taken here: the customer's holding grows by the net amount only, and
// the commission stays on the address for the super admin's reserve sweep.
//  - a top-up's first payment confirms it;
//  - any later payment (the customer sent to the same address again), and every payment
//    of an order's deposit, is credited on its own by receivePayment.
// `txHash`: the transaction it comes from, counted once whatever reports it (webhook,
// the customer's check, a sweep's check). An admin entry has no hash.
async function confirmDepositManually(depositId, cryptoAmount, adminId, txHash = null) {
  const gross = balanceService.round8(parseFloat(cryptoAmount));
  if (!(gross > 0)) throw Object.assign(new Error('Received amount must be positive.'), { status: 422 });

  const deposit = await prisma.deposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw Object.assign(new Error('Deposit not found.'), { status: 404 });
  const seen = Array.isArray(deposit.txSeen) ? deposit.txSeen : [];
  if (txHash && seen.includes(txHash)) return { duplicate: true };

  const firstTopUp = !deposit.orderId && Number(deposit.amountReceived) === 0
    && (['awaiting', 'partial'].includes(deposit.status) || ((adminId || txHash) && deposit.status === 'expired'));
  if (!firstTopUp) {
    // A confirmed top-up only takes payments seen on the blockchain (with their hash):
    // an amount typed by hand on it could credit a payment twice
    if (!deposit.orderId && !txHash) throw Object.assign(new Error('Deposit cannot be confirmed.'), { status: 422 });
    return receivePayment(deposit, gross, { txHash, adminId });
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

  const done = await prisma.$transaction(async tx => {
    // Claimed atomically: the webhook and the customer's check may confirm it at the same time
    const { count } = await tx.deposit.updateMany({
      where: { id: deposit.id, status: deposit.status, amountReceived: 0 },
      data: {
        status:           'confirmed',
        amountReceived:   gross,
        usdCredited:      netUsd,
        commissionPct:    pct,
        commissionAmount: commission,
        netAmount:        net,
        confirmedAt:      new Date(),
        ...(txHash ? { txSeen: [...seen, txHash] } : {}),
      },
    });
    if (!count) return false;
    const txn = await tx.transaction.create({
      data: {
        frontendId:   formatTxnId(`${Date.now()}-d${deposit.id}`),
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
    await tx.deposit.update({ where: { id: deposit.id }, data: { transactionId: txn.id } });
    await balanceService.credit(tx, deposit.userId, deposit.currency, net);
    return true;
  });
  if (!done) {
    // Someone else confirmed it meanwhile: this payment may still be a new one
    if (txHash) return confirmDepositManually(depositId, gross, adminId, txHash);
    throw Object.assign(new Error('Deposit cannot be confirmed.'), { status: 422 });
  }

  const { balance } = await balanceService.getUserBalance(deposit.userId);
  return { newBalance: balance, credited: net, commission, currency: deposit.currency };
}

// One more payment on a deposit: an order's (its payments add up) or a top-up the customer
// paid again. Credited to the customer's holding net of the commission; an order is then
// settled, or refunded if it is already closed. If the address was already swept, the
// sweeps are reopened for the new share only (what they took is kept in *SweptAmount).
async function receivePayment(deposit, gross, { txHash = null, adminId = null } = {}) {
  const seen = Array.isArray(deposit.txSeen) ? deposit.txSeen : [];
  if (txHash && seen.includes(txHash)) return { duplicate: true };
  const delta = balanceService.round8(gross);
  if (!(delta > 0)) return { nothingNew: true };
  // Expired: only a payment proven on the blockchain (its hash) or entered by an admin
  if (deposit.status === 'expired' && !adminId && !txHash) throw Object.assign(new Error('Deposit cannot be confirmed.'), { status: 422 });

  const price = await getCachedUsdPrice(deposit.currency);
  const pct   = await balanceService.getCommissionPct();
  const { commission, net } = balanceService.splitDeposit(delta, pct);
  const netUsd = price ? balanceService.round2(net * price) : 0;

  const credited = await prisma.$transaction(async tx => {
    // Guarded by the amount read above: two reports of the same payment credit it once
    const { count } = await tx.deposit.updateMany({
      where: { id: deposit.id, amountReceived: deposit.amountReceived },
      data: {
        amountReceived:   { increment: delta },
        commissionAmount: { increment: commission },
        netAmount:        { increment: net },
        usdCredited:      { increment: netUsd },
        commissionPct:    pct,
        ...(['awaiting', 'expired'].includes(deposit.status) ? { status: deposit.orderId ? 'partial' : 'confirmed' } : {}),
        ...(txHash ? { txSeen: [...seen, txHash] } : {}),
        // Swept before: everything that was there is gone, the new shares are to sweep
        ...(deposit.shopSweptAt ? { shopSweptAt: null, shopSweptAmount: deposit.netAmount } : {}),
        ...(deposit.reserveSweptAt ? { reserveSweptAt: null, reserveSweptAmount: deposit.commissionAmount } : {}),
      },
    });
    if (count === 0) return null;
    const txn = await tx.transaction.create({
      data: {
        frontendId:   formatTxnId(`${Date.now()}-d${deposit.id}-${seen.length}`),
        userId:       deposit.userId,
        orderId:      deposit.orderId,
        type:         'deposit',
        amount:       netUsd,
        currency:     deposit.currency,
        cryptoAmount: net,
        rate:         price || null,
        status:       'confirmed',
        note:         `${deposit.orderId ? 'Order payment' : 'Another payment'}, deposit #${deposit.id}: ${delta} ${deposit.currency} received, ${pct}% fee (${commission} ${deposit.currency})`,
        ...(txHash ? { txHash } : {}),
      },
    });
    if (!deposit.transactionId) await tx.deposit.update({ where: { id: deposit.id }, data: { transactionId: txn.id } });
    await balanceService.credit(tx, deposit.userId, deposit.currency, net);
    return { net };
  });
  if (!credited) {
    // The deposit changed meanwhile (another payment credited): try again on fresh data
    const fresh = await prisma.deposit.findUnique({ where: { id: deposit.id } });
    if (txHash && fresh && !(fresh.txSeen || []).includes(txHash)) return receivePayment(fresh, gross, { txHash, adminId });
    return { duplicate: true };
  }

  if (deposit.orderId) {
    const fresh = await prisma.deposit.findUnique({ where: { id: deposit.id } });
    const orderService = require('./order.service');
    await orderService.settlePendingOrder(deposit.orderId, {
      currency: deposit.currency, net: parseFloat(fresh.netAmount), deltaNet: credited.net, depositId: deposit.id,
    });
  } else {
    await prisma.notification.create({
      data: { userId: deposit.userId, type: 'wallet', title: 'Payment received', body: `${credited.net} ${deposit.currency} added to your balance (deposit #${deposit.id}).`, link: '/wallet' },
    }).catch(() => {});
  }
  return { credited: credited.net, currency: deposit.currency };
}

// Looks at the blockchain for every payment made to a deposit address and credits the ones
// not counted yet. Deposits credited before payments were tracked by transaction have an
// empty txSeen: their oldest payments, up to the amount already credited, are marked as
// counted (not credited again). XMR is checked by hand.
async function syncDeposit(depositOrId) {
  let dep = typeof depositOrId === 'object' ? depositOrId : await prisma.deposit.findUnique({ where: { id: depositOrId } });
  if (!dep || dep.currency === 'XMR' || !dep.address || dep.address === 'pending') return { credited: 0, pending: false };

  const { payments, pending } = await incomingPayments(dep);
  let seen = Array.isArray(dep.txSeen) ? dep.txSeen : [];
  if (!seen.length && Number(dep.amountReceived) > 0) {
    let acc = 0;
    const baseline = [];
    for (const p of payments) {
      if (acc + p.amount > Number(dep.amountReceived) + 1e-8) break;
      acc += p.amount;
      baseline.push(p.hash);
    }
    if (baseline.length) {
      await prisma.deposit.updateMany({ where: { id: dep.id, amountReceived: dep.amountReceived }, data: { txSeen: baseline } });
      seen = baseline;
    }
  }

  let credited = 0;
  for (const p of payments) {
    if (seen.includes(p.hash)) continue;
    try {
      const r = await confirmDepositManually(dep.id, p.amount, null, p.hash);
      if (r && !r.duplicate && !r.nothingNew) credited++;
    } catch (e) {
      console.warn(`[Deposits] payment ${p.hash} on deposit #${dep.id} not credited:`, e.message);
    }
    dep = await prisma.deposit.findUnique({ where: { id: dep.id } });
    seen = Array.isArray(dep.txSeen) ? dep.txSeen : [];
  }
  return { credited, pending };
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
  const lapsed = await prisma.deposit.findMany({
    where: {
      status:    { in: ['awaiting', 'partial'] },
      expiresAt: { lt: now },
    },
    select: { id: true, hookId: true, currency: true, orderId: true },
  });

  // An order still awaiting payment is about to be cancelled, which keeps its deposit
  // watched 24 hours more: expired now, a late payment would never be seen nor refunded.
  const orderIds = lapsed.map(d => d.orderId).filter(Boolean);
  const open = orderIds.length
    ? await prisma.order.findMany({ where: { id: { in: orderIds }, status: 'awaiting_payment' }, select: { id: true } })
    : [];
  const openIds = new Set(open.map(o => o.id));
  const expired = lapsed.filter(d => !openIds.has(d.orderId));

  // A paid address keeps its BlockCypher hook 7 days, to see a payment sent to it again;
  // after that the hook is released (the customer's Check, or a sweep, still finds such a payment).
  const stale = await prisma.deposit.findMany({
    where: { status: 'confirmed', hookId: { not: null }, confirmedAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    select: { id: true, hookId: true, currency: true },
  });
  if (stale.length) {
    await Promise.allSettled(stale.map(d => deleteBlockCypherForwarding(d.currency, d.hookId)));
    await prisma.deposit.updateMany({ where: { id: { in: stale.map(d => d.id) } }, data: { hookId: null } });
  }

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
  receivePayment,
  syncDeposit,
  getTransactions,
  getDeposits,
  cleanupExpiredDeposits,
};
