const prisma = require('../db');

// ── Shared include for product queries ───────────────────────────────────────
const PRODUCT_INCLUDE = {
  brand:    { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, frontendId: true, label: true, slug: true } },
  options:  true,
  images:   { orderBy: { sortOrder: 'asc' } },
};

// ── Format a raw Prisma product into the exact frontend shape ─────────────────
function formatProduct(p, markupPct = 0) {
  let price = Number(p.price);
  if (Number(markupPct) > 0 && p.priceType === 'usd') {
    price = price * (1 + Number(markupPct) / 100);
  }

  let stockLabel;
  if (p.stock === 0)        stockLabel = 'Out of stock';
  else if (p.stock >= 250)  stockLabel = '250+ left';
  else                      stockLabel = `${p.stock} left`;

  return {
    id:           p.id,
    frontendId:   p.frontendId,
    name:         p.name,
    slug:         p.slug,
    price:        parseFloat(price.toFixed(2)),
    priceType:    p.priceType,
    stock:        p.stock,
    stockLabel,
    isLowStock:   p.stock > 0 && p.stock <= 10,
    rating:       Number(p.rating),
    reviewCount:  p.reviewCount,
    optionsCount: p.optionsCount,
    imageUrl:     p.imageUrl,
    isActive:     p.isActive,
    isFeatured:   p.isFeatured,
    isTrending:   p.isTrending,
    isNew:        p.isNew,
    isOnSale:     p.isOnSale,
    isBestSelling:p.isBestSelling,
    brand:        p.brand ?? null,
    category:     p.category ?? null,
  };
}

// ── Sort map ─────────────────────────────────────────────────────────────────
const SORT_MAP = {
  price_asc:   [{ price: 'asc' }],
  price_desc:  [{ price: 'desc' }],
  name_asc:    [{ name: 'asc' }],
  name_desc:   [{ name: 'desc' }],
  rating_desc: [{ rating: 'desc' }],
  newest:      [{ createdAt: 'desc' }],
  trending:    [{ isTrending: 'desc' }, { createdAt: 'desc' }],
  bestselling: [{ isBestSelling: 'desc' }, { reviewCount: 'desc' }],
};

// ── Main product listing ──────────────────────────────────────────────────────
async function getProducts(filters = {}, markupPct = 0) {
  const {
    category, brand, search,
    minPrice, maxPrice,
    inStock, rating,
    sort, page = 1, limit = 20,
    featured, trending, isNew, onSale, bestSelling,
    priceType,
  } = filters;

  // Build AND-chained where clauses for clean composability
  const and = [{ isActive: true }];

  if (category) {
    and.push({ category: { OR: [{ slug: category }, { frontendId: category }] } });
  }
  if (brand) {
    and.push({ brand: { slug: brand } });
  }
  if (search) {
    and.push({
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter = {};
    if (minPrice !== undefined) priceFilter.gte = parseFloat(minPrice);
    if (maxPrice !== undefined) priceFilter.lte = parseFloat(maxPrice);
    and.push({ price: priceFilter });
  }
  if (inStock === true || inStock === 'true') {
    and.push({ stock: { gt: 0 } });
  }
  if (rating !== undefined) {
    and.push({ rating: { gte: parseFloat(rating) } });
  }
  if (featured    === 'true' || featured    === true) and.push({ isFeatured:    true });
  if (trending    === 'true' || trending    === true) and.push({ isTrending:    true });
  if (isNew       === 'true' || isNew       === true) and.push({ isNew:         true });
  if (onSale      === 'true' || onSale      === true) and.push({ isOnSale:      true });
  if (bestSelling === 'true' || bestSelling === true) and.push({ isBestSelling: true });
  if (priceType) and.push({ priceType });

  const where   = { AND: and };
  const orderBy = SORT_MAP[sort] ?? [{ sortOrder: 'asc' }];
  const skip    = (parseInt(page) - 1) * parseInt(limit);
  const take    = Math.min(parseInt(limit), 100);

  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip, take, include: PRODUCT_INCLUDE }),
    prisma.product.count({ where }),
  ]);

  return {
    products:   rows.map(p => formatProduct(p, markupPct)),
    pagination: {
      total,
      page:       parseInt(page),
      limit:      take,
      totalPages: Math.ceil(total / take),
    },
  };
}

// ── Single product by DB id OR frontendId ────────────────────────────────────
async function getProductById(idOrFrontendId) {
  const numId = parseInt(idOrFrontendId);
  if (isNaN(numId)) return null;

  return prisma.product.findFirst({
    where: {
      isActive: true,
      OR: [{ id: numId }, { frontendId: numId }],
    },
    include: PRODUCT_INCLUDE,
  });
}

// ── Recalculate product rating from approved reviews ─────────────────────────
async function updateProductRating(productId) {
  const agg = await prisma.review.aggregate({
    where:  { productId, isApproved: true },
    _avg:   { rating: true },
    _count: { id: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      rating:      agg._avg.rating ?? 0,
      reviewCount: agg._count.id,
    },
  });
}

module.exports = { getProducts, getProductById, updateProductRating, formatProduct, PRODUCT_INCLUDE };
