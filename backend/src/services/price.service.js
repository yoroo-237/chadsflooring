// Live USD price of a coin. Shared by the deposit webhooks (crediting) and the
// admin deposit inspection endpoints, so both always use the same price source.

const COINGECKO_ID = {
  BTC:  'bitcoin',
  LTC:  'litecoin',
  DOGE: 'dogecoin',
  ETH:  'ethereum',
  XMR:  'monero',
};

const SYMBOL = Object.fromEntries(Object.entries(COINGECKO_ID).map(([sym, id]) => [id, sym]));
// Kraken's pair names (XBT is Bitcoin, XDG Dogecoin)
const KRAKEN_PAIR = { BTC: 'XBTUSD', LTC: 'LTCUSD', DOGE: 'XDGUSD', ETH: 'ETHUSD', XMR: 'XMRUSD' };

// Three keyless sources, tried in turn: CoinGecko often throttles servers that share an IP
// (Railway), CoinCap's free API is gone, Coinbase and Kraken answer reliably.
async function getCoinUsdPrice(coinId) {
  const sym = SYMBOL[coinId];
  const sources = [
    async () => {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { signal: AbortSignal.timeout(6000) });
      return (await r.json())?.[coinId]?.usd;
    },
    async () => {
      if (!sym || sym === 'XMR') return null; // not listed on Coinbase
      const r = await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`, { signal: AbortSignal.timeout(6000) });
      return parseFloat((await r.json())?.data?.amount);
    },
    async () => {
      if (!KRAKEN_PAIR[sym]) return null;
      const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${KRAKEN_PAIR[sym]}`, { signal: AbortSignal.timeout(6000) });
      const result = (await r.json())?.result;
      return result ? parseFloat(Object.values(result)[0]?.c?.[0]) : null;
    },
  ];
  for (const source of sources) {
    try {
      const price = Number(await source());
      if (price > 0) return price;
    } catch { /* next source */ }
  }
  return null;
}

function fetchCurrencyUsdPrice(currency) {
  const id = COINGECKO_ID[currency];
  return id ? getCoinUsdPrice(id) : Promise.resolve(null);
}

// The live price, or the last one known if every source is down right now
function getCurrencyUsdPrice(currency) {
  return getCachedUsdPrice(currency);
}

// Cached prices for valuing balances. Wallet views poll often, so live prices are
// shared for PRICE_TTL_MS; a stale price is still served if both APIs are down,
// since a briefly outdated valuation beats showing no balance at all.
const PRICE_TTL_MS = 45 * 1000;
const priceCache = {}; // currency -> { price, at }

async function getCachedUsdPrice(currency) {
  const hit = priceCache[currency];
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.price;
  const price = await fetchCurrencyUsdPrice(currency);
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
