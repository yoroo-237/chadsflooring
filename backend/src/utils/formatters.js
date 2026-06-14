function formatOrderId(timestamp) {
  return `ORD-${timestamp}`;
}

function formatTxnId(timestamp) {
  return `TXN-${timestamp}`;
}

function formatTicketId(timestamp) {
  return `TKT-${String(timestamp).slice(-6)}`;
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { formatOrderId, formatTxnId, formatTicketId, slugify };
