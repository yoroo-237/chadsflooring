const { HDNodeWallet } = require('ethers');
const axios  = require('axios');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');

// Build a canonical DER-encoded Bitcoin signature (+ SIGHASH_ALL 0x01).
// Uses ethers.js SigningKey.sign() which already applies low-S normalisation.
function buildDerSig(signingKey, hashHex) {
  const sig = signingKey.sign(Buffer.from(hashHex, 'hex'));

  function derInt(hexWith0x) {
    let b = Buffer.from(hexWith0x.slice(2), 'hex');
    let i = 0; while (i < b.length - 1 && b[i] === 0) i++;
    b = b.slice(i);
    if (b[0] >= 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
    return Buffer.concat([Buffer.from([0x02, b.length]), b]);
  }

  const rEnc = derInt(sig.r);
  const sEnc = derInt(sig.s);
  const body = Buffer.concat([rEnc, sEnc]);
  return Buffer.concat([Buffer.from([0x30, body.length]), body]).toString('hex') + '01';
}

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

    const chainInfo      = await axios.get(`https://api.blockcypher.com/v1/${chain}?token=${TOKEN}`);
    const mediumFeePerKb = chainInfo.data.medium_fee_per_kb || chainInfo.data.low_fee_per_kb || 20000;

    const deposits = await prisma.deposit.findMany({
      where:  { currency, status: 'confirmed' },
      select: { id: true, address: true },
    });

    const swept   = [];
    const skipped = [];

    for (const dep of deposits) {
      try {
        const balRes  = await axios.get(`https://api.blockcypher.com/v1/${chain}/addrs/${dep.address}/balance?token=${TOKEN}`);
        // BlockCypher: `balance` = confirmed UTXOs only; `final_balance` includes unconfirmed.
        // We only spend confirmed UTXOs to avoid double-spend race conditions.
        const balance = balRes.data.balance || 0;
        if (balance === 0) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

        // Conservative first-pass estimate: 300 vBytes × medium fee rate
        const estimatedFee = Math.ceil(300 * mediumFeePerKb / 1000);
        let sendAmount = balance - estimatedFee;
        if (sendAmount < 546) {
          skipped.push({ address: dep.address, reason: `balance (${balance} sats) too low to cover fees (~${estimatedFee} sats)` });
          continue;
        }

        // Derive private key for this deposit address
        const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${dep.id}`);
        const pubKey = wallet.publicKey.slice(2); // compressed pubkey — matches deriveUtxoAddress

        // Build unsigned transaction via BlockCypher (first pass)
        let newTxRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
          { inputs: [{ addresses: [dep.address] }], outputs: [{ addresses: [destination], value: sendAmount }], preference: 'low' }
        );

        // Second pass: use BlockCypher's actual reported fee to avoid fund-mismatch at broadcast
        const bcFee = newTxRes.data.fees;
        if (bcFee && bcFee > 0 && Math.abs(bcFee - estimatedFee) > 100) {
          const adjusted = balance - bcFee;
          if (adjusted < 546) {
            skipped.push({ address: dep.address, reason: `balance (${balance} sats) too low to cover BlockCypher fees (${bcFee} sats)` });
            continue;
          }
          sendAmount = adjusted;
          newTxRes = await axios.post(
            `https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
            { inputs: [{ addresses: [dep.address] }], outputs: [{ addresses: [destination], value: sendAmount }], preference: 'low' }
          );
        }

        const { tx, tosign } = newTxRes.data;

        // Sign each hash — buildDerSig uses ethers SigningKey (low-S) + manual DER encoding
        const signatures = tosign.map(hash => buildDerSig(wallet.signingKey, hash));

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
