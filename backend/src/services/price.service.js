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

module.exports = { COINGECKO_ID, getCoinUsdPrice, getCurrencyUsdPrice };
