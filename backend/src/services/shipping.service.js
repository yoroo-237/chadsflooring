const prisma = require('../db');

async function calculateShipping(subtotal) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['shipping_cost', 'shipping_free_threshold'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const cost      = parseFloat(map.shipping_cost)            || 16.99;
  const threshold = parseFloat(map.shipping_free_threshold)  || 75.00;

  const shippingCost = (threshold > 0 && parseFloat(subtotal) >= threshold) ? 0 : cost;
  return { shippingCost, isFree: shippingCost === 0 };
}

async function getShippingDeadline() {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['shipping_deadline_h', 'shipping_deadline_m'] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const h = parseInt(map.shipping_deadline_h) || 22;
  const m = parseInt(map.shipping_deadline_m) || 39;

  const now = new Date();
  const deadline = new Date(now);
  deadline.setHours(h, m, 0, 0);
  if (deadline <= now) deadline.setDate(deadline.getDate() + 1);

  return { deadline, remainingMs: deadline.getTime() - now.getTime() };
}

module.exports = { calculateShipping, getShippingDeadline };
