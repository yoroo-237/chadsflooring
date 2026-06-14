const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../utils/pagination');

const PUBLIC_SETTINGS = [
  'shipping_cost', 'shipping_free_threshold', 'shipping_deadline_h',
  'shipping_deadline_m', 'site_name', 'points_rate',
];

async function getNews(req, res) {
  const { page: p, limit: l } = parsePaginationParams(req.query);
  const where = { isPublished: true };

  const [total, news] = await prisma.$transaction([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip:    (p - 1) * l,
      take:    l,
    }),
  ]);

  return success(res, { news, pagination: buildPagination(p, l, total) });
}

async function getFaq(req, res) {
  const faq = await prisma.faq.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return success(res, { faq });
}

async function getGiveaways(req, res) {
  const giveaways = await prisma.giveaway.findMany({
    where:   { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  let userEntryMap = {};
  if (req.user) {
    const entries = await prisma.giveawayEntry.findMany({
      where:  { userId: req.user.id },
      select: { giveawayId: true },
    });
    for (const e of entries) userEntryMap[e.giveawayId] = true;
  }

  return success(res, {
    giveaways: giveaways.map(g => ({
      ...g,
      userEntered: Boolean(userEntryMap[g.id]),
    })),
  });
}

async function enterGiveaway(req, res) {
  const id = parseInt(req.params.id);
  const giveaway = await prisma.giveaway.findUnique({ where: { id } });

  if (!giveaway || !giveaway.isActive) {
    return error(res, 'Giveaway not found or inactive.', 404);
  }
  if (giveaway.endsAt && giveaway.endsAt < new Date()) {
    return error(res, 'Giveaway has ended.', 422);
  }

  const existing = await prisma.giveawayEntry.findUnique({
    where: { giveawayId_userId: { giveawayId: id, userId: req.user.id } },
  });
  if (existing) return error(res, 'Already entered this giveaway.', 409);

  await prisma.giveawayEntry.create({ data: { giveawayId: id, userId: req.user.id } });
  const updated = await prisma.giveaway.update({
    where: { id },
    data:  { entriesCount: { increment: 1 } },
  });

  return success(res, { entered: true, entries: updated.entriesCount }, 201);
}

async function getSystemStatus(req, res) {
  const [services, incidents] = await prisma.$transaction([
    prisma.systemStatus.findMany({ orderBy: { service: 'asc' } }),
    prisma.systemIncident.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);
  return success(res, { services, incidents });
}

async function getSettings(req, res) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: PUBLIC_SETTINGS } },
  });
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return success(res, { settings });
}

module.exports = { getNews, getFaq, getGiveaways, enterGiveaway, getSystemStatus, getSettings };
