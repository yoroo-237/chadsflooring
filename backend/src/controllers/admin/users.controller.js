const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { formatTxnId } = require('../../utils/formatters');
const { hashPassword } = require('../../services/auth.service');
const balanceService = require('../../services/balance.service');
const { getCachedUsdPrice } = require('../../services/price.service');

const TIERS = [
  { name: 'basic',     minSpent: 0    },
  { name: 'preferred', minSpent: 1000 },
  { name: 'gold',      minSpent: 2000 },
  { name: 'platinum',  minSpent: 5000 },
];

function getTier(totalSpent) {
  const spent = parseFloat(totalSpent);
  let tier = TIERS[0];
  for (const t of TIERS) if (spent >= t.minSpent) tier = t;
  return tier.name;
}

function tierToSpentFilter(tier) {
  switch (tier) {
    case 'basic':     return { lt: 1000 };
    case 'preferred': return { gte: 1000, lt: 2000 };
    case 'gold':      return { gte: 2000, lt: 5000 };
    case 'platinum':  return { gte: 5000 };
    default:          return null;
  }
}

async function listUsers(req, res, next) {
  try {
    const { page, limit } = parsePaginationParams(req.query);
    const { role, isActive, tier, search, sortBy = 'id', sortOrder = 'asc' } = req.query;

    const where = {};
    if (role !== undefined)     where.role     = role;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.username = { contains: search, mode: 'insensitive' };
    }
    if (tier) {
      const range = tierToSpentFilter(tier);
      if (range) where.totalSpent = range;
    }

    // Balances are live crypto valuations, so they can't be sorted in the database.
    const ALLOWED_SORT = ['id', 'totalSpent', 'points', 'createdAt', 'lastLoginAt'];
    const orderField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'id';
    const orderDir   = sortOrder === 'desc' ? 'desc' : 'asc';
    const skip       = (page - 1) * limit;

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { [orderField]: orderDir },
        skip,
        take: limit,
        select: {
          id: true, username: true, role: true,
          isActive: true, points: true, totalSpent: true,
          markupPct: true, createdAt: true, lastLoginAt: true, avatarUrl: true,
          _count: { select: { orders: true } },
        },
      }),
    ]);

    const balances = await balanceService.getBalancesForUsers(users.map(u => u.id));

    return success(res, {
      users: users.map(u => ({
        ...u,
        balance:    balances[u.id] || 0,
        totalSpent: parseFloat(u.totalSpent),
        markupPct:  parseFloat(u.markupPct),
        tier:       getTier(u.totalSpent),
      })),
      total,
      pagination: buildPagination(page, limit, total),
    });
  } catch (e) { next(e); }
}

async function getUserById(req, res, next) {
  try {
  const id = parseInt(req.params.id);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, role: true,
      isActive: true, points: true, totalSpent: true,
      markupPct: true, createdAt: true, lastLoginAt: true, avatarUrl: true,
      bio: true, telegramHandle: true, signalDetails: true, sessionDetails: true,
      btcRefundAddress: true, xmrRefundAddress: true, hidePrices: true,
      notifOrders: true, notifDeposits: true, notifTickets: true,
      notifNewProducts: true, notifLogins: true, tourCompleted: true,
    },
  });
  if (!user) return error(res, 'User not found.', 404);

  const [orders, transactions, deposits, tickets, apiKeys] = await Promise.all([
    prisma.order.findMany({
      where:   { userId: id },
      orderBy: { placedAt: 'desc' },
      take:    5,
      select: {
        id: true, frontendId: true, status: true, totalAmount: true,
        paymentMethod: true, placedAt: true,
      },
    }),
    prisma.transaction.findMany({
      where:   { userId: id },
      orderBy: { createdAt: 'desc' },
      take:    5,
    }),
    prisma.deposit.findMany({
      where:   { userId: id },
      orderBy: { createdAt: 'desc' },
      take:    5,
    }),
    prisma.supportTicket.findMany({
      where:   { userId: id },
      orderBy: { createdAt: 'desc' },
      take:    3,
      select: {
        id: true, frontendId: true, subject: true, category: true,
        status: true, priority: true, createdAt: true,
      },
    }),
    prisma.apiKey.findMany({
      where: { userId: id },
      select: {
        id: true, keyPrefix: true, label: true, lastUsed: true,
        isActive: true, createdAt: true,
      },
    }),
  ]);

  const wallet = await balanceService.getUserBalance(id);

  return success(res, {
    ...user,
    balance:    wallet.balance,
    holdings:   wallet.holdings,
    totalSpent: parseFloat(user.totalSpent),
    markupPct:  parseFloat(user.markupPct),
    tier:       getTier(user.totalSpent),
    recentOrders:       orders.map(o => ({
      id: o.id, frontendId: o.frontendId, status: o.status, paymentMethod: o.paymentMethod,
      totalAmount: parseFloat(o.totalAmount), placedAt: o.placedAt,
    })),
    recentTransactions: transactions.map(t => ({ ...t, amount: parseFloat(t.amount) })),
    recentDeposits:     deposits.map(d => ({
      ...d,
      amountExpected: d.amountExpected != null ? parseFloat(d.amountExpected) : null,
      amountReceived: parseFloat(d.amountReceived),
      usdCredited:    parseFloat(d.usdCredited),
    })),
    recentTickets:      tickets,
    apiKeys,
  });
  } catch (e) { next(e); }
}

async function updateUser(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, 'User not found.', 404);

  const { role, isActive, markupPct, username } = req.body;
  const data = {};
  if (role      !== undefined) data.role      = role;
  if (isActive  !== undefined) data.isActive  = isActive;
  if (markupPct !== undefined) data.markupPct = markupPct;
  if (username  !== undefined) data.username  = username;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, role: true, isActive: true, username: true, markupPct: true },
  });
  return success(res, {
    updated: true,
    user: { id: updated.id, role: updated.role, isActive: updated.isActive, username: updated.username, markupPct: parseFloat(updated.markupPct) },
  });
  } catch (e) {
    if (e.code === 'P2002') return error(res, 'Username already in use.', 409);
    next(e);
  }
}

async function banUser(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, 'User not found.', 404);

  const newIsActive = !user.isActive;
  await prisma.user.update({ where: { id }, data: { isActive: newIsActive } });

  return success(res, {
    isActive: newIsActive,
    message:  newIsActive ? 'User unbanned.' : 'User banned.',
  });
  } catch (e) { next(e); }
}

// Credits or debits a customer's crypto holding. The amount is given in crypto
// (`amount`) or in USD (`usdAmount`, converted at the current price).
async function adjustWallet(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const { type, reason } = req.body;
  const currency = String(req.body.currency || '').toUpperCase();

  if (!['credit', 'debit'].includes(type)) {
    return error(res, 'type must be "credit" or "debit".', 400);
  }
  if (!balanceService.CURRENCIES.includes(currency)) {
    return error(res, `currency must be one of ${balanceService.CURRENCIES.join(', ')}.`, 400);
  }
  if (!reason?.trim()) {
    return error(res, 'reason is required.', 400);
  }

  const price = await getCachedUsdPrice(currency);
  let amt = parseFloat(req.body.amount);
  if (!(amt > 0) && parseFloat(req.body.usdAmount) > 0) {
    if (!price) return error(res, `${currency} price unavailable — enter the amount in ${currency}.`, 503);
    amt = parseFloat(req.body.usdAmount) / price;
  }
  amt = balanceService.round8(amt);
  if (!(amt > 0)) {
    return error(res, 'amount must be a positive number.', 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, 'User not found.', 404);

  const usd = price ? balanceService.round2(amt * price) : 0;

  const txn = await prisma.$transaction(async tx => {
    if (type === 'credit') await balanceService.credit(tx, id, currency, amt);
    else await balanceService.debit(tx, id, currency, amt);

    return tx.transaction.create({
      data: {
        frontendId:   formatTxnId(Date.now()),
        userId:       id,
        type:         'adjustment',
        amount:       type === 'credit' ? usd : -usd,
        currency,
        cryptoAmount: type === 'credit' ? amt : -amt,
        rate:         price || null,
        status:       'confirmed',
        note:         reason.trim(),
      },
    });
  });

  const wallet = await balanceService.getUserBalance(id);
  return success(res, { newBalance: wallet.balance, holdings: wallet.holdings, transaction: txn });
  } catch (e) { next(e); }
}

async function createUser(req, res, next) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const role     = req.body.role || 'customer';

    if (!username)        return error(res, 'username is required.', 400);
    if (password.length < 6) return error(res, 'password must be at least 6 characters.', 400);

    const VALID_ROLES = ['customer', 'admin', 'moderator'];
    if (!VALID_ROLES.includes(role)) return error(res, `role must be one of: ${VALID_ROLES.join(', ')}.`, 400);

    const existing = await prisma.user.findFirst({
      where:  { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return error(res, 'Username already in use.', 409);

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data:   { username, passwordHash, role },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    return success(res, { user }, 201);
  } catch (e) {
    if (e.code === 'P2002') return error(res, 'Username already in use.', 409);
    next(e);
  }
}

async function resetPassword(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const password = String(req.body.password || '');
    if (password.length < 6) return error(res, 'Password must be at least 6 characters.', 400);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return error(res, 'User not found.', 404);

    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id }, data: { passwordHash } });

    return success(res, { reset: true });
  } catch (e) { next(e); }
}

module.exports = { listUsers, getUserById, updateUser, banUser, adjustWallet, createUser, resetPassword };
