const { z } = require('zod');

const createProductSchema = z.object({
  name:         z.string().min(1).max(255),
  slug:         z.string().optional(),
  price:        z.number().positive(),
  priceType:    z.enum(['usd', 'points']).default('usd'),
  stock:        z.number().int().min(0).default(0),
  categoryId:   z.number().int().positive(),
  brandId:      z.number().int().positive().optional().nullable(),
  description:  z.string().default(''),
  imageUrl:     z.string().default(''),
  optionsCount: z.number().int().min(0).optional().nullable(),
  isActive:     z.boolean().default(true),
  isFeatured:   z.boolean().default(false),
  isTrending:   z.boolean().default(false),
  isNew:        z.boolean().default(false),
  isOnSale:     z.boolean().default(false),
  isBestSelling:z.boolean().default(false),
  frontendId:   z.number().int().optional().nullable(),
  sortOrder:    z.number().int().default(0),
});

const updateProductSchema = createProductSchema.partial();

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title:  z.string().max(255).optional().default(''),
  body:   z.string().optional().default(''),
});

const stockSchema = z.object({
  stock: z.number().int().min(0),
});

module.exports = { createProductSchema, updateProductSchema, reviewSchema, stockSchema };
