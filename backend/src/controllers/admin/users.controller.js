const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { formatTxnId } = require('../../utils/formatters');
const { hashPassword } = require('../../services/auth.service');

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

    const ALLOWED_SORT = ['id', 'balance', 'totalSpent', 'points', 'createdAt', 'lastLoginAt'];
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
          isActive: true, balance: true, points: true, totalSpent: true,
          markupPct: true, createdAt: true, lastLoginAt: true, avatarUrl: true,
          _count: { select: { orders: true } },
        },
      }),
    ]);

    return success(res, {
      users: users.map(u => ({
        ...u,
        balance:    parseFloat(u.balance),
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
      isActive: true, balance: true, points: true, totalSpent: true,
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

  return success(res, {
    ...user,
    balance:    parseFloat(user.balance),
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

async function adjustWallet(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const { type, amount, reason } = req.body;

  if (!['credit', 'debit'].includes(type)) {
    return error(res, 'type must be "credit" or "debit".', 400);
  }
  if (!reason?.trim()) {
    return error(res, 'reason is required.', 400);
  }
  const amt = parseFloat(amount);
  if (!amt || amt <= 0) {
    return error(res, 'amount must be a positive number.', 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return error(res, 'User not found.', 404);

  if (type === 'debit' && parseFloat(user.balance) < amt) {
    return res.status(422).json({ success: false, error: 'Insufficient balance.' });
  }

  const result = await prisma.$transaction(async tx => {
    const updated = await tx.user.update({
      where: { id },
      data:  { balance: type === 'credit' ? { increment: amt } : { decrement: amt } },
      select: { balance: true },
    });

    const txn = await tx.transaction.create({
      data: {
        frontendId: formatTxnId(Date.now()),
        userId:     id,
        type:       'adjustment',
        amount:     type === 'credit' ? amt : -amt,
        currency:   'USD',
        status:     'confirmed',
        note:       reason.trim(),
      },
    });

    return { newBalance: parseFloat(updated.balance), transaction: txn };
  });

  return success(res, result);
  } catch (e) { next(e); }
}

async function createUser(req, res, next) {
  try {
  const { username, password, role = 'customer' } = req.body;
  if (!username?.trim()) return error(res, 'username is required.', 400);
  if (!password || password.length < 6) return error(res, 'password must be at least 6 characters.', 400);
  const VALID_ROLES = ['customer', 'admin', 'moderator'];
  if (!VALID_ROLES.includes(role)) return error(res, `role must be one of: ${VALID_ROLES.join(', ')}.`, 400);

  const existing = await prisma.user.findFirst({ where: { username: { equals: username.trim(), mode: 'insensitive' } } });
  if (existing) return error(res, 'Username already in use.', 409);

  const passwordHash = await hashPassword(password);
  try {
    const user = await prisma.user.create({
      data:   { username: username.trim(), passwordHash, role },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    return success(res, { user }, 201);
  } catch (e) {
    if (e.code === 'P2002') {
      return error(res, 'Username already in use.', 409);
    }
    throw e;
  }
  } catch (e) { next(e); }
}

module.exports = { listUsers, getUserById, updateUser, banUser, adjustWallet, createUser };
