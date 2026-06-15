const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { slugify } = require('../../utils/formatters');
const { updateProductRating, formatProduct, PRODUCT_INCLUDE } = require('../../services/product.service');

function parseOpts(options) {
  if (!options) return undefined;
  if (typeof options === 'string') {
    try { return JSON.parse(options); } catch { return []; }
  }
  return Array.isArray(options) ? options : [];
}

function coerce(body) {
  const {
    name, description = '', price, stock = 0, imageUrl = '',
    categoryId, brandId, priceType = 'usd', sortOrder = 0,
    isActive = true, isFeatured = false, isTrending = false,
    isNew = false, isOnSale = false, isBestSelling = false,
  } = body;

  const bool = v => v === true || v === 'true';

  return {
    name,
    description: description || '',
    price:        parseFloat(price) || 0,
    stock:        parseInt(stock)   || 0,
    imageUrl:     imageUrl || '',
    categoryId:   categoryId ? parseInt(categoryId) : null,
    brandId:      brandId   ? parseInt(brandId)     : null,
    priceType:    priceType || 'usd',
    sortOrder:    parseInt(sortOrder) || 0,
    isActive:     bool(isActive),
    isFeatured:   bool(isFeatured),
    isTrending:   bool(isTrending),
    isNew:        bool(isNew),
    isOnSale:     bool(isOnSale),
    isBestSelling:bool(isBestSelling),
  };
}

function mapOpt(opt, idx, productId) {
  return {
    ...(productId !== undefined ? { productId } : {}),
    label:      opt.label || '',
    priceDelta: parseFloat(opt.priceDelta ?? opt.priceModifier ?? 0) || 0,
    stock:      parseInt(opt.stock) || 0,
    sortOrder:  parseInt(opt.sortOrder ?? idx) || 0,
  };
}

async function listProducts(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const {
    category, brand, search,
    minPrice, maxPrice, inStock, rating,
    sort, featured, trending, isNew, onSale, bestSelling,
    priceType, isActive,
  } = req.query;

  const and = [];
  if (isActive !== undefined) and.push({ isActive: isActive === 'true' });
  if (category) and.push({ category: { OR: [{ slug: category }, { frontendId: category }] } });
  if (brand)     and.push({ brand: { slug: brand } });
  if (priceType) and.push({ priceType });
  if (search) {
    and.push({
      OR: [
        { name:  { contains: search, mode: 'insensitive' } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    const pf = {};
    if (minPrice !== undefined) pf.gte = parseFloat(minPrice);
    if (maxPrice !== undefined) pf.lte = parseFloat(maxPrice);
    and.push({ price: pf });
  }
  if (inStock    === 'true') and.push({ stock: { gt: 0 } });
  if (rating)                and.push({ rating: { gte: parseFloat(rating) } });
  if (featured   === 'true') and.push({ isFeatured: true });
  if (trending   === 'true') and.push({ isTrending: true });
  if (isNew      === 'true') and.push({ isNew: true });
  if (onSale     === 'true') and.push({ isOnSale: true });
  if (bestSelling === 'true') and.push({ isBestSelling: true });

  const SORT_MAP = {
    price_asc:   [{ price: 'asc' }],
    price_desc:  [{ price: 'desc' }],
    name_asc:    [{ name: 'asc' }],
    name_desc:   [{ name: 'desc' }],
    rating_desc: [{ rating: 'desc' }],
    newest:      [{ createdAt: 'desc' }],
  };

  const where   = and.length ? { AND: and } : {};
  const orderBy = SORT_MAP[sort] ?? [{ sortOrder: 'asc' }];
  const skip    = (page - 1) * limit;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { ...PRODUCT_INCLUDE, _count: { select: { reviews: true } } },
    }),
  ]);

  return success(res, {
    products: products.map(p => ({ ...formatProduct(p), _count: p._count })),
    pagination: buildPagination(page, limit, total),
  });
}

async function getProductById(req, res) {
  const id = parseInt(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  if (!product) return error(res, 'Product not found.', 404);
  return success(res, { ...formatProduct(product), options: product.options || [] });
}

async function createProduct(req, res) {
  const data = coerce(req.body);
  const opts = parseOpts(req.body.options);

  if (!data.name) return error(res, 'name is required.', 400);

  const slug = req.body.slug || slugify(data.name);
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) return error(res, 'Slug already in use.', 409);

  if (!data.imageUrl && req.file) {
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
      const result = await cloudinary.uploader.upload(req.file.path, { folder: 'canna-express/products' });
      data.imageUrl = result.secure_url;
    } else {
      data.imageUrl = `/uploads/${req.file.filename}`;
    }
  }

  const product = await prisma.product.create({ data: { ...data, slug }, include: PRODUCT_INCLUDE });

  if (opts && opts.length > 0) {
    await prisma.productOption.createMany({
      data: opts.map((o, i) => mapOpt(o, i, product.id)),
    });
  }

  const full = await prisma.product.findUnique({ where: { id: product.id }, include: PRODUCT_INCLUDE });
  return success(res, { ...formatProduct(full), options: full.options || [] }, 201);
}

async function updateProduct(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return error(res, 'Product not found.', 404);

  const opts = parseOpts(req.body.options);
  const raw  = coerce({ ...existing, ...req.body });
  if (req.body.name && !req.body.slug) raw.slug = slugify(req.body.name);

  await prisma.$transaction(async tx => {
    await tx.product.update({ where: { id }, data: raw });

    if (opts !== undefined) {
      const keptIds = opts.filter(o => o.id).map(o => parseInt(o.id));
      await tx.productOption.deleteMany({ where: { productId: id, id: { notIn: keptIds } } });

      for (const [i, opt] of opts.entries()) {
        if (opt.id) {
          await tx.productOption.update({ where: { id: parseInt(opt.id) }, data: mapOpt(opt, i) });
        } else {
          await tx.productOption.create({ data: mapOpt(opt, i, id) });
        }
      }
    }
  });

  const updated = await prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
  return success(res, { ...formatProduct(updated), options: updated.options || [] });
}

async function removeProduct(req, res) {
  const id = parseInt(req.params.id);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return error(res, 'Product not found.', 404);

  await prisma.product.update({ where: { id }, data: { isActive: false } });
  return success(res, { message: 'Product deactivated.' });
}

async function patchStock(req, res) {
  const id = parseInt(req.params.id);
  const stock = parseInt(req.body.stock);

  if (isNaN(stock) || stock < 0) return error(res, 'stock must be a non-negative number.', 400);

  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) return error(res, 'Product not found.', 404);

  const product = await prisma.product.update({ where: { id }, data: { stock }, include: PRODUCT_INCLUDE });
  return success(res, formatProduct(product));
}

module.exports = { listProducts, getProductById, createProduct, updateProduct, removeProduct, patchStock };
