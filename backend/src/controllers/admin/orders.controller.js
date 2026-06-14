const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { cancelOrder } = require('../../services/order.service');

async function listOrders(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const {
    status, paymentMethod, search,
    dateFrom, dateTo,
    sortBy = 'placedAt', sortOrder = 'desc',
  } = req.query;

  const and = [];
  if (status)        and.push({ status });
  if (paymentMethod) and.push({ paymentMethod });
  if (dateFrom)      and.push({ placedAt: { gte: new Date(dateFrom) } });
  if (dateTo)        and.push({ placedAt: { lte: new Date(dateTo) } });
  if (search) {
    and.push({
      OR: [
        { frontendId: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const where = and.length ? { AND: and } : {};
  const ALLOWED_SORT = ['placedAt', 'totalAmount', 'status', 'id'];
  const orderField = ALLOWED_SORT.includes(sortBy) ? sortBy : 'placedAt';
  const orderDir   = sortOrder === 'asc' ? 'asc' : 'desc';
  const skip       = (page - 1) * limit;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { [orderField]: orderDir },
      skip,
      take:    limit,
      include: {
        user:   { select: { id: true, username: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  return success(res, {
    orders: orders.map(o => ({
      ...o,
      totalAmount:  parseFloat(o.totalAmount),
      subtotal:     parseFloat(o.subtotal),
      shippingCost: parseFloat(o.shippingCost),
    })),
    pagination: buildPagination(page, limit, total),
  });
}

async function updateOrderStatus(req, res) {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  const ALLOWED = ['processing', 'shipped', 'delivered', 'cancelled'];
  if (!ALLOWED.includes(status)) {
    return error(res, 'Invalid status. Must be processing, shipped, delivered, or cancelled.', 400);
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(res, 'Order not found.', 404);

  if (status === 'cancelled') {
    const result = await cancelOrder(id, null, true);
    return success(res, result);
  }

  const updated = await prisma.order.update({ where: { id }, data: { status } });
  return success(res, { status: updated.status });
}

async function updateOrderTracking(req, res) {
  const id = parseInt(req.params.id);
  const { trackingNumber } = req.body;

  if (!trackingNumber?.trim()) {
    return error(res, 'trackingNumber is required.', 400);
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(res, 'Order not found.', 404);

  const updated = await prisma.order.update({
    where: { id },
    data:  { trackingNumber: trackingNumber.trim() },
  });
  return success(res, { trackingNumber: updated.trackingNumber });
}

module.exports = { listOrders, updateOrderStatus, updateOrderTracking };
