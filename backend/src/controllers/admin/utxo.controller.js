const { HDNodeWallet, SigningKey } = require('ethers');
const axios  = require('axios');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');

const CHAIN       = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const COIN_TYPE   = { BTC: 0, LTC: 2, DOGE: 3 };
const ADDR_SETTING = { BTC: 'btc_address', LTC: 'ltc_address', DOGE: 'doge_address' };

// secp256k1 curve order — used for low-S normalization (BIP62)
const SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;

// Convert an ethers Signature to Bitcoin DER format with SIGHASH_ALL (0x01) appended.
function toDerSignature(sig) {
  let s = BigInt(sig.s);
  // BIP62: use the lower of s and n-s
  if (s > SECP256K1_N / 2n) s = SECP256K1_N - s;

  let rBuf = Buffer.from(BigInt(sig.r).toString(16).padStart(64, '0'), 'hex');
  let sBuf = Buffer.from(s.toString(16).padStart(64, '0'), 'hex');

  // Trim unnecessary leading zero bytes (DER integers must be minimal)
  while (rBuf.length > 1 && rBuf[0] === 0x00) rBuf = rBuf.slice(1);
  while (sBuf.length > 1 && sBuf[0] === 0x00) sBuf = sBuf.slice(1);
  // If high bit is set, prepend 0x00 so it's not read as a negative number
  if (rBuf[0] & 0x80) rBuf = Buffer.concat([Buffer.from([0x00]), rBuf]);
  if (sBuf[0] & 0x80) sBuf = Buffer.concat([Buffer.from([0x00]), sBuf]);

  const seq = Buffer.concat([
    Buffer.from([0x02, rBuf.length]), rBuf,
    Buffer.from([0x02, sBuf.length]), sBuf,
  ]);
  return Buffer.concat([Buffer.from([0x30, seq.length]), seq, Buffer.from([0x01])]).toString('hex');
}

async function sweepUtxo(req, res, next) {
  try {
    const { currency } = req.params;
    if (!['BTC', 'LTC', 'DOGE'].includes(currency)) return error(res, 'Invalid currency', 422);

    const TOKEN = process.env.BLOCKCYPHER_TOKEN;
    if (!TOKEN) return error(res, 'BLOCKCYPHER_TOKEN not configured.', 500);

    // Seed from DB (admin settings) takes priority over env var
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

    // Fetch chain fee data once
    const chainInfo  = await axios.get(`https://api.blockcypher.com/v1/${chain}?token=${TOKEN}`);
    const lowFeePerKb = chainInfo.data.low_fee_per_kb || 10000;

    const deposits = await prisma.deposit.findMany({
      where:  { currency, status: 'confirmed' },
      select: { id: true, address: true },
    });

    const swept   = [];
    const skipped = [];

    for (const dep of deposits) {
      try {
        // Check address balance
        const balRes  = await axios.get(`https://api.blockcypher.com/v1/${chain}/addrs/${dep.address}/balance?token=${TOKEN}`);
        const balance = balRes.data.balance || 0;
        if (balance === 0) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

        // Fee estimate: P2PKH single-input sweep ≈ 192 bytes
        const estimatedFee = Math.ceil(192 * lowFeePerKb / 1000);
        const sendAmount   = balance - estimatedFee;
        if (sendAmount < 546) { // below dust threshold
          skipped.push({ address: dep.address, reason: `balance (${balance} sats) too low to cover fees (~${estimatedFee} sats)` });
          continue;
        }

        // Derive private key for this deposit address
        const wallet     = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${dep.id}`);
        const signingKey = new SigningKey(wallet.privateKey);
        const pubKey     = wallet.publicKey.slice(2); // compressed hex, no 0x

        // Build unsigned transaction via BlockCypher
        const newTxRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
          { inputs: [{ addresses: [dep.address] }], outputs: [{ addresses: [destination], value: sendAmount }], preference: 'low' }
        );
        const { tx, tosign } = newTxRes.data;

        // Sign each input hash and DER-encode
        const signatures = tosign.map(hash => toDerSignature(signingKey.sign(Buffer.from(hash, 'hex'))));

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
        const msg = e.response?.data?.error || e.response?.data?.errors?.join(', ') || e.message;
        skipped.push({ address: dep.address, reason: msg });
      }
    }

    return success(res, { swept: swept.length, results: swept, skipped });
  } catch (e) { next(e); }
}

module.exports = { sweepUtxo };
