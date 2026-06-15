const axios  = require('axios');
const { HDNodeWallet } = require('ethers');
const prisma = require('../db');

const TOKEN        = process.env.BLOCKCYPHER_TOKEN;
const PUBLIC_URL   = process.env.RAILWAY_PUBLIC_URL;
const CALLBACK_URL = PUBLIC_URL ? `${PUBLIC_URL}/api/webhooks/blockcypher` : null;

const CHAIN    = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const ADDR_KEY = { BTC: 'btc_address', LTC: 'ltc_address', DOGE: 'doge_address' };

async function getSetting(key) {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value || null;
}

async function generateDepositAddress(currency, depositId) {
  switch (currency) {
    case 'BTC':
    case 'LTC':
    case 'DOGE': {
      if (!TOKEN) throw Object.assign(
        new Error('BLOCKCYPHER_TOKEN not configured on the server.'),
        { status: 500 }
      );
      if (!CALLBACK_URL) throw Object.assign(
        new Error('RAILWAY_PUBLIC_URL not configured — cannot register BlockCypher webhook.'),
        { status: 500 }
      );

      const destination = await getSetting(ADDR_KEY[currency]);
      if (!destination) throw Object.assign(
        new Error(`${currency} destination address not set — go to Admin → Settings → Crypto and enter your ${currency} wallet address.`),
        { status: 500 }
      );

      const chain = CHAIN[currency];
      let fwdRes;
      try {
        fwdRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/forwards?token=${TOKEN}`,
          { destination, callback_url: CALLBACK_URL }
        );
      } catch (e) {
        const msg = e.response?.data?.error || e.response?.data?.errors?.join(', ') || e.message;
        throw Object.assign(new Error(`BlockCypher error: ${msg}`), { status: 502 });
      }

      return {
        address:  fwdRes.data.input_address,
        hookId:   fwdRes.data.id,
        ethIndex: null,
      };
    }

    case 'ETH': {
      const phrase = process.env.ETH_HD_SEED;
      if (!phrase) throw Object.assign(new Error('ETH_HD_SEED not configured.'), { status: 500 });

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
      // Reads from admin settings first, falls back to env var for backwards compat
      const address = await getSetting('xmr_address') || process.env.XMR_DEPOSIT_ADDRESS;
      if (!address) throw Object.assign(
        new Error('XMR deposit address not set — go to Admin → Settings → Crypto and enter your Monero wallet address.'),
        { status: 500 }
      );
      return { address, hookId: null, ethIndex: null };
    }

    default:
      throw Object.assign(new Error('Unsupported currency.'), { status: 422 });
  }
}

async function deleteBlockCypherForwarding(currency, forwardingId) {
  const chain = CHAIN[currency];
  if (!chain || !forwardingId || !TOKEN) return;
  try {
    await axios.delete(
      `https://api.blockcypher.com/v1/${chain}/forwards/${forwardingId}?token=${TOKEN}`
    );
  } catch (e) {
    console.error(`BlockCypher forwarding delete failed (${currency} / ${forwardingId}):`, e.message);
  }
}

module.exports = { generateDepositAddress, deleteBlockCypherForwarding };
