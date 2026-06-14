const prisma = require('../../db');
const { success } = require('../../utils/apiResponse');

const PERIOD_MAP = {
  '7d':  7,
  '30d': 30,
  '90d': 90,
  '1y':  365,
};

async function getAnalytics(req, res) {
  const days      = PERIOD_MAP[req.query.period] || 30;
  const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);

  const [
    revenueByPeriod,
    ordersByStatusRows,
    revenueByPaymentRows,
    topProductsByRevenue,
    topProductsByQuantity,
    topCategories,
    newUsersByPeriod,
    depositsByCurrencyRows,
    walletFlow,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        TO_CHAR(gs::date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(o."totalAmount"), 0)::float AS revenue
      FROM generate_series(${startDate}::timestamptz, NOW(), INTERVAL '1 day') AS gs
      LEFT JOIN "Order" o ON DATE(o."placedAt") = gs::date AND o.status != 'cancelled'
      GROUP BY gs::date
      ORDER BY gs::date
    `,
    prisma.$queryRaw`
      SELECT status, COUNT(*)::int AS count
      FROM "Order"
      WHERE "placedAt" >= ${startDate}
      GROUP BY status
    `,
    prisma.$queryRaw`
      SELECT "paymentMethod", COALESCE(SUM("totalAmount"), 0)::float AS revenue
      FROM "Order"
      WHERE status != 'cancelled' AND "placedAt" >= ${startDate}
      GROUP BY "paymentMethod"
    `,
    prisma.$queryRaw`
      SELECT
        p.id, p.name, p."imageUrl",
        COALESCE(SUM(oi."lineTotal"), 0)::float AS "totalRevenue"
      FROM "OrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."placedAt" >= ${startDate} AND o.status != 'cancelled'
      GROUP BY p.id, p.name, p."imageUrl"
      ORDER BY "totalRevenue" DESC
      LIMIT 10
    `,
    prisma.$queryRaw`
      SELECT
        p.id, p.name, p."imageUrl",
        SUM(oi.quantity)::int AS "totalQuantity"
      FROM "OrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."placedAt" >= ${startDate} AND o.status != 'cancelled'
      GROUP BY p.id, p.name, p."imageUrl"
      ORDER BY "totalQuantity" DESC
      LIMIT 10
    `,
    prisma.$queryRaw`
      SELECT
        c.id, c.label, c.slug,
        COALESCE(SUM(oi."lineTotal"), 0)::float AS revenue
      FROM "OrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      JOIN "Category" c ON c.id = p."categoryId"
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."placedAt" >= ${startDate} AND o.status != 'cancelled'
      GROUP BY c.id, c.label, c.slug
      ORDER BY revenue DESC
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(gs::date, 'YYYY-MM-DD') AS date,
        COUNT(u.id)::int AS count
      FROM generate_series(${startDate}::timestamptz, NOW(), INTERVAL '1 day') AS gs
      LEFT JOIN "User" u ON DATE(u."createdAt") = gs::date
      GROUP BY gs::date
      ORDER BY gs::date
    `,
    prisma.$queryRaw`
      SELECT currency, COALESCE(SUM("usdCredited"), 0)::float AS amount
      FROM "Deposit"
      WHERE status = 'confirmed' AND "createdAt" >= ${startDate}
      GROUP BY currency
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(gs::date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount ELSE 0 END), 0)::float AS deposits,
        COALESCE(SUM(CASE WHEN t.type = 'purchase' THEN ABS(t.amount) ELSE 0 END), 0)::float AS purchases
      FROM generate_series(${startDate}::timestamptz, NOW(), INTERVAL '1 day') AS gs
      LEFT JOIN "Transaction" t ON DATE(t."createdAt") = gs::date AND t.status = 'confirmed'
      GROUP BY gs::date
      ORDER BY gs::date
    `,
  ]);

  const ordersByStatus = { processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const row of ordersByStatusRows) {
    if (row.status in ordersByStatus) ordersByStatus[row.status] = row.count;
  }

  const revenueByPayment = { XMR: 0, BTC: 0, ETH: 0 };
  for (const row of revenueByPaymentRows) {
    if (row.paymentMethod in revenueByPayment) revenueByPayment[row.paymentMethod] = row.revenue;
  }

  const depositsByCurrency = { BTC: 0, DOGE: 0, LTC: 0, XMR: 0 };
  for (const row of depositsByCurrencyRows) {
    if (row.currency in depositsByCurrency) depositsByCurrency[row.currency] = row.amount;
  }

  return success(res, {
    revenueByPeriod,
    ordersByStatus,
    revenueByPayment,
    topProductsByRevenue,
    topProductsByQuantity,
    topCategories,
    newUsersByPeriod,
    depositsByCurrency,
    walletFlow,
  });
}

module.exports = { getAnalytics };
