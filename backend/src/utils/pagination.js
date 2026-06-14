function buildPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return { total, page, limit, totalPages, offset };
}

function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  return { page, limit };
}

module.exports = { buildPagination, parsePaginationParams };
