const { HDNodeWallet, ethers } = require('ethers');
const axios  = require('axios');
const prisma = require('../db');
const { CHAIN, ADDR_SETTING } = require('../controllers/admin/utxo.controller');
const { sweepDepositUtxo, isValidUtxoAddress, DUST } = require('./crypto.service');
const { getCachedUsdPrice } = require('./price.service');

// Two independent sweeps share the same deposit addresses:
//   'shop'    (admin)       — the customer-credited share (Deposit.netAmount) → shop address
//   'reserve' (super admin) — the deposit commission (Deposit.commissionAmount) → reserve address
// Each sweep sends only its own share and returns the other one to the deposit
// address as change, so the order in which they run doesn't matter. Each pays its
// own network fee out of its share. UTXO sweeps are signed here (bitcoinjs-lib),
// after checking that the derived key is the deposit address's own.
// A customer can pay the same address again after a sweep: each sweep only sends what
// is still owed to its side (netAmount - shopSweptAmount, commissionAmount - reserveSweptAmount),
// and every address is checked for new payments (credited first) before it is swept.
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

// What each side is still owed on the address (crypto)
const shopOwed    = dep => Math.max(0, parseFloat(dep.netAmount) - parseFloat(dep.shopSweptAmount || 0));
const reserveOwed = dep => Math.max(0, parseFloat(dep.commissionAmount) - parseFloat(dep.reserveSweptAmount || 0));

// How much of the address balance this sweep must leave behind for the other one (in the
// balance's unit). Shares below dust can't be left as change: they go with this sweep and
// the other side is marked as settled ('dust').
function amountToKeep(kind, dep, balance, unit) {
  if (kind === 'shop') return dep.reserveSweptAt ? 0 : unit(reserveOwed(dep));
  if (dep.shopSweptAt) return 0;
  const left = balance - unit(reserveOwed(dep));
  return left > 0 ? left : 0;
}

const sideFields = (side, txHash, dep) => side === 'shop'
  ? { shopSweptAt: new Date(), shopSweepTx: txHash, shopSweptAmount: dep.netAmount }
  : { reserveSweptAt: new Date(), reserveSweepTx: txHash, reserveSweptAmount: dep.commissionAmount };

// Records a sweep on the deposit. Guarded by the amount received: if a new payment was
// credited meanwhile, the deposit stays open for that new share.
async function markSwept(kind, dep, txHash, settlesOther = false) {
  const other = kind === 'shop' ? 'reserve' : 'shop';
  const data = { ...sideFields(kind, txHash, dep), ...(settlesOther ? sideFields(other, 'dust', dep) : {}) };
  const { count } = await prisma.deposit.updateMany({ where: { id: dep.id, amountReceived: dep.amountReceived }, data });
  if (!count) {
    const amounts = Object.fromEntries(Object.entries(data).filter(([k]) => k.endsWith('SweptAmount')));
    await prisma.deposit.update({ where: { id: dep.id }, data: amounts });
  }
}

// An amount to sweep chosen in USD, turned into the coin at the current price. Taken from the
// oldest deposits first; the last one may be swept in part (the rest stays owed). The network
// fee comes out of that amount. null = everything owed.
async function budgetFor(currency, usd) {
  if (usd == null || usd === '') return null;
  const value = Number(usd);
  if (!(value > 0)) throw fail('The amount to sweep must be a positive USD amount.');
  const price = await getCachedUsdPrice(currency);
  if (!price) throw fail(`The ${currency} price is unavailable right now: sweep everything, or try again in a minute.`, 503);
  return { usd: value, price, coins: Math.floor(value / price * 1e8) / 1e8 };
}

// Part of a side's share was swept: it stays open for the rest
async function markPartial(kind, dep, txHash, takenCoins) {
  const field = kind === 'shop' ? 'shopSweptAmount' : 'reserveSweptAmount';
  await prisma.deposit.update({
    where: { id: dep.id },
    data: { [field]: { increment: Math.round(takenCoins * 1e8) / 1e8 }, [kind === 'shop' ? 'shopSweepTx' : 'reserveSweepTx']: txHash },
  });
}

async function addressBalanceSats(currency, address) {
  const { data } = await axios.get(
    `https://api.blockcypher.com/v1/${CHAIN[currency]}/addrs/${address}/balance?token=${process.env.BLOCKCYPHER_TOKEN}`,
    { timeout: 8000 });
  return data.balance || 0;
}

// Deposits not validated yet (awaiting, partial, or expired in the last 30 days) whose address
// already received payments: credited to the customer first, so a sweep never leaves them out
// (and never takes money that was not credited). Returns how many deposits got a credit.
async function creditUnvalidated(currency) {
  const { syncDeposit } = require('./wallet.service');
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const open = await prisma.deposit.findMany({
    where: {
      currency,
      address: { not: 'pending' },
      OR: [{ status: { in: ['awaiting', 'partial'] } }, { status: 'expired', createdAt: { gt: since } }],
    },
    orderBy: { id: 'asc' },
  });
  let n = 0;
  for (const d of open) {
    try { if ((await syncDeposit(d)).credited > 0) n++; }
    catch (e) { console.warn(`[Sweep] could not read deposit #${d.id}:`, e.message); }
  }
  return n;
}

// Credits the payments made to the address since it was last read, then reloads it
async function freshDeposit(dep) {
  const { syncDeposit } = require('./wallet.service');
  await syncDeposit(dep);
  return prisma.deposit.findUnique({ where: { id: dep.id } });
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

// Deposits whose money is partly promised to a refund an admin hasn't decided yet
async function depositsWithOpenRefunds(ids) {
  if (!ids.length) return new Set();
  const rows = await prisma.refundRequest.findMany({
    where: { depositId: { in: ids }, status: { in: ['pending', 'sending', 'manual'] } },
    select: { depositId: true },
  });
  return new Set(rows.map(r => r.depositId));
}

// The reserve sweep leaves everything but the commission still owed to it (the shop's
// share), unless the shop side was already swept. Needs the address balance.
async function reserveKeep(currency, dep) {
  if (dep.shopSweptAt) return 0;
  const { data } = await axios.get(
    `https://api.blockcypher.com/v1/${CHAIN[currency]}/addrs/${dep.address}/balance?token=${process.env.BLOCKCYPHER_TOKEN}`,
    { timeout: 8000 });
  return amountToKeep('reserve', dep, data.balance || 0, toSats);
}

async function sweepUtxo(kind, currency, userId, { usd = null } = {}) {
  if (!['BTC', 'LTC', 'DOGE'].includes(currency)) throw fail('Invalid currency', 422);
  if (!process.env.BLOCKCYPHER_TOKEN) throw fail('BLOCKCYPHER_TOKEN not configured.', 500);

  const destination = await getDestination(kind, currency);
  if (!isValidUtxoAddress(currency, destination)) {
    throw fail(`The ${currency} ${kind === 'shop' ? 'destination' : 'reserve'} address is not a valid ${currency} address.`);
  }

  const budget = await budgetFor(currency, usd);
  let left = budget ? toSats(budget.coins) : Infinity; // sats still to sweep

  const creditedFirst = await creditUnvalidated(currency);
  const deposits = await prisma.deposit.findMany({ where: eligibleWhere(kind, currency), orderBy: { id: 'asc' } });
  const held = kind === 'shop' ? await depositsWithOpenRefunds(deposits.map(d => d.id)) : new Set();

  const swept = [];
  const skipped = [];
  let total = 0;

  for (const listed of deposits) {
    if (left < DUST[currency]) break;
    if (held.has(listed.id)) {
      skipped.push({ address: listed.address, reason: 'a refund on this deposit is waiting for approval (Admin → Refunds)' });
      continue;
    }
    try {
      // New payments on the address are credited to the customer first, never swept unseen
      const dep = await freshDeposit(listed);
      // The deposit's other share stays on the address as change (sats)
      let keep = kind === 'shop' ? amountToKeep('shop', dep, 0, toSats) : await reserveKeep(currency, dep);
      // A chosen amount smaller than what this deposit owes: take only that, leave the rest
      const owed = toSats(kind === 'shop' ? shopOwed(dep) : reserveOwed(dep));
      const partial = left < owed;
      if (partial) keep = Math.max(0, (await addressBalanceSats(currency, dep.address)) - left);
      const res = await sweepDepositUtxo(currency, dep, destination, keep);

      if (res.empty) {
        // Deposits credited before commissions existed and already emptied: settle them
        // so they stop being queried on every sweep.
        if (kind === 'shop' && toSats(dep.commissionAmount) === 0) await markSwept('shop', dep, 'empty');
        skipped.push({ address: dep.address, reason: 'empty' });
        continue;
      }
      if (res.skipped) { skipped.push({ address: dep.address, reason: res.skipped }); continue; }

      const taken = res.sent + res.fee; // what left this side's share, fee included
      if (partial && !res.settlesOther) await markPartial(kind, dep, res.txHash, taken / 1e8);
      else await markSwept(kind, dep, res.txHash, res.settlesOther);
      await logSweep({ kind, currency, amount: res.sent / 1e8, destination, txHash: res.txHash, userId, pct: dep.commissionPct });

      swept.push({ address: dep.address, txHash: res.txHash, currency, amount: fmt8(res.sent), fee: fmt8(res.fee), partial: partial && !res.settlesOther });
      total += res.sent;
      left -= taken;
    } catch (e) {
      skipped.push({ address: listed.address, reason: errorMessage(e) });
    }
  }

  return {
    kind, currency, swept: swept.length, results: swept, skipped, total: fmt8(total), creditedFirst,
    ...(budget ? { requestedUsd: budget.usd, requested: fmt8(toSats(budget.coins)), price: budget.price, totalUsd: Math.round(total / 1e8 * budget.price * 100) / 100 } : {}),
  };
}

async function sweepEth(kind, userId, { usd = null } = {}) {
  const phrase = process.env.ETH_HD_SEED;
  if (!phrase) throw fail('ETH_HD_SEED not configured on the server.', 500);
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) throw fail('ALCHEMY_API_KEY not configured on the server.', 500);

  const destination = await getDestination(kind, 'ETH');
  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);
  const toWei = n => ethers.parseEther(parseFloat(n).toFixed(8));

  const budget = await budgetFor('ETH', usd);
  let left = budget ? toWei(budget.coins) : null; // wei still to sweep (null = everything)
  const creditedFirst = await creditUnvalidated('ETH');

  const deposits = await prisma.deposit.findMany({
    where: { ...eligibleWhere(kind, 'ETH'), ethIndex: { not: null } },
    orderBy: { id: 'asc' },
  });
  const held = kind === 'shop' ? await depositsWithOpenRefunds(deposits.map(d => d.id)) : new Set();

  const swept = [];
  const skipped = [];
  let total = 0n;

  for (const listed of deposits) {
    if (left != null && left <= 0n) break;
    if (held.has(listed.id)) {
      skipped.push({ address: listed.address, reason: 'a refund on this deposit is waiting for approval (Admin → Refunds)' });
      continue;
    }
    try {
      const dep = await freshDeposit(listed);
      const wallet = HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${dep.ethIndex}`).connect(provider);
      const balance = await provider.getBalance(wallet.address);
      if (balance === 0n) { skipped.push({ address: dep.address, reason: 'empty' }); continue; }

      const feeData  = await provider.getFeeData();
      const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits('20', 'gwei');
      const gasCost  = 21000n * gasPrice;

      const owedToReserve = toWei(reserveOwed(dep));
      let keep;
      if (kind === 'shop') keep = dep.reserveSweptAt ? 0n : owedToReserve;
      else keep = dep.shopSweptAt ? 0n : (balance > owedToReserve ? balance - owedToReserve : 0n);

      // A chosen amount smaller than what this deposit owes: take only that, leave the rest
      const owed = toWei(kind === 'shop' ? shopOwed(dep) : reserveOwed(dep));
      const partial = left != null && left < owed;
      if (partial) keep = balance > left ? balance - left : 0n;

      const value = balance - keep - gasCost;
      if (value <= 0n) {
        skipped.push({ address: dep.address, reason: 'share too small to cover gas' });
        continue;
      }

      const sent = await wallet.sendTransaction({ to: destination, value, gasLimit: 21000n });
      await sent.wait();

      const taken = value + gasCost; // what left this side's share, gas included
      if (partial) await markPartial(kind, dep, sent.hash, Number(ethers.formatEther(taken)));
      else await markSwept(kind, dep, sent.hash);
      await logSweep({ kind, currency: 'ETH', amount: ethers.formatEther(value), destination, txHash: sent.hash, userId, pct: dep.commissionPct });

      swept.push({ address: dep.address, txHash: sent.hash, currency: 'ETH', amount: ethers.formatEther(value), partial });
      total += value;
      if (left != null) left -= taken;
    } catch (e) {
      skipped.push({ address: listed.address, reason: e.message });
    }
  }

  return {
    kind, currency: 'ETH', swept: swept.length, results: swept, skipped, total: ethers.formatEther(total), creditedFirst,
    ...(budget ? { requestedUsd: budget.usd, requested: String(budget.coins), price: budget.price, totalUsd: Math.round(Number(ethers.formatEther(total)) * budget.price * 100) / 100 } : {}),
  };
}

// What each side is still owed per currency (only what was not swept yet)
async function pendingTotals(kind) {
  const rows = await prisma.deposit.findMany({
    where: kind === 'shop'
      ? { status: 'confirmed', shopSweptAt: null }
      : { status: 'confirmed', reserveSweptAt: null, commissionAmount: { gt: 0 } },
    select: { currency: true, netAmount: true, shopSweptAmount: true, commissionAmount: true, reserveSweptAmount: true },
  });
  const by = {};
  for (const d of rows) {
    const owed = kind === 'shop' ? shopOwed(d) : reserveOwed(d);
    by[d.currency] = by[d.currency] || { currency: d.currency, amount: 0, deposits: 0 };
    by[d.currency].amount = Math.round((by[d.currency].amount + owed) * 1e8) / 1e8;
    by[d.currency].deposits++;
  }
  return Object.values(by);
}

module.exports = { sweepUtxo, sweepEth, pendingTotals, RESERVE_ADDRESS_KEY };
