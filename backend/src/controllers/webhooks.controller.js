const crypto = require('crypto');
const prisma = require('../db');
const { confirmDepositManually } = require('../services/wallet.service');

async function getCoinUsdPrice(coinId) {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
  );
  const data = await res.json();
  return data[coinId]?.usd || null;
}

async function blockcypher(req, res) {
  // Always respond 200 — never let BlockCypher retry indefinitely
  try {
    const sig = req.headers['x-blockcypher-signature'];
    if (sig && process.env.BLOCKCYPHER_TOKEN) {
      const expected = crypto
        .createHmac('sha256', process.env.BLOCKCYPHER_TOKEN)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (sig !== expected) return res.status(200).json({ received: true });
    }

    const { address, total_received, confirmations } = req.body || {};
    if (!address || !total_received || confirmations < 1) {
      return res.status(200).json({ received: true });
    }

    const deposit = await prisma.deposit.findFirst({
      where: { address, currency: 'BTC', status: { in: ['awaiting', 'partial'] } },
    });
    if (!deposit) return res.status(200).json({ received: true });

    const btcUsdPrice = await getCoinUsdPrice('bitcoin');
    if (!btcUsdPrice) return res.status(200).json({ received: true });

    const btcAmount = total_received / 1e8;
    const usdAmount = parseFloat((btcAmount * btcUsdPrice).toFixed(2));
    await confirmDepositManually(deposit.id, usdAmount, null);
  } catch (e) {
    console.error('BlockCypher webhook error:', e.message);
  }
  return res.status(200).json({ received: true });
}

async function alchemy(req, res) {
  try {
    const sig = req.headers['x-alchemy-signature'];
    if (sig && process.env.ALCHEMY_SIGNING_KEY) {
      const expected = crypto
        .createHmac('sha256', process.env.ALCHEMY_SIGNING_KEY)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (sig !== expected) return res.status(200).json({ received: true });
    }

    const activity = req.body?.event?.activity;
    if (!Array.isArray(activity)) return res.status(200).json({ received: true });

    for (const act of activity) {
      if (act.asset !== 'ETH' || act.category !== 'external') continue;
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

      const ethUsdPrice = await getCoinUsdPrice('ethereum');
      if (!ethUsdPrice) continue;

      const usdAmount = parseFloat((parseFloat(act.value) * ethUsdPrice).toFixed(2));
      await confirmDepositManually(deposit.id, usdAmount, null);
    }
  } catch (e) {
    console.error('Alchemy webhook error:', e.message);
  }
  return res.status(200).json({ received: true });
}

module.exports = { blockcypher, alchemy };
