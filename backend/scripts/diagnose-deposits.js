// Read-only diagnostic: no database write, no transaction broadcast.
// Usage (against production env): node scripts/diagnose-deposits.js 40 [otherId ...]
// With no id, checks every confirmed BTC/LTC/DOGE deposit not yet swept.
require('dotenv').config();
const axios  = require('axios');
const prisma = require('../src/db');
const { deriveUtxoAddress } = require('../src/services/crypto.service');

const CHAIN = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };

async function onchain(currency, address) {
  const token = process.env.BLOCKCYPHER_TOKEN;
  if (!token) return 'BLOCKCYPHER_TOKEN missing';
  try {
    const r = await axios.get(`https://api.blockcypher.com/v1/${CHAIN[currency]}/addrs/${address}/balance?token=${token}`, { timeout: 10000 });
    const d = r.data;
    return { confirmed: d.balance / 1e8, unconfirmed: d.unconfirmed_balance / 1e8, totalReceived: d.total_received / 1e8, txs: d.final_n_tx };
  } catch (e) { return `lookup failed: ${e.response?.data?.error || e.message}`; }
}

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  const where = ids.length
    ? { id: { in: ids } }
    : { currency: { in: Object.keys(CHAIN) }, status: 'confirmed', shopSweptAt: null };
  const deposits = await prisma.deposit.findMany({ where, orderBy: { id: 'asc' } });

  for (const d of deposits) {
    const out = {
      id: d.id, userId: d.userId, currency: d.currency, status: d.status, address: d.address,
      amountReceived: Number(d.amountReceived), usdCredited: Number(d.usdCredited),
      commission: Number(d.commissionAmount), net: Number(d.netAmount),
      shopSweptAt: d.shopSweptAt, reserveSweptAt: d.reserveSweptAt,
    };
    if (CHAIN[d.currency]) {
      try {
        const derived = await deriveUtxoAddress(d.currency, d.id);
        out.derivedAddress = derived;
        out.addressMatchesSeed = derived === d.address;
      } catch (e) { out.derivedAddress = `error: ${e.message}`; }
      out.onchain = await onchain(d.currency, d.address);
    }
    console.log(JSON.stringify(out, null, 2));
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
