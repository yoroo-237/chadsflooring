// Live USD price of a coin. Shared by the deposit webhooks (crediting) and the
// admin deposit inspection endpoints, so both always use the same price source.

const COINGECKO_ID = {
  BTC:  'bitcoin',
  LTC:  'litecoin',
  DOGE: 'dogecoin',
  ETH:  'ethereum',
  XMR:  'monero',
};

const COINCAP_ID = { bitcoin: 'bitcoin', litecoin: 'litecoin', dogecoin: 'dogecoin', ethereum: 'ethereum', monero: 'monero' };

async function getCoinUsdPrice(coinId) {
  // Primary: CoinGecko
  try {
    const res  = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const price = data[coinId]?.usd;
    if (price) return price;
  } catch { /* fall through to backup */ }

  // Fallback: CoinCap (no API key required)
  try {
    const capId = COINCAP_ID[coinId] || coinId;
    const res  = await fetch(`https://api.coincap.io/v2/assets/${capId}`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const price = parseFloat(data?.data?.priceUsd);
    if (price > 0) return price;
  } catch { /* both failed */ }

  return null;
}

function getCurrencyUsdPrice(currency) {
  const id = COINGECKO_ID[currency];
  return id ? getCoinUsdPrice(id) : Promise.resolve(null);
}

// Cached prices for valuing balances. Wallet views poll often, so live prices are
// shared for PRICE_TTL_MS; a stale price is still served if both APIs are down,
// since a briefly outdated valuation beats showing no balance at all.
const PRICE_TTL_MS = 45 * 1000;
const priceCache = {}; // currency -> { price, at }

async function getCachedUsdPrice(currency) {
  const hit = priceCache[currency];
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.price;
  const price = await getCurrencyUsdPrice(currency);
  if (price) {
    priceCache[currency] = { price, at: Date.now() };
    return price;
  }
  return hit?.price ?? null;
}

async function getCachedUsdPrices(currencies = Object.keys(COINGECKO_ID)) {
  const list = [...new Set(currencies)];
  const prices = await Promise.all(list.map(getCachedUsdPrice));
  return Object.fromEntries(list.map((c, i) => [c, prices[i]]));
}

module.exports = { COINGECKO_ID, getCoinUsdPrice, getCurrencyUsdPrice, getCachedUsdPrice, getCachedUsdPrices };
