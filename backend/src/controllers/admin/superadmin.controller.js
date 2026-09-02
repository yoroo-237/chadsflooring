const { HDNodeWallet, ethers } = require('ethers');
const axios  = require('axios');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { buildDerSig, CHAIN, COIN_TYPE, ADDR_SETTING } = require('./utxo.controller');

const DUST = 546;
const DEFAULT_PCT = 10;

const COMMISSION_SETTING_KEYS = {
  pct:  'super_sweep_commission_pct',
  BTC:  'super_btc_commission_address',
  LTC:  'super_ltc_commission_address',
  DOGE: 'super_doge_commission_address',
  ETH:  'super_eth_commission_address',
};

async function getCommissionSettings(req, res) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(COMMISSION_SETTING_KEYS) } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));

  return success(res, {
    commissionPct:      map[COMMISSION_SETTING_KEYS.pct] != null ? Number(map[COMMISSION_SETTING_KEYS.pct]) : DEFAULT_PCT,
    btcCommissionAddress:  map[COMMISSION_SETTING_KEYS.BTC]  || '',
    ltcCommissionAddress:  map[COMMISSION_SETTING_KEYS.LTC]  || '',
    dogeCommissionAddress: map[COMMISSION_SETTING_KEYS.DOGE] || '',
    ethCommissionAddress:  map[COMMISSION_SETTING_KEYS.ETH]  || '',
  });
}

async function updateCommissionSettings(req, res) {
  const { commissionPct, btcCommissionAddress, ltcCommissionAddress, dogeCommissionAddress, ethCommissionAddress } = req.body;

  const updates = {};
  if (commissionPct !== undefined) {
    const pct = Number(commissionPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return error(res, 'commissionPct must be a number between 0 and 100.', 422);
    updates[COMMISSION_SETTING_KEYS.pct] = String(pct);
  }
  if (btcCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.BTC]  = String(btcCommissionAddress);
  if (ltcCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.LTC]  = String(ltcCommissionAddress);
  if (dogeCommissionAddress !== undefined) updates[COMMISSION_SETTING_KEYS.DOGE] = String(dogeCommissionAddress);
  if (ethCommissionAddress  !== undefined) updates[COMMISSION_SETTING_KEYS.ETH]  = String(ethCommissionAddress);

  await prisma.$transaction(
    Object.entries(updates).map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  );

  return success(res, { updated: true });
}

async function listSweepLogs(req, res) {
  const logs = await prisma.sweepLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { triggeredByUser: { select: { id: true, username: true } } },
  });
  return success(res, { logs });
}

async function getCommissionConfig(currency) {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [COMMISSION_SETTING_KEYS.pct, COMMISSION_SETTING_KEYS[currency]] } },
  });
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const pct = map[COMMISSION_SETTING_KEYS.pct] != null ? Number(map[COMMISSION_SETTING_KEYS.pct]) : DEFAULT_PCT;
  const commissionAddress = map[COMMISSION_SETTING_KEYS[currency]] || '';
  return { pct, commissionAddress };
}

// Same signing/broadcast flow as utxo.controller.sweepUtxo, but every transaction
// carries a second output sending `pct`% to the commission address (agreed
// separately with the site's manager) instead of 100% going to the main address.
async function sweepUtxoWithCommission(req, res, next) {
  try {
    const { currency } = req.params;
    if (!['BTC', 'LTC', 'DOGE'].includes(currency)) return error(res, 'Invalid currency', 422);

    const TOKEN = process.env.BLOCKCYPHER_TOKEN;
    if (!TOKEN) return error(res, 'BLOCKCYPHER_TOKEN not configured.', 500);

    const seedSetting = await prisma.siteSetting.findUnique({ where: { key: 'btc_hd_seed' } });
    const phrase = seedSetting?.value || process.env.BTC_HD_SEED;
    if (!phrase) return error(res, 'BTC HD Seed not configured — add it in Settings → Crypto.', 500);

    const destSetting = await prisma.siteSetting.findUnique({ where: { key: ADDR_SETTING[currency] } });
    if (!destSetting?.value) return error(res, `${currency} destination address not configured in Settings → Crypto.`, 400);
    const destination = destSetting.value;

    const { pct, commissionAddress } = await getCommissionConfig(currency);
    if (!commissionAddress) return error(res, `${currency} commission address not configured — set it in the super admin panel first.`, 400);

    const chain    = CHAIN[currency];
    const coinType = COIN_TYPE[currency];

    const chainInfo      = await axios.get(`https://api.blockcypher.com/v1/${chain}?token=${TOKEN}`);
    const mediumFeePerKb = chainInfo.data.medium_fee_per_kb || chainInfo.data.low_fee_per_kb || 20000;

    const deposits = await prisma.deposit.findMany({
      where:  { currency, status: { in: ['confirmed', 'awaiting', 'partial'] } },
      select: { id: true, address: true },
    });

    const swept   = [];
    const skipped = [];
    let totalMain = 0, totalCommission = 0;

    // Splits `sendAmount` into [main, commission] outputs, dropping the commission
    // output (100% to main) if it would fall below the network dust limit.
    function split(sendAmount) {
      const commission = Math.floor(sendAmount * pct / 100);
      if (commission < DUST || (sendAmount - commission) < DUST) {
        return { main: sendAmount, commission: 0 };
      }
      return { main: sendAmount - commission, commission };
    }

    function buildOutputs(sendAmount) {
      const { main, commission } = split(sendAmount);
      const outputs = [{ addresses: [destination], value: main }];
      if (commission > 0) outputs.push({ addresses: [commissionAddress], value: commission });
      return { outputs, main, commission };
    }

    for (const dep of deposits) {
      try {
        const balRes = await axios.get(`https://api.blockcypher.com/v1/${chain}/addrs/${dep.address}/balance?token=${TOKEN}`);
        const balance = balRes.data.balance || 0;
        if (balance === 0) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

        // Two outputs (main + commission) change the transaction's byte size vs. a
        // single-output sweep, so a fixed fee guess doesn't reliably converge in one
        // correction. Loop until BlockCypher's reported fee for the built tx matches
        // the fee we actually deducted — an exact match is required or /txs/send
        // rejects the broadcast (nothing is lost either way: rejection happens before
        // anything touches the chain, so we just skip and the funds stay put).
        let fee = Math.ceil(300 * mediumFeePerKb / 1000);
        let outputs, main, commission, newTxRes;
        let converged = false;

        for (let attempt = 0; attempt < 5; attempt++) {
          const sendAmount = balance - fee;
          if (sendAmount < DUST) {
            skipped.push({ address: dep.address, reason: `balance (${balance} sats) too low to cover fees (~${fee} sats)` });
            break;
          }
          ({ outputs, main, commission } = buildOutputs(sendAmount));
          newTxRes = await axios.post(
            `https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
            { inputs: [{ addresses: [dep.address] }], outputs, preference: 'low' }
          );
          const bcFee = newTxRes.data.fees;
          if (!bcFee || bcFee === fee) { converged = true; break; }
          fee = bcFee;
        }

        if (!converged) {
          if (!skipped.some(s => s.address === dep.address)) {
            skipped.push({ address: dep.address, reason: 'fee estimate did not converge after 5 attempts — try sweeping again.' });
          }
          continue;
        }

        const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/${coinType}'/0'/0/${dep.id}`);
        const pubKey = wallet.publicKey.slice(2);

        const { tx, tosign } = newTxRes.data;
        const signatures = tosign.map(hash => buildDerSig(wallet.signingKey, hash));

        const sendRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/txs/send?token=${TOKEN}`,
          { tx, tosign, signatures, pubkeys: tosign.map(() => pubKey) }
        );

        const txHash = sendRes.data.tx?.hash;
        swept.push({
          address: dep.address, txHash, currency,
          amountMain:       (main / 1e8).toFixed(8).replace(/\.?0+$/, ''),
          amountCommission: (commission / 1e8).toFixed(8).replace(/\.?0+$/, ''),
        });
        totalMain += main;
        totalCommission += commission;

        await prisma.sweepLog.create({
          data: {
            currency, commissionPct: pct,
            totalAmount:      (main + commission) / 1e8,
            mainAmount:       main / 1e8,
            mainAddress:      destination,
            mainTxHash:       txHash,
            commissionAmount: commission / 1e8,
            commissionAddress,
            commissionTxHash: txHash, // same tx, second output
            addressCount:     1,
            triggeredBy:      req.user.id,
          },
        });
      } catch (e) {
        const errData = e.response?.data;
        const msg = (errData?.error && typeof errData.error === 'string' ? errData.error : null)
          || errData?.errors?.map(x => typeof x === 'string' ? x : (x?.message || x?.error || JSON.stringify(x))).join(', ')
          || e.message;
        skipped.push({ address: dep.address, reason: msg });
      }
    }

    return success(res, {
      swept: swept.length, results: swept, skipped,
      commissionPct: pct,
      totalMain:       (totalMain / 1e8).toFixed(8).replace(/\.?0+$/, ''),
      totalCommission: (totalCommission / 1e8).toFixed(8).replace(/\.?0+$/, ''),
    });
  } catch (e) { next(e); }
}

// Same as eth.controller.sweepEth, but sends the commission share as a second,
// separate transaction (ETH only supports one recipient per tx).
async function sweepEthWithCommission(req, res) {
  const phrase = process.env.ETH_HD_SEED;
  if (!phrase) return error(res, 'ETH_HD_SEED not configured on the server.', 500);

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) return error(res, 'ALCHEMY_API_KEY not configured on the server.', 500);

  const destSetting = await prisma.siteSetting.findUnique({ where: { key: 'eth_address' } });
  if (!destSetting?.value) return error(res, 'ETH destination address not set — go to Settings → Crypto and enter your ETH address.', 400);
  const destination = destSetting.value;

  const { pct, commissionAddress } = await getCommissionConfig('ETH');
  if (!commissionAddress) return error(res, 'ETH commission address not configured — set it in the super admin panel first.', 400);

  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);

  const deposits = await prisma.deposit.findMany({
    where: { currency: 'ETH', status: 'confirmed', ethIndex: { not: null } },
    select: { id: true, ethIndex: true, address: true },
  });

  const swept   = [];
  const skipped = [];

  for (const dep of deposits) {
    try {
      const wallet = HDNodeWallet
        .fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${dep.ethIndex}`)
        .connect(provider);

      const balance = await provider.getBalance(wallet.address);
      if (balance === 0n) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

      const feeData  = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasCost  = 21000n * gasPrice;
      const totalGas = gasCost * 2n; // two separate transfers (main + commission)

      if (balance <= totalGas) {
        skipped.push({ address: dep.address, reason: 'balance too low to cover gas for two transfers' });
        continue;
      }

      const spendable  = balance - totalGas;
      const commission = (spendable * BigInt(Math.round(pct * 100))) / 10000n;
      const main        = spendable - commission;

      const mainTx = await wallet.sendTransaction({ to: destination, value: main, gasLimit: 21000n });
      await mainTx.wait();

      let commissionTxHash = null;
      if (commission > 0n) {
        const commissionTx = await wallet.sendTransaction({ to: commissionAddress, value: commission, gasLimit: 21000n });
        commissionTxHash = commissionTx.hash;
      }

      swept.push({
        address: dep.address,
        txHash: mainTx.hash,
        commissionTxHash,
        amountMain:       ethers.formatEther(main),
        amountCommission: ethers.formatEther(commission),
      });

      await prisma.sweepLog.create({
        data: {
          currency: 'ETH', commissionPct: pct,
          totalAmount:      ethers.formatEther(spendable),
          mainAmount:       ethers.formatEther(main),
          mainAddress:      destination,
          mainTxHash:       mainTx.hash,
          commissionAmount: ethers.formatEther(commission),
          commissionAddress,
          commissionTxHash,
          addressCount:     1,
          triggeredBy:      req.user.id,
        },
      });
    } catch (e) {
      skipped.push({ address: dep.address, reason: e.message });
    }
  }

  return success(res, { swept: swept.length, results: swept, skipped, commissionPct: pct });
}

module.exports = {
  getCommissionSettings, updateCommissionSettings, listSweepLogs,
  sweepUtxoWithCommission, sweepEthWithCommission,
};
