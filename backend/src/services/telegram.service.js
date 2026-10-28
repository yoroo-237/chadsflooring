const axios = require('axios');
const prisma = require('../db');

// Every order is paid in the app; its invoice then goes to Telegram: posted to
// the shop's chat through a bot, and returned as plain text with a t.me link so
// the customer can send it too. Configuration:
//   TELEGRAM_BOT_TOKEN (env) — the bot that posts invoices
//   telegram_chat_id   (SiteSetting, else TELEGRAM_CHAT_ID) — the shop's chat
//   telegram_username  (SiteSetting, else TELEGRAM_SHOP_USERNAME) — for the t.me link
// Best-effort: a Telegram outage never blocks an order.

async function setting(key, fallback) {
  const row = await prisma.siteSetting.findUnique({ where: { key } }).catch(() => null);
  return row?.value?.trim() || fallback || '';
}

const escapeHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = n => `$${Number(n).toFixed(2)}`;

function formatContact(handle) {
  const h = String(handle || '').trim();
  if (!h) return null;
  if (/^-?\d+$/.test(h)) return `ID ${h}`;
  return '@' + h.replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, '');
}

async function sendTelegram(html) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const chatId = await setting('telegram_chat_id', process.env.TELEGRAM_CHAT_ID);
  if (!chatId) return false;
  try {
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true },
      { timeout: 8000 });
    return true;
  } catch (err) {
    console.error('[Telegram] sendMessage failed:', err.response?.data?.description || err.message);
    return false;
  }
}

// lines: [{ name, quantity, total }] · payments: [{ amount, currency }]
async function sendOrderInvoice({ orderNumber, lines, shipping, total, payments, user, shipTo }) {
  try {
    const telegram = formatContact(user?.telegramHandle);
    const paid = (payments || []).map(p => `${p.amount} ${p.currency}`).join(' + ') || 'wallet';
    const items = lines.map(l => `• ${l.quantity} × ${l.name} — ${money(l.total)}`);
    const text = [
      `PAID ORDER ${orderNumber}`,
      ...items,
      shipping != null ? `Shipping: ${Number(shipping) > 0 ? money(shipping) : 'Free'}` : null,
      `Total: ${money(total)} — paid ${paid}`,
      user?.username ? `Account: ${user.username}` : null,
      telegram ? `Telegram: ${telegram}` : null,
      shipTo ? `Ship to: ${shipTo}` : null,
    ].filter(Boolean).join('\n');
    const delivered = await sendTelegram([
      `✅ <b>Paid order ${escapeHtml(orderNumber)}</b> (wallet)`,
      ...items.map(escapeHtml),
      `<b>Total: ${money(total)}</b> · paid ${escapeHtml(paid)}`,
      user?.username ? `👤 ${escapeHtml(user.username)}` : null,
      telegram ? `✈️ Telegram: ${escapeHtml(telegram)}` : '✈️ Telegram: not on profile',
      shipTo ? `📦 ${escapeHtml(shipTo)}` : null,
    ].filter(Boolean).join('\n'));
    const shop = (await setting('telegram_username', process.env.TELEGRAM_SHOP_USERNAME)).replace(/^@/, '');
    return { text, delivered, shopTelegramUrl: shop ? `https://t.me/${shop}?text=${encodeURIComponent(text)}` : null };
  } catch (err) {
    console.error('[Telegram] invoice failed:', err.message);
    return null;
  }
}

module.exports = { sendOrderInvoice };
