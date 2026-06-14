const prisma = require('../db');
const { success } = require('../utils/apiResponse');

function formatRelativeTime(date) {
  const ms  = Date.now() - new Date(date).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function list(req, res) {
  const notifications = await prisma.notification.findMany({
    where:   { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return success(res, {
    notifications: notifications.map(n => ({
      id:     n.id,
      type:   n.type,
      title:  n.title,
      body:   n.body,
      isRead: n.isRead,
      link:   n.link,
      time:   formatRelativeTime(n.createdAt),
    })),
    unreadCount,
  });
}

async function markRead(req, res) {
  const id = parseInt(req.params.id);
  await prisma.notification.updateMany({
    where: { id, userId: req.user.id },
    data:  { isRead: true },
  });
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.id, isRead: false },
  });
  return success(res, { unreadCount });
}

async function markAllRead(req, res) {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, isRead: false },
    data:  { isRead: true },
  });
  return success(res, { updated: result.count });
}

module.exports = { list, markRead, markAllRead };
