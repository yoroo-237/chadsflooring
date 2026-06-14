const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const { slugify } = require('../utils/formatters');

const ACTIVE_PRODUCTS_COUNT = { select: { products: { where: { isActive: true } } } };

// ── GET /api/categories ───────────────────────────────────────────────────────
async function list(req, res) {
  const categories = await prisma.category.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { _count: ACTIVE_PRODUCTS_COUNT },
  });
  return success(res, categories);
}

// ── GET /api/categories/:slug ─────────────────────────────────────────────────
async function getOne(req, res) {
  const category = await prisma.category.findFirst({
    where: {
      isActive: true,
      OR: [{ slug: req.params.slug }, { frontendId: req.params.slug }],
    },
    include: { _count: ACTIVE_PRODUCTS_COUNT },
  });
  if (!category) return error(res, 'Category not found.', 404);
  return success(res, category);
}

// ── POST /api/categories  (admin) ─────────────────────────────────────────────
async function create(req, res) {
  const slug = req.body.slug || slugify(req.body.label);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return error(res, 'Slug already in use.', 409);

  const category = await prisma.category.create({ data: { ...req.body, slug } });
  return success(res, category, 201);
}

// ── PUT /api/categories/:id  (admin) ──────────────────────────────────────────
async function update(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return error(res, 'Category not found.', 404);

  const category = await prisma.category.update({ where: { id }, data: req.body });
  return success(res, category);
}

// ── DELETE /api/categories/:id  (admin) ───────────────────────────────────────
async function remove(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return error(res, 'Category not found.', 404);

  const linkedCount = await prisma.product.count({ where: { categoryId: id, isActive: true } });
  if (linkedCount > 0) {
    return error(res, `Cannot delete: ${linkedCount} active product(s) still linked.`, 409);
  }

  await prisma.category.delete({ where: { id } });
  return success(res, { message: 'Category deleted.' });
}

module.exports = { list, getOne, create, update, remove };
