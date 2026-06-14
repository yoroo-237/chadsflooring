const axios = require('axios');
const { HDNodeWallet } = require('ethers');

const TOKEN = process.env.BLOCKCYPHER_TOKEN;
const CALLBACK_URL = `${process.env.RAILWAY_PUBLIC_URL}/api/webhooks/blockcypher`;

const CHAIN = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };

async function generateDepositAddress(currency, depositId) {
  switch (currency) {
    case 'BTC':
    case 'LTC':
    case 'DOGE': {
      const chain = CHAIN[currency];
      const addrRes = await axios.post(
        `https://api.blockcypher.com/v1/${chain}/addrs?token=${TOKEN}`
      );
      const address = addrRes.data.address;

      let hookId = null;
      if (TOKEN) {
        try {
          const hookRes = await axios.post(
            `https://api.blockcypher.com/v1/${chain}/hooks?token=${TOKEN}`,
            {
              event:         'confirmed-tx',
              address,
              url:           CALLBACK_URL,
              confirmations: 1,
            }
          );
          hookId = hookRes.data.id || null;
        } catch (e) {
          console.error(`BlockCypher webhook register failed (${currency}):`, e.message);
        }
      }

      return { address, hookId, ethIndex: null };
    }

    case 'ETH': {
      const phrase = process.env.ETH_HD_SEED;
      if (!phrase) throw Object.assign(new Error('ETH_HD_SEED not configured'), { status: 500 });

      const wallet  = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${depositId}`);
      const address = wallet.address;

      if (process.env.ALCHEMY_AUTH_TOKEN && process.env.ALCHEMY_WEBHOOK_ID) {
        try {
          await axios.patch(
            'https://dashboard.alchemy.com/api/update-webhook-addresses',
            {
              webhook_id:          process.env.ALCHEMY_WEBHOOK_ID,
              addresses_to_add:    [address],
              addresses_to_remove: [],
            },
            { headers: { 'X-Alchemy-Token': process.env.ALCHEMY_AUTH_TOKEN } }
          );
        } catch (e) {
          console.error('Alchemy webhook address registration failed:', e.message);
        }
      }

      return { address, hookId: null, ethIndex: depositId };
    }

    case 'XMR': {
      const address = process.env.XMR_DEPOSIT_ADDRESS;
      if (!address) throw Object.assign(new Error('XMR_DEPOSIT_ADDRESS not configured'), { status: 500 });
      return { address, hookId: null, ethIndex: null };
    }

    default:
      throw Object.assign(new Error('Unsupported currency.'), { status: 422 });
  }
}

async function deleteBlockCypherWebhook(currency, hookId) {
  const chain = CHAIN[currency];
  if (!chain || !hookId || !TOKEN) return;
  try {
    await axios.delete(
      `https://api.blockcypher.com/v1/${chain}/hooks/${hookId}?token=${TOKEN}`
    );
  } catch (e) {
    console.error(`BlockCypher webhook delete failed (${currency} / ${hookId}):`, e.message);
  }
}

module.exports = { generateDepositAddress, deleteBlockCypherWebhook };
