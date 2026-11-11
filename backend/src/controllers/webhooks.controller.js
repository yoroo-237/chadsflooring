const crypto = require('crypto');
const prisma  = require('../db');
const { syncDeposit } = require('../services/wallet.service');

// A payment can reach a deposit address at any time, again and again (an order paid in
// several goes, a customer paying the same top-up address twice). The webhooks only say
// "something happened on this address": syncDeposit reads the address's payments and
// credits each transaction once, by its hash.
const WATCHED = ['awaiting', 'partial', 'confirmed'];

// POST /api/webhooks/blockcypher
async function blockcypher(req, res) {
  res.status(200).json({ received: true }); // respond immediately — BlockCypher retries on timeout

  try {
    const { addresses, confirmations } = req.body || {};
    if (!addresses?.length || (confirmations ?? 0) < 1) return;

    for (const address of addresses) {
      const deposit = await prisma.deposit.findFirst({
        where: { address, currency: { in: ['BTC', 'LTC', 'DOGE'] }, status: { in: WATCHED } },
        orderBy: { id: 'desc' },
      });
      if (deposit) await syncDeposit(deposit);
    }
  } catch (e) {
    console.error('BlockCypher webhook error:', e.message);
  }
}

// POST /api/webhooks/alchemy
async function alchemy(req, res) {
  res.status(200).json({ received: true });

  try {
    const sig = req.headers['x-alchemy-signature'];
    if (sig && process.env.ALCHEMY_SIGNING_KEY) {
      const expected = crypto
        .createHmac('sha256', process.env.ALCHEMY_SIGNING_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (sig !== expected) return;
    }

    if (req.body?.type !== 'ADDRESS_ACTIVITY') return;
    const activity = req.body?.event?.activity;
    if (!Array.isArray(activity)) return;

    const addresses = new Set(activity
      .filter(a => a.category === 'external' && a.asset === 'ETH' && a.toAddress)
      .map(a => a.toAddress.toLowerCase()));
    for (const toAddress of addresses) {
      const deposit = await prisma.deposit.findFirst({
        where: { currency: 'ETH', status: { in: WATCHED }, address: { equals: toAddress, mode: 'insensitive' } },
        orderBy: { id: 'desc' },
      });
      if (deposit) await syncDeposit(deposit);
    }
  } catch (e) {
    console.error('Alchemy webhook error:', e.message);
  }
}

module.exports = { blockcypher, alchemy };
