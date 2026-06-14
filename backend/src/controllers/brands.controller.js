const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const { slugify } = require('../utils/formatters');

const ACTIVE_PRODUCTS_COUNT = { select: { products: { where: { isActive: true } } } };

// ── GET /api/brands  (?featured=true for Explore page) ───────────────────────
async function list(req, res) {
  const where = { isActive: true };
  if (req.query.featured === 'true') where.isFeatured = true;

  const brands = await prisma.brand.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: ACTIVE_PRODUCTS_COUNT },
  });
  return success(res, brands);
}

// ── POST /api/brands  (admin) ─────────────────────────────────────────────────
async function create(req, res) {
  const slug = req.body.slug || slugify(req.body.name);
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing) return error(res, 'Slug already in use.', 409);

  const brand = await prisma.brand.create({ data: { ...req.body, slug } });
  return success(res, brand, 201);
}

// ── PUT /api/brands/:id  (admin) ──────────────────────────────────────────────
async function update(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) return error(res, 'Brand not found.', 404);

  const brand = await prisma.brand.update({ where: { id }, data: req.body });
  return success(res, brand);
}

// ── DELETE /api/brands/:id  (admin) ───────────────────────────────────────────
async function remove(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.brand.findUnique({ where: { id } });
  if (!existing) return error(res, 'Brand not found.', 404);

  const linkedCount = await prisma.product.count({ where: { brandId: id, isActive: true } });
  if (linkedCount > 0) {
    return error(res, `Cannot delete: ${linkedCount} active product(s) still linked.`, 409);
  }

  await prisma.brand.delete({ where: { id } });
  return success(res, { message: 'Brand deleted.' });
}

module.exports = { list, create, update, remove };
