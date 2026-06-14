const prisma = require('../../db');
const { success } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');

async function listTransactions(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const { search, type, status, currency, dateFrom, dateTo } = req.query;

  const where = {};
  if (type)     where.type     = type;
  if (status)   where.status   = status;
  if (currency) where.currency = currency;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo)   where.createdAt.lte = new Date(dateTo);
  }
  if (search) {
    where.user = { username: { contains: search, mode: 'insensitive' } };
  }

  const skip = (page - 1) * limit;

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, username: true } } },
    }),
  ]);

  return success(res, {
    transactions: transactions.map(t => ({ ...t, amount: parseFloat(t.amount) })),
    total,
    pagination: buildPagination(page, limit, total),
  });
}

module.exports = { listTransactions };
