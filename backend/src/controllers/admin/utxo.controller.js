const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { deriveUtxoAddress } = require('../../services/crypto.service');

// Build a canonical DER-encoded Bitcoin signature.
// BlockCypher validates signatures as raw DER (sig[1] == sig.size()-2) and appends
// the SIGHASH_ALL byte itself — do NOT append '01' here or the length check fails.
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
  return Buffer.concat([Buffer.from([0x30, body.length]), body]).toString('hex');
}

const CHAIN        = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const COIN_TYPE    = { BTC: 0, LTC: 2, DOGE: 3 };
const ADDR_SETTING = { BTC: 'btc_address', LTC: 'ltc_address', DOGE: 'doge_address' };

async function verifyAddress(req, res, next) {
  try {
    const depositId = parseInt(req.params.id);
    if (isNaN(depositId)) return error(res, 'Invalid deposit ID.', 422);

    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId },
      include: { user: { select: { id: true, username: true } } },
    });
    if (!deposit) return error(res, 'Deposit not found.', 404);
    if (!['BTC', 'LTC', 'DOGE'].includes(deposit.currency)) {
      return error(res, 'Address verification only applies to BTC / LTC / DOGE deposits.', 422);
    }

    const derivedAddress = await deriveUtxoAddress(deposit.currency, depositId);
    const match = deposit.address === derivedAddress;

    return success(res, {
      depositId,
      currency:        deposit.currency,
      storedAddress:   deposit.address,
      derivedAddress,
      match,
      user:            deposit.user,
    });
  } catch (e) { next(e); }
}

module.exports = { verifyAddress, buildDerSig, CHAIN, COIN_TYPE, ADDR_SETTING };
