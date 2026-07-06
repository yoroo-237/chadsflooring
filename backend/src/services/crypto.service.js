const axios      = require('axios');
const nodeCrypto = require('crypto');
const { HDNodeWallet } = require('ethers');
const prisma = require('../db');

const TOKEN        = process.env.BLOCKCYPHER_TOKEN;
const PUBLIC_URL   = process.env.RAILWAY_PUBLIC_URL;
const CALLBACK_URL = PUBLIC_URL ? `${PUBLIC_URL}/api/webhooks/blockcypher` : null;

const CHAIN    = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const ADDR_KEY = { BTC: 'btc_address', LTC: 'ltc_address', DOGE: 'doge_address' };

// BIP44 coin type + P2PKH version byte per chain
const UTXO_META = {
  BTC:  { coinType: 0, version: 0x00 },
  LTC:  { coinType: 2, version: 0x30 },
  DOGE: { coinType: 3, version: 0x1e },
};

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58Check(versionByte, pubKeyHash) {
  const payload  = Buffer.concat([Buffer.from([versionByte]), pubKeyHash]);
  const checksum = nodeCrypto.createHash('sha256')
    .update(nodeCrypto.createHash('sha256').update(payload).digest())
    .digest()
    .slice(0, 4);
  const full = Buffer.concat([payload, checksum]);

  let num = BigInt('0x' + full.toString('hex'));
  let str = '';
  while (num > 0n) { str = BASE58_CHARS[Number(num % 58n)] + str; num /= 58n; }
  for (const byte of full) { if (byte !== 0) break; str = '1' + str; }
  return str;
}

// Derive a unique P2PKH address from a BIP44 seed — no API call, no cost.
async function deriveUtxoAddress(currency, depositId) {
  const seedSetting = await prisma.siteSetting.findUnique({ where: { key: 'btc_hd_seed' } });
  const phrase = seedSetting?.value || process.env.BTC_HD_SEED;
  if (!phrase) throw Object.assign(
    new Error('BTC HD Seed not configured — add it in Settings → Crypto or in your .env.'),
    { status: 500 }
  );
  const { coinType, version } = UTXO_META[currency];
  const node    = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${depositId}`);
  const pubKey  = Buffer.from(node.publicKey.slice(2), 'hex'); // strip '0x'
  const sha256  = nodeCrypto.createHash('sha256').update(pubKey).digest();
  const hash160 = nodeCrypto.createHash('ripemd160').update(sha256).digest();
  return toBase58Check(version, hash160);
}

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

      const address = await deriveUtxoAddress(currency, depositId);
      const chain   = CHAIN[currency];

      let hookId;
      try {
        const res = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/hooks?token=${TOKEN}`,
          { event: 'confirmed-tx', address, url: CALLBACK_URL }
        );
        hookId = res.data.id;
      } catch (e) {
        const msg = e.response?.data?.error || e.response?.data?.errors?.join(', ') || e.message;
        throw Object.assign(new Error(`BlockCypher error: ${msg}`), { status: 502 });
      }

      return { address, hookId, ethIndex: null };
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

// Deletes a BlockCypher address webhook. Errors are logged but never thrown — a
// 404 (already deleted or expired) must not block cleanup flows.
async function deleteBlockCypherForwarding(currency, hookId) {
  const chain = CHAIN[currency];
  if (!chain || !hookId || !TOKEN) return;
  try {
    await axios.delete(
      `https://api.blockcypher.com/v1/${chain}/hooks/${hookId}?token=${TOKEN}`
    );
  } catch (e) {
    console.error(`BlockCypher hook delete failed (${currency} / ${hookId}):`, e.message);
  }
}

module.exports = { generateDepositAddress, deleteBlockCypherForwarding };
