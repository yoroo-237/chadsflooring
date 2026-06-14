const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');

async function listTickets(req, res, next) {
  try {
  const { page, limit } = parsePaginationParams(req.query);
  const { status, priority, category, assignedTo } = req.query;

  const where = {};
  if (status)   where.status   = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;
  if (assignedTo === 'null' || assignedTo === 'unassigned') {
    where.assignedTo = null;
  } else if (assignedTo) {
    where.assignedTo = parseInt(assignedTo);
  }

  const skip = (page - 1) * limit;

  if (req.query.search) {
    where.subject = { contains: req.query.search, mode: 'insensitive' };
  }

  const [total, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      include: {
        user:     { select: { id: true, username: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
  ]);

  return success(res, {
    tickets: tickets.map(t => ({
      ...t,
      lastMessage: t.messages[0] || null,
      messages:    undefined,
    })),
    total,
    pagination: buildPagination(page, limit, total),
  });
  } catch (e) { next(e); }
}

async function createMessage(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const { message, isInternal = false } = req.body;

  if (!message?.trim()) return error(res, 'message is required.', 400);

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(res, 'Ticket not found.', 404);

  const msg = await prisma.supportMessage.create({
    data: {
      ticketId:   id,
      userId:     req.user.id,
      body:       message.trim(),
      isStaff:    true,
      isInternal: Boolean(isInternal),
    },
  });

  const updateData = { updatedAt: new Date() };
  if (!isInternal) updateData.response = 'responded';
  await prisma.supportTicket.update({ where: { id }, data: updateData });

  return success(res, { message: msg }, 201);
  } catch (e) { next(e); }
}

async function updateTicketStatus(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  const VALID = ['open', 'in_progress', 'resolved', 'closed'];
  if (!VALID.includes(status)) {
    return error(res, `Invalid status. Must be one of: ${VALID.join(', ')}.`, 400);
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(res, 'Ticket not found.', 404);

  await prisma.supportTicket.update({ where: { id }, data: { status } });
  return success(res, { status });
  } catch (e) { next(e); }
}

async function assignTicket(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const { adminId } = req.body;

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(res, 'Ticket not found.', 404);

  const admin = await prisma.user.findUnique({
    where:  { id: parseInt(adminId) },
    select: { id: true, role: true },
  });
  if (!admin || !['admin', 'moderator'].includes(admin.role)) {
    return error(res, 'Target user is not an admin or moderator.', 400);
  }

  await prisma.supportTicket.update({ where: { id }, data: { assignedTo: admin.id } });
  return success(res, { assignedTo: admin.id });
  } catch (e) { next(e); }
}

async function updatePriority(req, res, next) {
  try {
  const id = parseInt(req.params.id);
  const { priority } = req.body;

  const VALID = ['low', 'normal', 'high', 'urgent'];
  if (!VALID.includes(priority)) {
    return error(res, `Invalid priority. Must be one of: ${VALID.join(', ')}.`, 400);
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(res, 'Ticket not found.', 404);

  await prisma.supportTicket.update({ where: { id }, data: { priority } });
  return success(res, { priority });
  } catch (e) { next(e); }
}

async function getStats(req, res, next) {
  try {
  const statuses = ['open', 'in_progress', 'resolved', 'closed'];
  const counts = await Promise.all(statuses.map(s => prisma.supportTicket.count({ where: { status: s } })));
  return success(res, Object.fromEntries(statuses.map((s, i) => [s, counts[i]])));
  } catch (e) { next(e); }
}

module.exports = { listTickets, getStats, createMessage, updateTicketStatus, assignTicket, updatePriority };
