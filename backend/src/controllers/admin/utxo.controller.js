const { secp256k1 }  = require('@noble/curves/secp256k1');
const { HDNodeWallet } = require('ethers');
const axios  = require('axios');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');

const CHAIN        = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const COIN_TYPE    = { BTC: 0, LTC: 2, DOGE: 3 };
const ADDR_SETTING = { BTC: 'btc_address', LTC: 'ltc_address', DOGE: 'doge_address' };

async function sweepUtxo(req, res, next) {
  try {
    const { currency } = req.params;
    if (!['BTC', 'LTC', 'DOGE'].includes(currency)) return error(res, 'Invalid currency', 422);

    const TOKEN = process.env.BLOCKCYPHER_TOKEN;
    if (!TOKEN) return error(res, 'BLOCKCYPHER_TOKEN not configured.', 500);

    const seedSetting = await prisma.siteSetting.findUnique({ where: { key: 'btc_hd_seed' } });
    const phrase = seedSetting?.value || process.env.BTC_HD_SEED;
    if (!phrase) return error(res, 'BTC HD Seed not configured — add it in Settings → Crypto.', 500);

    const destSetting = await prisma.siteSetting.findUnique({ where: { key: ADDR_SETTING[currency] } });
    if (!destSetting?.value) {
      return error(res, `${currency} destination address not configured in Settings → Crypto.`, 400);
    }
    const destination = destSetting.value;

    const chain    = CHAIN[currency];
    const coinType = COIN_TYPE[currency];

    const chainInfo   = await axios.get(`https://api.blockcypher.com/v1/${chain}?token=${TOKEN}`);
    const lowFeePerKb = chainInfo.data.low_fee_per_kb || 10000;

    const deposits = await prisma.deposit.findMany({
      where:  { currency, status: 'confirmed' },
      select: { id: true, address: true },
    });

    const swept   = [];
    const skipped = [];

    for (const dep of deposits) {
      try {
        const balRes  = await axios.get(`https://api.blockcypher.com/v1/${chain}/addrs/${dep.address}/balance?token=${TOKEN}`);
        const balance = balRes.data.balance || 0;
        if (balance === 0) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

        // P2PKH single-input sweep: 192 vBytes theoretical + 60 vBytes safety margin for BlockCypher
        const estimatedFee = Math.ceil(252 * lowFeePerKb / 1000);
        const sendAmount   = balance - estimatedFee;
        if (sendAmount < 546) {
          skipped.push({ address: dep.address, reason: `balance (${balance} sats) too low to cover fees (~${estimatedFee} sats)` });
          continue;
        }

        // Derive private key for this deposit address
        const wallet      = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${dep.id}`);
        const privKeyBytes = Buffer.from(wallet.privateKey.slice(2), 'hex');
        const pubKey      = wallet.publicKey.slice(2); // same key used by deriveUtxoAddress

        // Build unsigned transaction via BlockCypher
        const newTxRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
          { inputs: [{ addresses: [dep.address] }], outputs: [{ addresses: [destination], value: sendAmount }], preference: 'low' }
        );
        const { tx, tosign } = newTxRes.data;

        // Sign with @noble/curves — produces canonical DER + append SIGHASH_ALL (0x01)
        const signatures = tosign.map(hash => {
          const sig = secp256k1.sign(Buffer.from(hash, 'hex'), privKeyBytes, { lowS: true });
          return Buffer.from(sig.toDERRawBytes()).toString('hex') + '01';
        });

        // Broadcast
        const sendRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/txs/send?token=${TOKEN}`,
          { tx, tosign, signatures, pubkeys: tosign.map(() => pubKey) }
        );

        swept.push({
          address:  dep.address,
          txHash:   sendRes.data.tx?.hash,
          amount:   (sendAmount / 1e8).toFixed(8).replace(/\.?0+$/, ''),
          currency,
        });
      } catch (e) {
        const errData = e.response?.data;
        const msg = (errData?.error && typeof errData.error === 'string' ? errData.error : null)
          || errData?.errors?.map(x => typeof x === 'string' ? x : (x?.message || x?.error || JSON.stringify(x))).join(', ')
          || e.message;
        skipped.push({ address: dep.address, reason: msg });
      }
    }

    return success(res, { swept: swept.length, results: swept, skipped });
  } catch (e) { next(e); }
}

module.exports = { sweepUtxo };
