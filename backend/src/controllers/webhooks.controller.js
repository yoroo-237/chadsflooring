const crypto = require('crypto');
const prisma  = require('../db');
const { confirmDepositManually }      = require('../services/wallet.service');
const { deleteBlockCypherForwarding } = require('../services/crypto.service');

const COINGECKO_ID = {
  BTC:  'bitcoin',
  LTC:  'litecoin',
  DOGE: 'dogecoin',
  ETH:  'ethereum',
};

async function getCoinUsdPrice(coinId) {
  try {
    const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
    const data = await res.json();
    return data[coinId]?.usd || null;
  } catch {
    return null;
  }
}

// POST /api/webhooks/blockcypher
async function blockcypher(req, res) {
  res.status(200).json({ received: true }); // respond immediately — BlockCypher retries on timeout

  try {
    const body = req.body || {};

    // ── Payment forwarding callback ────────────────────────────────────────────
    // Payload: { input_address, destination, value (satoshis), input_transaction_hash, transaction_hash }
    if (body.input_address) {
      const { input_address, value, input_transaction_hash } = body;
      if (!value || value <= 0) return;

      const deposit = await prisma.deposit.findFirst({
        where: {
          address:  input_address,
          currency: { in: ['BTC', 'LTC', 'DOGE'] },
          status:   { in: ['awaiting', 'partial'] },
        },
      });
      if (!deposit) return;

      const price = await getCoinUsdPrice(COINGECKO_ID[deposit.currency]);
      if (!price) {
        console.error(`Could not fetch USD price for ${deposit.currency}`);
        return;
      }

      const usdAmount = parseFloat(((value / 1e8) * price).toFixed(2));
      await confirmDepositManually(deposit.id, usdAmount, null, input_transaction_hash || null);
      await deleteBlockCypherForwarding(deposit.currency, deposit.hookId);
      return;
    }

    // ── Regular confirmed-tx webhook (legacy / fallback) ───────────────────────
    const { addresses, outputs, confirmations, hash } = body;
    if (!addresses?.length || !outputs?.length || (confirmations ?? 0) < 1) return;

    for (const address of addresses) {
      const deposit = await prisma.deposit.findFirst({
        where: {
          address,
          currency: { in: ['BTC', 'LTC', 'DOGE'] },
          status:   { in: ['awaiting', 'partial'] },
        },
      });
      if (!deposit) continue;

      const satoshis = outputs
        .filter(o => Array.isArray(o.addresses) && o.addresses.includes(address))
        .reduce((sum, o) => sum + (o.value || 0), 0);
      if (satoshis <= 0) continue;

      const price = await getCoinUsdPrice(COINGECKO_ID[deposit.currency]);
      if (!price) continue;

      const usdAmount = parseFloat(((satoshis / 1e8) * price).toFixed(2));
      await confirmDepositManually(deposit.id, usdAmount, null, hash || null);
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

    for (const act of activity) {
      if (act.category !== 'external' || act.asset !== 'ETH') continue;
      const toAddress = act.toAddress?.toLowerCase();
      if (!toAddress || !act.value) continue;

      const deposit = await prisma.deposit.findFirst({
        where: {
          currency: 'ETH',
          status:   { in: ['awaiting', 'partial'] },
          address:  { equals: toAddress, mode: 'insensitive' },
        },
      });
      if (!deposit) continue;

      const price = await getCoinUsdPrice('ethereum');
      if (!price) continue;

      const usdAmount = parseFloat((parseFloat(act.value) * price).toFixed(2));
      await confirmDepositManually(deposit.id, usdAmount, null, act.hash || null);
    }
  } catch (e) {
    console.error('Alchemy webhook error:', e.message);
  }
}

module.exports = { blockcypher, alchemy };
