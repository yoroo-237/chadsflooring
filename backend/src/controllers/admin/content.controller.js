const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { slugify } = require('../../utils/formatters');

// ─── News ────────────────────────────────────────────────────────────────────

async function listNews(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const { isPublished } = req.query;

  const where = {};
  if (isPublished !== undefined) where.isPublished = isPublished === 'true';

  const skip = (page - 1) * limit;
  const [total, news] = await Promise.all([
    prisma.news.count({ where }),
    prisma.news.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  return success(res, { news, pagination: buildPagination(page, limit, total) });
}

async function createNews(req, res) {
  const data = { ...req.body };
  const slug = data.slug || slugify(data.title);

  const existing = await prisma.news.findUnique({ where: { slug } });
  if (existing) return error(res, 'Slug already in use.', 409);

  const news = await prisma.news.create({
    data: { ...data, slug, authorId: req.user.sub },
  });
  return success(res, news, 201);
}

async function updateNews(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) return error(res, 'News not found.', 404);

  const { title, slug, category, excerpt, body, imageUrl, tag, tagColor, isPublished } = req.body;
  const data = {};
  if (title      !== undefined) data.title      = title;
  if (slug       !== undefined) data.slug        = slug;
  if (category   !== undefined) data.category    = category;
  if (excerpt    !== undefined) data.excerpt     = excerpt;
  if (body       !== undefined) data.body        = body;
  if (imageUrl   !== undefined) data.imageUrl    = imageUrl;
  if (tag        !== undefined) data.tag         = tag;
  if (tagColor   !== undefined) data.tagColor    = tagColor;
  if (isPublished !== undefined) data.isPublished = Boolean(isPublished);

  const news = await prisma.news.update({ where: { id }, data });
  return success(res, news);
}

async function deleteNews(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.news.findUnique({ where: { id } });
  if (!existing) return error(res, 'News not found.', 404);

  await prisma.news.delete({ where: { id } });
  return success(res, { deleted: true });
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

async function listFaq(req, res) {
  const faq = await prisma.faq.findMany({ orderBy: { sortOrder: 'asc' } });
  return success(res, { faq });
}

async function createFaq(req, res) {
  const faq = await prisma.faq.create({ data: req.body });
  return success(res, faq, 201);
}

async function updateFaq(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.faq.findUnique({ where: { id } });
  if (!existing) return error(res, 'FAQ not found.', 404);

  const { id: _id, createdAt, ...data } = req.body;
  const faq = await prisma.faq.update({ where: { id }, data });
  return success(res, faq);
}

async function deleteFaq(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.faq.findUnique({ where: { id } });
  if (!existing) return error(res, 'FAQ not found.', 404);

  await prisma.faq.delete({ where: { id } });
  return success(res, { deleted: true });
}

async function reorderFaq(req, res) {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return error(res, 'items must be a non-empty array of { id, sortOrder }.', 400);
  }

  await prisma.$transaction(
    items.map(item =>
      prisma.faq.update({
        where: { id: item.id },
        data:  { sortOrder: item.sortOrder },
      })
    )
  );
  return success(res, { reordered: true });
}

// ─── Giveaways ───────────────────────────────────────────────────────────────

async function listGiveaways(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const skip = (page - 1) * limit;

  const [total, giveaways] = await Promise.all([
    prisma.giveaway.count(),
    prisma.giveaway.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);
  return success(res, { giveaways, pagination: buildPagination(page, limit, total) });
}

async function createGiveaway(req, res) {
  const {
    title, badge, gradientFrom, gradientTo, gradientAngle,
    value, description, prizes, endsAt, winnersCount, maxEntries, active,
  } = req.body;
  const giveaway = await prisma.giveaway.create({
    data: {
      title:         title || '',
      badge:         badge || null,
      gradientFrom:  gradientFrom  || '#4361ee',
      gradientTo:    gradientTo    || '#7c3aed',
      gradientAngle: parseInt(gradientAngle) || 135,
      value:         value         || null,
      description:   description   || null,
      prizes:        Array.isArray(prizes) ? prizes : [],
      endsAt:        endsAt ? new Date(endsAt) : null,
      winnersCount:  parseInt(winnersCount) || 1,
      maxEntries:    maxEntries ? parseInt(maxEntries) : null,
      active:        active !== undefined ? Boolean(active) : true,
    },
  });
  return success(res, giveaway, 201);
}

async function updateGiveaway(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.giveaway.findUnique({ where: { id } });
  if (!existing) return error(res, 'Giveaway not found.', 404);

  const {
    title, badge, gradientFrom, gradientTo, gradientAngle,
    value, description, prizes, endsAt, winnersCount, maxEntries, active,
  } = req.body;
  const data = {};
  if (title         !== undefined) data.title         = title;
  if (badge         !== undefined) data.badge         = badge;
  if (gradientFrom  !== undefined) data.gradientFrom  = gradientFrom;
  if (gradientTo    !== undefined) data.gradientTo    = gradientTo;
  if (gradientAngle !== undefined) data.gradientAngle = parseInt(gradientAngle) || 135;
  if (value         !== undefined) data.value         = value;
  if (description   !== undefined) data.description   = description;
  if (prizes        !== undefined) data.prizes        = Array.isArray(prizes) ? prizes : [];
  if (endsAt        !== undefined) data.endsAt        = endsAt ? new Date(endsAt) : null;
  if (winnersCount  !== undefined) data.winnersCount  = parseInt(winnersCount) || 1;
  if (maxEntries    !== undefined) data.maxEntries    = maxEntries ? parseInt(maxEntries) : null;
  if (active        !== undefined) data.active        = Boolean(active);

  const giveaway = await prisma.giveaway.update({ where: { id }, data });
  return success(res, giveaway);
}

async function deleteGiveaway(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.giveaway.findUnique({ where: { id } });
  if (!existing) return error(res, 'Giveaway not found.', 404);

  await prisma.giveaway.delete({ where: { id } });
  return success(res, { deleted: true });
}

async function getGiveawayEntries(req, res) {
  const id = parseInt(req.params.id);
  const { page, limit } = parsePaginationParams(req.query);

  const giveaway = await prisma.giveaway.findUnique({ where: { id } });
  if (!giveaway) return error(res, 'Giveaway not found.', 404);

  const skip = (page - 1) * limit;
  const [total, entries] = await Promise.all([
    prisma.giveawayEntry.count({ where: { giveawayId: id } }),
    prisma.giveawayEntry.findMany({
      where:   { giveawayId: id },
      orderBy: { enteredAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
  ]);

  return success(res, {
    entries: entries.map(e => ({
      id:        e.id,
      userId:    e.userId,
      username:  e.user.username,
      email:     e.user.email,
      enteredAt: e.enteredAt,
    })),
    pagination: buildPagination(page, limit, total),
  });
}

module.exports = {
  listNews, createNews, updateNews, deleteNews,
  listFaq, createFaq, updateFaq, deleteFaq, reorderFaq,
  listGiveaways, createGiveaway, updateGiveaway, deleteGiveaway, getGiveawayEntries,
};
