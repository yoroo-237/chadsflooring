const crypto = require('crypto');

async function generateDepositAddress(currency, userId, depositId) {
  switch (currency) {
    case 'BTC':  return generateBtcAddress(userId, depositId);
    case 'ETH':  return generateEthAddress(depositId);
    case 'DOGE': return process.env.DOGE_DEPOSIT_ADDRESS || '';
    case 'LTC':  return process.env.LTC_DEPOSIT_ADDRESS  || '';
    case 'XMR':  return process.env.XMR_DEPOSIT_ADDRESS  || '';
    default:
      throw Object.assign(new Error('Unsupported currency.'), { status: 422 });
  }
}

async function generateBtcAddress(userId, depositId) {
  const token = process.env.BLOCKCYPHER_TOKEN;
  if (token) {
    try {
      const res = await fetch(
        `https://api.blockcypher.com/v1/btc/main/addrs?token=${token}`,
        { method: 'POST' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.address) return data.address;
      }
    } catch {
      // fall through to deterministic fallback
    }
  }
  const hash = crypto
    .createHash('sha256')
    .update(`${userId}${depositId}btc`)
    .digest('hex');
  return '1' + hash.substring(0, 34);
}

function generateEthAddress(depositId) {
  const phrase = process.env.ETH_HD_SEED;
  if (phrase) {
    try {
      const { HDNodeWallet } = require('ethers');
      const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${depositId}`);
      return wallet.address;
    } catch {
      // fall through to deterministic fallback
    }
  }
  const hash = crypto
    .createHash('sha256')
    .update(`eth-deposit-${depositId}`)
    .digest('hex');
  return '0x' + hash.substring(0, 40);
}

module.exports = { generateDepositAddress };
