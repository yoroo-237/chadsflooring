const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const { parsePaginationParams } = require('../utils/pagination');
const { slugify } = require('../utils/formatters');
const { getProducts, getProductById, updateProductRating, formatProduct, PRODUCT_INCLUDE } = require('../services/product.service');

// ── GET /api/products ─────────────────────────────────────────────────────────
async function list(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const markupPct = req.user?.markupPct ?? 0;

  const result = await getProducts({ ...req.query, page, limit }, markupPct);
  return success(res, result);
}

// ── GET /api/products/scrape  (requireApiKey) ─────────────────────────────────
async function scrape(req, res) {
  const products = await prisma.product.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: PRODUCT_INCLUDE,
  });

  // Mirror the original frontend products.js object shape exactly
  const formatted = products.map(p => ({
    id:          p.frontendId ?? p.id,
    brand:       p.brand?.name ?? '',
    brandSlug:   p.brand?.slug ?? '',
    name:        p.name,
    price:       p.priceType === 'points' ? `P${parseInt(p.price)}` : `$${Number(p.price).toFixed(2)}`,
    stock:       p.stock,
    rating:      Number(p.rating),
    reviewCount: p.reviewCount,
    options:     p.optionsCount,
    image:       p.imageUrl,
    category:    p.category?.frontendId ?? '',
  }));

  return success(res, formatted);
}

// ── GET /api/products/:id ─────────────────────────────────────────────────────
async function getOne(req, res) {
  const product = await getProductById(req.params.id);
  if (!product) return error(res, 'Product not found.', 404);

  const markupPct = req.user?.markupPct ?? 0;
  return success(res, formatProduct(product, markupPct));
}

// ── GET /api/products/:id/reviews ─────────────────────────────────────────────
async function listReviews(req, res) {
  const product = await getProductById(req.params.id);
  if (!product) return error(res, 'Product not found.', 404);

  const { page, limit } = parsePaginationParams(req.query);
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where:   { productId: product.id, isApproved: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take:    limit,
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.review.count({ where: { productId: product.id, isApproved: true } }),
  ]);

  return success(res, {
    reviews,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// ── POST /api/products/:id/reviews  (requireAuth) ────────────────────────────
async function createReview(req, res) {
  const product = await getProductById(req.params.id);
  if (!product) return error(res, 'Product not found.', 404);

  const hasOrdered = await prisma.orderItem.findFirst({
    where: { productId: product.id, order: { userId: req.user.sub } },
  });
  if (!hasOrdered) {
    return error(res, 'You must purchase this product before reviewing it.', 403);
  }

  const alreadyReviewed = await prisma.review.findFirst({
    where: { productId: product.id, userId: req.user.sub },
  });
  if (alreadyReviewed) {
    return error(res, 'You have already reviewed this product.', 409);
  }

  const review = await prisma.review.create({
    data: {
      productId:  product.id,
      userId:     req.user.sub,
      rating:     req.body.rating,
      title:      req.body.title  ?? '',
      body:       req.body.body   ?? '',
      isApproved: false,
    },
  });

  return success(res, review, 201);
}

// ── POST /api/products  (admin) ───────────────────────────────────────────────
async function create(req, res) {
  const data = req.body;

  const slug = data.slug || slugify(data.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return error(res, 'Slug already in use. Provide a unique slug.', 409);

  const product = await prisma.product.create({
    data: { ...data, slug },
    include: PRODUCT_INCLUDE,
  });
  return success(res, formatProduct(product), 201);
}

// ── PUT /api/products/:id  (admin) ────────────────────────────────────────────
async function update(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return error(res, 'Product not found.', 404);

  if (req.body.name && !req.body.slug) {
    req.body.slug = slugify(req.body.name);
  }

  const product = await prisma.product.update({
    where:   { id },
    data:    req.body,
    include: PRODUCT_INCLUDE,
  });
  return success(res, formatProduct(product));
}

// ── DELETE /api/products/:id  (admin) — soft delete ──────────────────────────
async function remove(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return error(res, 'Product not found.', 404);

  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return success(res, { message: 'Product deactivated.' });
}

// ── PATCH /api/products/:id/stock  (admin) ────────────────────────────────────
async function patchStock(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return error(res, 'Product not found.', 404);

  const product = await prisma.product.update({
    where:   { id },
    data:    { stock: req.body.stock },
    include: PRODUCT_INCLUDE,
  });
  return success(res, formatProduct(product));
}

module.exports = { list, scrape, getOne, listReviews, createReview, create, update, remove, patchStock };
