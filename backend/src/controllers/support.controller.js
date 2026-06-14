const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const { formatTicketId } = require('../utils/formatters');

function checkOwnership(ticket, req) {
  if (req.user && ticket.userId === req.user.id) return true;
  const email = req.query.email || req.body?.email;
  if (email && ticket.email === email) return true;
  return false;
}

async function listTickets(req, res) {
  let where;
  if (req.user) {
    where = { userId: req.user.id };
  } else if (req.query.email) {
    where = { email: req.query.email };
  } else {
    return error(res, 'Authentication or ?email required.', 401);
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, frontendId: true, category: true,
      status: true, response: true, createdAt: true, subject: true,
    },
  });

  return success(res, {
    tickets: tickets.map(t => ({ ...t, type: t.category })),
  });
}

async function createTicket(req, res) {
  const { email, category, subject, message } = req.body;

  const ticket = await prisma.supportTicket.create({
    data: {
      frontendId: formatTicketId(Date.now()),
      email,
      category,
      subject,
      userId: req.user?.id || null,
    },
  });

  await prisma.supportMessage.create({
    data: {
      ticketId:   ticket.id,
      userId:     req.user?.id || null,
      body:       message,
      isStaff:    false,
      isInternal: false,
    },
  });

  return success(res, {
    ticket: {
      id:         ticket.id,
      frontendId: ticket.frontendId,
      category:   ticket.category,
      status:     ticket.status,
      response:   ticket.response,
      createdAt:  ticket.createdAt,
      subject:    ticket.subject,
    },
  }, 201);
}

async function getTicket(req, res) {
  const id = parseInt(req.params.id);
  const ticket = await prisma.supportTicket.findFirst({
    where:   { id },
    include: {
      messages: {
        where:   { isInternal: false },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) return error(res, 'Ticket not found.', 404);
  if (!checkOwnership(ticket, req)) return error(res, 'Access denied.', 403);

  return success(res, { ticket });
}

async function createMessage(req, res) {
  const id = parseInt(req.params.id);
  const { message } = req.body;
  if (!message?.trim()) return error(res, 'Message is required.', 400);

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(res, 'Ticket not found.', 404);
  if (!checkOwnership(ticket, req)) return error(res, 'Access denied.', 403);

  const msg = await prisma.supportMessage.create({
    data: {
      ticketId:   ticket.id,
      userId:     req.user?.id || null,
      body:       message.trim(),
      isStaff:    false,
      isInternal: false,
    },
  });

  await prisma.supportTicket.update({
    where: { id },
    data:  { response: 'pending' },
  });

  return success(res, { message: msg }, 201);
}

async function closeTicket(req, res) {
  const id = parseInt(req.params.id);
  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return error(res, 'Ticket not found.', 404);
  if (!checkOwnership(ticket, req)) return error(res, 'Access denied.', 403);

  if (!['open', 'in_progress'].includes(ticket.status)) {
    return error(res, 'Only open or in-progress tickets can be closed.', 422);
  }

  await prisma.supportTicket.update({ where: { id }, data: { status: 'closed' } });
  return success(res, { closed: true });
}

module.exports = { listTickets, createTicket, getTicket, createMessage, closeTicket };
