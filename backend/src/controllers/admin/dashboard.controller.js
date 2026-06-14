const prisma = require('../../db');
const { success } = require('../../utils/apiResponse');

async function getDashboard(req, res, next) {
  try {
  const [
    revenueRows,
    ordersRows,
    usersRows,
    productsRows,
    ticketsRows,
    topProducts,
    recentOrders,
    lowStockProducts,
    recentUnassignedTickets,
    revenueChart,
    ordersStatusRows,
    newUsersChart,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN DATE("placedAt") = CURRENT_DATE AND status != 'cancelled' THEN "totalAmount" ELSE 0 END), 0)::float AS today,
        COALESCE(SUM(CASE WHEN "placedAt" >= NOW() - INTERVAL '7 days' AND status != 'cancelled' THEN "totalAmount" ELSE 0 END), 0)::float AS "thisWeek",
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', "placedAt") = DATE_TRUNC('month', NOW()) AND status != 'cancelled' THEN "totalAmount" ELSE 0 END), 0)::float AS "thisMonth",
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN "totalAmount" ELSE 0 END), 0)::float AS total
      FROM "Order"
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE DATE("placedAt") = CURRENT_DATE)::int AS today,
        COUNT(*) FILTER (WHERE status = 'processing')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'shipped')::int AS shipped,
        COUNT(*)::int AS total
      FROM "Order"
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE DATE("createdAt") = CURRENT_DATE)::int AS "newToday",
        COUNT(*) FILTER (WHERE "lastLoginAt" >= NOW() - INTERVAL '30 days')::int AS active
      FROM "User"
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE "isActive" = true)::int AS total,
        COUNT(*) FILTER (WHERE stock > 0 AND stock <= 10 AND "isActive" = true)::int AS "lowStock",
        COUNT(*) FILTER (WHERE stock = 0 AND "isActive" = true)::int AS "outOfStock"
      FROM "Product"
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')::int AS open,
        COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('resolved','closed'))::int AS urgent
      FROM "SupportTicket"
    `,
    prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p."imageUrl",
        SUM(oi.quantity)::int AS "totalSold",
        COALESCE(SUM(oi."lineTotal"), 0)::float AS "totalRevenue"
      FROM "OrderItem" oi
      JOIN "Product" p ON p.id = oi."productId"
      GROUP BY p.id, p.name, p."imageUrl"
      ORDER BY "totalRevenue" DESC
      LIMIT 5
    `,
    prisma.$queryRaw`
      SELECT
        o.id,
        o."frontendId",
        u.username,
        o."totalAmount"::float AS "totalAmount",
        o.status,
        o."placedAt"
      FROM "Order" o
      JOIN "User" u ON u.id = o."userId"
      ORDER BY o."placedAt" DESC
      LIMIT 10
    `,
    prisma.$queryRaw`
      SELECT id, name, stock, "imageUrl"
      FROM "Product"
      WHERE stock > 0 AND stock <= 10 AND "isActive" = true
      ORDER BY stock ASC
      LIMIT 5
    `,
    prisma.$queryRaw`
      SELECT id, "frontendId", subject, category, priority, "createdAt"
      FROM "SupportTicket"
      WHERE "assignedTo" IS NULL AND status = 'open'
      ORDER BY "createdAt" DESC
      LIMIT 5
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(gs::date, 'YYYY-MM-DD') AS date,
        COALESCE(SUM(o."totalAmount"), 0)::float AS revenue
      FROM generate_series(NOW() - INTERVAL '29 days', NOW(), INTERVAL '1 day') AS gs
      LEFT JOIN "Order" o ON DATE(o."placedAt") = gs::date AND o.status != 'cancelled'
      GROUP BY gs::date
      ORDER BY gs::date
    `,
    prisma.$queryRaw`
      SELECT status, COUNT(*)::int AS count FROM "Order" GROUP BY status
    `,
    prisma.$queryRaw`
      SELECT
        TO_CHAR(gs::date, 'YYYY-MM-DD') AS date,
        COUNT(u.id)::int AS count
      FROM generate_series(NOW() - INTERVAL '6 days', NOW(), INTERVAL '1 day') AS gs
      LEFT JOIN "User" u ON DATE(u."createdAt") = gs::date
      GROUP BY gs::date
      ORDER BY gs::date
    `,
  ]);

  const ordersStatusChart = { processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
  for (const row of ordersStatusRows) {
    if (row.status in ordersStatusChart) ordersStatusChart[row.status] = row.count;
  }

  return success(res, {
    stats: {
      revenue:  revenueRows[0],
      orders:   ordersRows[0],
      users:    usersRows[0],
      products: productsRows[0],
      tickets:  ticketsRows[0],
    },
    charts: {
      revenueChart,
      ordersStatusChart,
      topProducts,
      newUsersChart,
    },
    recentOrders: recentOrders.map(o => ({
      id:          o.id,
      orderNumber: o.frontendId || String(o.id),
      user:        { username: o.username },
      total:       o.totalAmount,
      status:      o.status,
      placedAt:    o.placedAt,
    })),
    lowStockProducts,
    recentUnassignedTickets,
  });
  } catch (e) { next(e); }
}

module.exports = { getDashboard };
