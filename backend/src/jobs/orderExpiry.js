const { expirePendingOrders } = require('../services/order.service');

// Orders paid straight in crypto have 30 minutes: past that, they are cancelled
// (stock and points given back, anything already received refunded). Each minute.
const INTERVAL_MS = 60 * 1000;

async function run() {
  try {
    const n = await expirePendingOrders();
    if (n > 0) console.log(`[OrderExpiry] ${n} unpaid order(s) cancelled`);
  } catch (e) {
    console.error('[OrderExpiry] Error:', e.message);
  }
}

function startOrderExpiryJob() {
  run();
  setInterval(run, INTERVAL_MS);
}

module.exports = { startOrderExpiryJob };
