const { HDNodeWallet, ethers } = require('ethers');
const axios  = require('axios');
const prisma = require('../db');
const { buildDerSig, CHAIN, COIN_TYPE, ADDR_SETTING } = require('../controllers/admin/utxo.controller');

// Two independent sweeps share the same deposit addresses:
//   'shop'    (admin)       — the customer-credited share (Deposit.netAmount) → shop address
//   'reserve' (super admin) — the deposit commission (Deposit.commissionAmount) → reserve address
// Each sweep sends only its own share and leaves the other one on the address
// (BlockCypher returns the change to the input address), so the order in which
// they run doesn't matter. Each pays its own network fee out of its share.

const DUST = 546;
const RESERVE_ADDRESS_KEY = {
  BTC: 'super_btc_commission_address', LTC: 'super_ltc_commission_address',
  DOGE: 'super_doge_commission_address', ETH: 'super_eth_commission_address',
};
const SHOP_ADDRESS_KEY = { ...ADDR_SETTING, ETH: 'eth_address' };

const toSats = n => Math.round(parseFloat(n) * 1e8);
const fmt8 = sats => (sats / 1e8).toFixed(8).replace(/\.?0+$/, '') || '0';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

async function getSetting(key) {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return row?.value || '';
}

async function getDestination(kind, currency) {
  const address = await getSetting(kind === 'shop' ? SHOP_ADDRESS_KEY[currency] : RESERVE_ADDRESS_KEY[currency]);
  if (!address) {
    throw fail(kind === 'shop'
      ? `${currency} destination address not configured in Settings → Crypto.`
      : `${currency} reserve fund address not configured — set it in the super admin panel.`);
  }
  return address;
}

function eligibleWhere(kind, currency) {
  return kind === 'shop'
    ? { currency, status: 'confirmed', shopSweptAt: null }
    : { currency, status: 'confirmed', reserveSweptAt: null, commissionAmount: { gt: 0 } };
}

// How much of the address balance this sweep must leave behind for the other one.
// Shares below dust can't be left as change, so they go with this sweep and the
// other share is marked as settled ('dust').
function amountToKeep(kind, dep, balance, unit) {
  const commission = unit(dep.commissionAmount);
  let keep;
  if (kind === 'shop') keep = dep.reserveSweptAt ? 0 : commission;
  else keep = dep.shopSweptAt ? 0 : Math.max(0, balance - commission);
  return keep;
}

function sweptFields(kind, txHash) {
  return kind === 'shop'
    ? { shopSweptAt: new Date(), shopSweepTx: txHash }
    : { reserveSweptAt: new Date(), reserveSweepTx: txHash };
}

function otherSettled(kind) {
  return kind === 'shop'
    ? { reserveSweptAt: new Date(), reserveSweepTx: 'dust' }
    : { shopSweptAt: new Date(), shopSweepTx: 'dust' };
}

async function logSweep({ kind, currency, amount, destination, txHash, userId, pct }) {
  return prisma.sweepLog.create({
    data: {
      kind, currency,
      commissionPct:    pct,
      totalAmount:      amount,
      mainAmount:       kind === 'shop' ? amount : 0,
      mainAddress:      kind === 'shop' ? destination : '',
      mainTxHash:       kind === 'shop' ? txHash : null,
      commissionAmount: kind === 'reserve' ? amount : 0,
      commissionAddress: kind === 'reserve' ? destination : '',
      commissionTxHash: kind === 'reserve' ? txHash : null,
      addressCount:     1,
      triggeredBy:      userId,
    },
  });
}

function errorMessage(e) {
  const errData = e.response?.data;
  return (errData?.error && typeof errData.error === 'string' ? errData.error : null)
    || errData?.errors?.map(x => typeof x === 'string' ? x : (x?.message || x?.error || JSON.stringify(x))).join(', ')
    || e.message;
}

async function sweepUtxo(kind, currency, userId) {
  if (!['BTC', 'LTC', 'DOGE'].includes(currency)) throw fail('Invalid currency', 422);

  const TOKEN = process.env.BLOCKCYPHER_TOKEN;
  if (!TOKEN) throw fail('BLOCKCYPHER_TOKEN not configured.', 500);

  const phrase = await getSetting('btc_hd_seed') || process.env.BTC_HD_SEED;
  if (!phrase) throw fail('BTC HD Seed not configured — add it in Settings → Crypto.', 500);

  const destination = await getDestination(kind, currency);
  const chain    = CHAIN[currency];
  const coinType = COIN_TYPE[currency];

  const chainInfo      = await axios.get(`https://api.blockcypher.com/v1/${chain}?token=${TOKEN}`);
  const mediumFeePerKb = chainInfo.data.medium_fee_per_kb || chainInfo.data.low_fee_per_kb || 20000;

  const deposits = await prisma.deposit.findMany({ where: eligibleWhere(kind, currency) });

  const swept = [];
  const skipped = [];
  let total = 0;

  for (const dep of deposits) {
    try {
      const balRes  = await axios.get(`https://api.blockcypher.com/v1/${chain}/addrs/${dep.address}/balance?token=${TOKEN}`);
      const balance = balRes.data.balance || 0;
      if (balance === 0) {
        // Deposits credited before commissions existed and already emptied: settle them
        // so they stop being queried on every sweep.
        if (kind === 'shop' && toSats(dep.commissionAmount) === 0) {
          await prisma.deposit.update({ where: { id: dep.id }, data: { shopSweptAt: new Date(), shopSweepTx: 'empty' } });
        }
        skipped.push({ address: dep.address, reason: 'empty' });
        continue;
      }

      let keep = amountToKeep(kind, dep, balance, toSats);
      let settlesOther = false;
      if (keep > 0 && keep < DUST) { keep = 0; settlesOther = true; }

      // Same fee convergence as before: BlockCypher's fee for the built transaction
      // must equal the fee we deducted, otherwise the change (= the other share)
      // would be off, or /txs/send would reject a change-less transaction.
      let fee = Math.ceil((keep > 0 ? 260 : 230) * mediumFeePerKb / 1000);
      let newTxRes, send;
      let converged = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        send = balance - keep - fee;
        if (send < DUST) break;
        newTxRes = await axios.post(
          `https://api.blockcypher.com/v1/${chain}/txs/new?token=${TOKEN}`,
          { inputs: [{ addresses: [dep.address] }], outputs: [{ addresses: [destination], value: send }], preference: 'low' }
        );
        const bcFee = newTxRes.data.fees;
        if (!bcFee || bcFee === fee) { converged = true; break; }
        fee = bcFee;
      }
      if (send < DUST) {
        skipped.push({ address: dep.address, reason: `share too small to cover the network fee (~${fee} sats)` });
        continue;
      }
      if (!converged) {
        skipped.push({ address: dep.address, reason: 'fee estimate did not converge after 5 attempts — try sweeping again.' });
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

      await prisma.deposit.update({
        where: { id: dep.id },
        data:  { ...sweptFields(kind, txHash), ...(settlesOther ? otherSettled(kind) : {}) },
      });
      await logSweep({ kind, currency, amount: send / 1e8, destination, txHash, userId, pct: dep.commissionPct });

      swept.push({ address: dep.address, txHash, currency, amount: fmt8(send), fee: fmt8(fee) });
      total += send;
    } catch (e) {
      skipped.push({ address: dep.address, reason: errorMessage(e) });
    }
  }

  return { kind, currency, swept: swept.length, results: swept, skipped, total: fmt8(total) };
}

async function sweepEth(kind, userId) {
  const phrase = process.env.ETH_HD_SEED;
  if (!phrase) throw fail('ETH_HD_SEED not configured on the server.', 500);
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw fail('ALCHEMY_API_KEY not configured on the server.', 500);

  const destination = await getDestination(kind, 'ETH');
  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);
  const toWei = n => ethers.parseEther(parseFloat(n).toFixed(8));

  const deposits = await prisma.deposit.findMany({
    where: { ...eligibleWhere(kind, 'ETH'), ethIndex: { not: null } },
  });

  const swept = [];
  const skipped = [];
  let total = 0n;

  for (const dep of deposits) {
    try {
      const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${dep.ethIndex}`).connect(provider);
      const balance = await provider.getBalance(wallet.address);
      if (balance === 0n) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

      const feeData  = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasCost  = 21000n * gasPrice;

      const commission = toWei(dep.commissionAmount);
      let keep;
      if (kind === 'shop') keep = dep.reserveSweptAt ? 0n : commission;
      else keep = dep.shopSweptAt ? 0n : (balance > commission ? balance - commission : 0n);

      const value = balance - keep - gasCost;
      if (value <= 0n) {
        skipped.push({ address: dep.address, reason: 'share too small to cover gas' });
        continue;
      }

      const sent = await wallet.sendTransaction({ to: destination, value, gasLimit: 21000n });
      await sent.wait();

      await prisma.deposit.update({ where: { id: dep.id }, data: sweptFields(kind, sent.hash) });
      await logSweep({ kind, currency: 'ETH', amount: ethers.formatEther(value), destination, txHash: sent.hash, userId, pct: dep.commissionPct });

      swept.push({ address: dep.address, txHash: sent.hash, currency: 'ETH', amount: ethers.formatEther(value) });
      total += value;
    } catch (e) {
      skipped.push({ address: dep.address, reason: e.message });
    }
  }

  return { kind, currency: 'ETH', swept: swept.length, results: swept, skipped, total: ethers.formatEther(total) };
}

// Unswept amounts per currency, as recorded at deposit time.
async function pendingTotals(kind) {
  const field = kind === 'shop' ? 'netAmount' : 'commissionAmount';
  const rows = await prisma.deposit.groupBy({
    by: ['currency'],
    where: kind === 'shop'
      ? { status: 'confirmed', shopSweptAt: null }
      : { status: 'confirmed', reserveSweptAt: null, commissionAmount: { gt: 0 } },
    _sum: { [field]: true },
    _count: { _all: true },
  });
  return rows.map(r => ({ currency: r.currency, amount: parseFloat(r._sum[field] || 0), deposits: r._count._all }));
}

module.exports = { sweepUtxo, sweepEth, pendingTotals, RESERVE_ADDRESS_KEY };
