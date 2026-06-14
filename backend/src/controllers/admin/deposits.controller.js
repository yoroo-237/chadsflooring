const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { confirmDepositManually } = require('../../services/wallet.service');

async function listDeposits(req, res, next) {
  try {
    const { page, limit } = parsePaginationParams(req.query);
    const { status, currency } = req.query;

    const where = {};
    if (status)   where.status   = status;
    if (currency) where.currency = currency;

    const skip = (page - 1) * limit;

    const [total, deposits] = await Promise.all([
      prisma.deposit.count({ where }),
      prisma.deposit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true } } },
      }),
    ]);

    return success(res, { deposits, total, pagination: buildPagination(page, limit, total) });
  } catch (e) { next(e); }
}

async function confirmDeposit(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { usdAmount } = req.body;

    const amt = parseFloat(usdAmount);
    if (!amt || amt <= 0) {
      return error(res, 'usdAmount must be a positive number.', 400);
    }

    const result = await confirmDepositManually(id, amt, req.user.id);
    return success(res, result);
  } catch (e) { next(e); }
}

async function expireDeposit(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit) return error(res, 'Deposit not found.', 404);

    await prisma.deposit.update({ where: { id }, data: { status: 'expired' } });
    return success(res, { expired: true });
  } catch (e) { next(e); }
}

module.exports = { listDeposits, confirmDeposit, expireDeposit };
