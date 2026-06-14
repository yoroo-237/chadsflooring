const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { updateProductRating } = require('../../services/product.service');

async function listReviews(req, res) {
  const { page, limit } = parsePaginationParams(req.query);
  const { isApproved, productId } = req.query;

  const where = {};
  if (isApproved !== undefined) where.isApproved = isApproved === 'true';
  if (productId)                where.productId  = parseInt(productId);

  const skip = (page - 1) * limit;

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        product: { select: { id: true, name: true } },
        user:    { select: { id: true, username: true } },
      },
    }),
  ]);

  return success(res, { reviews, pagination: buildPagination(page, limit, total) });
}

async function approveReview(req, res) {
  const id = parseInt(req.params.id);

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return error(res, 'Review not found.', 404);

  await prisma.review.update({ where: { id }, data: { isApproved: true } });
  await updateProductRating(review.productId);

  return success(res, { approved: true });
}

async function deleteReview(req, res) {
  const id = parseInt(req.params.id);

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return error(res, 'Review not found.', 404);

  await prisma.review.delete({ where: { id } });
  await updateProductRating(review.productId);

  return success(res, { deleted: true });
}

module.exports = { listReviews, approveReview, deleteReview };
