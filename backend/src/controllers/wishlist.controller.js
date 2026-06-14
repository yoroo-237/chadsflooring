const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');

function formatWishlistProduct(p, markupPct) {
  let price = parseFloat(p.price);
  if (p.priceType === 'usd' && markupPct > 0) {
    price = parseFloat((price * (1 + markupPct / 100)).toFixed(2));
  }
  const stock = p.stock;
  return {
    id:           p.id,
    frontendId:   p.frontendId,
    name:         p.name,
    slug:         p.slug,
    price,
    priceType:    p.priceType,
    priceLabel:   p.priceType === 'usd' ? `$${price.toFixed(2)}` : `P${Math.round(parseFloat(p.price))}`,
    stock,
    stockLabel:   stock === 0 ? 'Out of stock' : stock >= 250 ? '250+ left' : `${stock} left`,
    isLowStock:   stock > 0 && stock <= 10,
    rating:       parseFloat(p.rating),
    reviewCount:  p.reviewCount,
    optionsCount: p.optionsCount,
    imageUrl:     p.imageUrl,
    brand:        p.brand?.name  || null,
    brandSlug:    p.brand?.slug  || null,
    category:     p.category?.frontendId || null,
    isActive:     p.isActive,
  };
}

async function getWishlist(req, res) {
  const user = await prisma.user.findUnique({
    where:  { id: req.user.id },
    select: { markupPct: true },
  });
  const markupPct = parseFloat(user?.markupPct || 0);

  const wishlists = await prisma.wishlist.findMany({
    where:   { userId: req.user.id },
    include: { product: { include: { brand: true, category: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const products = wishlists
    .filter(w => w.product?.isActive)
    .map(w => formatWishlistProduct(w.product, markupPct));

  return success(res, {
    products,
    productIds: products.map(p => p.frontendId ?? p.id),
  });
}

async function toggle(req, res) {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return error(res, 'Invalid product ID.', 400);

  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
  if (!product) return error(res, 'Product not found.', 404);

  const existing = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId: req.user.id, productId } },
  });

  if (existing) {
    await prisma.wishlist.delete({
      where: { userId_productId: { userId: req.user.id, productId } },
    });
    return success(res, { added: false, productId });
  }

  await prisma.wishlist.create({ data: { userId: req.user.id, productId } });
  return success(res, { added: true, productId });
}

async function remove(req, res) {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return error(res, 'Invalid product ID.', 400);

  try {
    await prisma.wishlist.delete({
      where: { userId_productId: { userId: req.user.id, productId } },
    });
  } catch {
    // Item didn't exist — still 200
  }
  return success(res, { removed: true, productId });
}

module.exports = { getWishlist, toggle, remove };
