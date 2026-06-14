const prisma = require('../../db');
const { success } = require('../../utils/apiResponse');

const PERIOD_MAP = {
  '7d':  7,
  '30d': 30,
  '90d': 90,
  '1y':  365,
};

async function getAnalytics(req, res, next) {
  try {
    const days      = PERIOD_MAP[req.query.period] || 30;
    const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);

    const [
      revenueRows,
      ordersByStatusRows,
      revenueByPaymentRows,
      topProductsRows,
      topCategoriesRows,
      newUsersRows,
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
          COALESCE(SUM(oi."lineTotal"), 0)::float AS "totalRevenue",
          COALESCE(SUM(oi.quantity), 0)::int AS "totalSold"
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
          c.id, c.label,
          COALESCE(SUM(oi."lineTotal"), 0)::float AS revenue
        FROM "OrderItem" oi
        JOIN "Product" p ON p.id = oi."productId"
        JOIN "Category" c ON c.id = p."categoryId"
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."placedAt" >= ${startDate} AND o.status != 'cancelled'
        GROUP BY c.id, c.label
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
          COALESCE(SUM(CASE WHEN t.type = 'deposit'   THEN t.amount ELSE 0 END), 0)::float AS deposits,
          COALESCE(SUM(CASE WHEN t.type = 'purchase'  THEN ABS(t.amount) ELSE 0 END), 0)::float AS purchases
        FROM generate_series(${startDate}::timestamptz, NOW(), INTERVAL '1 day') AS gs
        LEFT JOIN "Transaction" t ON DATE(t."createdAt") = gs::date AND t.status = 'confirmed'
        GROUP BY gs::date
        ORDER BY gs::date
      `,
    ]);

    // Orders by status → plain object
    const ordersStatusChart = { processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const row of ordersByStatusRows) {
      if (row.status in ordersStatusChart) ordersStatusChart[row.status] = Number(row.count);
    }

    // Revenue by payment method → array (frontend expects [{method, revenue}])
    const revenueByMethod = revenueByPaymentRows.map(r => ({
      method:  r.paymentMethod,
      revenue: Number(r.revenue),
    }));

    // Top products → normalized shape
    const topProducts = topProductsRows.map(p => ({
      id:       Number(p.id),
      name:     p.name,
      imageUrl: p.imageUrl,
      revenue:  Number(p.totalRevenue),
      sold:     Number(p.totalSold),
    }));

    // Top categories → rename label → name
    const topCategories = topCategoriesRows.map(c => ({
      id:      Number(c.id),
      name:    c.label,
      revenue: Number(c.revenue),
    }));

    // Deposits by currency → array (frontend calls .map() on it!)
    const depositsByCurrency = depositsByCurrencyRows.map(r => ({
      currency: r.currency,
      value:    Number(r.amount),
    }));

    // Summary stats
    const revenueChart  = revenueRows.map(r => ({ date: r.date, revenue: Number(r.revenue) }));
    const newUsersChart = newUsersRows.map(r => ({ date: r.date, count: Number(r.count) }));
    const totalRevenue  = revenueChart.reduce((s, r) => s + r.revenue, 0);
    const totalOrders   = Object.values(ordersStatusChart).reduce((s, n) => s + n, 0);
    const totalNewUsers = newUsersChart.reduce((s, r) => s + r.count, 0);
    const totalDeposits = depositsByCurrency.reduce((s, d) => s + d.value, 0);

    return success(res, {
      summary: {
        revenue:       totalRevenue,
        orders:        totalOrders,
        newUsers:      totalNewUsers,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        totalDeposits,
      },
      revenueChart,
      ordersStatusChart,
      revenueByMethod,
      topProducts,
      topCategories,
      newUsersChart,
      depositsByCurrency,
      walletFlow: walletFlow.map(r => ({ date: r.date, deposits: Number(r.deposits), purchases: Number(r.purchases) })),
    });
  } catch (e) { next(e); }
}

module.exports = { getAnalytics };
