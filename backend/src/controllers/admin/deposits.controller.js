const axios  = require('axios');
const { ethers } = require('ethers');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { confirmDepositManually, cleanupExpiredDeposits, syncDeposit } = require('../../services/wallet.service');
const { getCurrencyUsdPrice } = require('../../services/price.service');
const { incomingPayments } = require('../../services/crypto.service');
const balanceService = require('../../services/balance.service');

const BLOCKCYPHER_CHAIN = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const usd = (amount, price) => (amount != null && price ? parseFloat((amount * price).toFixed(2)) : null);

async function listDeposits(req, res, next) {
  try {
    const { page, limit } = parsePaginationParams(req.query);
    const { status, currency } = req.query;

    const where = {};
    if (status)   where.status   = status;
    if (currency) where.currency = currency;

    const skip = (page - 1) * limit;

    const [total, deposits] = await Promise.all([
      prisma.deposit.count({ where }),
      prisma.deposit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true } } },
      }),
    ]);

    return success(res, {
      deposits: deposits.map(d => ({
        ...d,
        amountExpected: d.amountExpected != null ? parseFloat(d.amountExpected) : null,
        amountReceived: parseFloat(d.amountReceived),
        usdCredited:    parseFloat(d.usdCredited),
        commissionPct:    parseFloat(d.commissionPct),
        commissionAmount: parseFloat(d.commissionAmount),
        netAmount:        parseFloat(d.netAmount),
      })),
      total,
      pagination: buildPagination(page, limit, total),
    });
  } catch (e) { next(e); }
}

// Marks every payment currently on a deposit's address as already counted (txSeen), without
// crediting anything. Best effort: if the chain can't be read now, the amount-based check of
// syncDeposit still applies.
async function markPaymentsCovered(id) {
  try {
    const d = await prisma.deposit.findUnique({ where: { id } });
    if (!d || d.currency === 'XMR' || !d.address || d.address === 'pending') return 0;
    const { payments } = await incomingPayments(d);
    const seen = new Set(Array.isArray(d.txSeen) ? d.txSeen : []);
    payments.forEach(p => seen.add(p.hash));
    await prisma.deposit.update({ where: { id }, data: { txSeen: [...seen] } });
    return payments.length;
  } catch (e) {
    console.warn(`[Deposits] could not mark the payments of deposit #${id} as covered:`, e.message);
    return 0;
  }
}

// The customer was already credited another way (balance adjusted by hand): the deposit is
// only recorded as paid. Its amounts come from the chain (or the amount entered for XMR or
// when the chain can't be read), split with the deposit commission so the sweeps know each
// side's share. Nothing is credited, no transaction is created.
async function markAlreadyCredited(id, typedAmount) {
  const d = await prisma.deposit.findUnique({ where: { id } });
  if (!d) throw Object.assign(new Error('Deposit not found.'), { status: 404 });
  if (d.status === 'confirmed') throw Object.assign(new Error('This deposit is already confirmed.'), { status: 409 });
  let hashes = [];
  let gross = typedAmount > 0 ? typedAmount : 0;
  if (d.currency !== 'XMR' && d.address && d.address !== 'pending') {
    try {
      const { payments } = await incomingPayments(d);
      if (payments.length) {
        hashes = payments.map(p => p.hash);
        gross = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 1e8) / 1e8;
      }
    } catch (e) { console.warn(`[Deposits] chain read failed for #${id}:`, e.message); }
  }
  if (!(gross > 0)) throw Object.assign(new Error('Nothing received on this address yet: enter the amount received.'), { status: 422 });
  const pct = await balanceService.getCommissionPct();
  const { commission, net } = balanceService.splitDeposit(gross, pct);
  await prisma.deposit.update({
    where: { id },
    data: {
      status: 'confirmed', confirmedAt: new Date(), amountReceived: gross,
      commissionPct: pct, commissionAmount: commission, netAmount: net,
      txSeen: [...new Set([...(Array.isArray(d.txSeen) ? d.txSeen : []), ...hashes])],
    },
  });
  return { markedOnly: true, amountReceived: gross, currency: d.currency, payments: hashes.length };
}

async function confirmDeposit(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (req.body.alreadyCredited === true) {
      let typed = parseFloat(req.body.amount);
      if (!(typed > 0) && parseFloat(req.body.usdAmount) > 0) {
        const d = await prisma.deposit.findUnique({ where: { id } });
        const price = d ? await getCurrencyUsdPrice(d.currency) : null;
        typed = price ? Math.round(parseFloat(req.body.usdAmount) / price * 1e8) / 1e8 : 0;
      }
      return success(res, await markAlreadyCredited(id, typed));
    }
    // `amount`: the crypto received. `usdAmount`: a dollar amount, converted into the
    // deposit's coin at the current price (what the admin usually knows).
    let amt = parseFloat(req.body.amount);
    let converted = null;
    if (!(amt > 0) && parseFloat(req.body.usdAmount) > 0) {
      const d = await prisma.deposit.findUnique({ where: { id } });
      if (!d) return error(res, 'Deposit not found.', 404);
      const price = await getCurrencyUsdPrice(d.currency);
      if (!price) return error(res, `${d.currency} price unavailable — enter the crypto amount received instead.`, 503);
      amt = Math.round(parseFloat(req.body.usdAmount) / price * 1e8) / 1e8;
      converted = { usd: parseFloat(req.body.usdAmount), price, amount: amt, currency: d.currency };
    }
    if (!(amt > 0)) {
      return error(res, 'amount (crypto received) must be a positive number.', 400);
    }

    // No minimum and no maximum: the form shows the USD / crypto conversion before confirming
    const result = await confirmDepositManually(id, amt, req.user.id);
    // The admin credited what is on the address now: those payments are covered by this
    // credit, whatever amount was typed (a later read must never credit them again)
    const covered = await markPaymentsCovered(id);
    return success(res, { ...result, converted, covered });
  } catch (e) { next(e); }
}

async function expireDeposit(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const deposit = await prisma.deposit.findUnique({ where: { id } });
    if (!deposit) return error(res, 'Deposit not found.', 404);
    if (!['awaiting', 'partial'].includes(deposit.status)) {
      return error(res, `Only awaiting or partial deposits can be expired (this one is ${deposit.status}).`, 409);
    }

    await prisma.deposit.update({ where: { id }, data: { status: 'expired' } });
    return success(res, { expired: true });
  } catch (e) { next(e); }
}

async function cleanup(req, res, next) {
  try {
    const cleaned = await cleanupExpiredDeposits();
    return success(res, { cleaned });
  } catch (e) { next(e); }
}

// GET /admin/deposits/:id/usd-value
// USD value, at the current price, of what the customer was expected to send and of
// what was recorded as received — next to what was actually credited to their balance.
async function getUsdValue(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return error(res, 'Invalid deposit ID.', 422);
    const d = await prisma.deposit.findUnique({ where: { id } });
    if (!d) return error(res, 'Deposit not found.', 404);

    const price    = await getCurrencyUsdPrice(d.currency);
    const expected = d.amountExpected != null ? parseFloat(d.amountExpected) : null;
    const received = parseFloat(d.amountReceived);

    return success(res, {
      depositId: d.id,
      currency:  d.currency,
      price,
      priceSource: price ? 'CoinGecko (CoinCap fallback)' : null,
      expectedAmount: expected,
      expectedUsd:    usd(expected, price),
      receivedAmount: received,
      receivedUsd:    usd(received, price),
      usdCredited:    parseFloat(d.usdCredited),
      status:         d.status,
    });
  } catch (e) { next(e); }
}

// GET /admin/deposits/:id/onchain
// Live balance of the deposit address on its blockchain (independent of the database).
async function getOnchainBalance(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return error(res, 'Invalid deposit ID.', 422);
    const d = await prisma.deposit.findUnique({ where: { id } });
    if (!d) return error(res, 'Deposit not found.', 404);
    if (!d.address || d.address === 'pending') return error(res, 'This deposit has no address yet.', 422);

    if (d.currency === 'XMR') {
      return error(res, 'XMR deposits share a single wallet address — check the balance in your Monero wallet.', 422);
    }

    let onchain;
    if (BLOCKCYPHER_CHAIN[d.currency]) {
      const TOKEN = process.env.BLOCKCYPHER_TOKEN;
      if (!TOKEN) return error(res, 'BLOCKCYPHER_TOKEN not configured.', 500);
      const r = await axios.get(
        `https://api.blockcypher.com/v1/${BLOCKCYPHER_CHAIN[d.currency]}/addrs/${d.address}/balance?token=${TOKEN}`,
        { timeout: 10000 },
      );
      const sat = v => (v || 0) / 1e8;
      onchain = {
        confirmed:     sat(r.data.balance),
        unconfirmed:   sat(r.data.unconfirmed_balance),
        total:         sat(r.data.final_balance),
        totalReceived: sat(r.data.total_received),
        totalSent:     sat(r.data.total_sent),
        txCount:       r.data.final_n_tx ?? r.data.n_tx ?? 0,
        source:        'BlockCypher',
      };
    } else if (d.currency === 'ETH') {
      const apiKey = process.env.ALCHEMY_API_KEY;
      if (!apiKey) return error(res, 'ALCHEMY_API_KEY not configured.', 500);
      const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`);
      const [wei, txCount] = await Promise.all([provider.getBalance(d.address), provider.getTransactionCount(d.address)]);
      const eth = parseFloat(ethers.formatEther(wei));
      onchain = { confirmed: eth, unconfirmed: 0, total: eth, totalReceived: null, totalSent: null, txCount, source: 'Alchemy' };
    } else {
      return error(res, `On-chain lookup is not supported for ${d.currency}.`, 422);
    }

    const price = await getCurrencyUsdPrice(d.currency);
    return success(res, {
      depositId: d.id,
      currency:  d.currency,
      address:   d.address,
      ...onchain,
      price,
      totalUsd:         usd(onchain.total, price),
      totalReceivedUsd: usd(onchain.totalReceived, price),
      recordedReceived: parseFloat(d.amountReceived),
      usdCredited:      parseFloat(d.usdCredited),
    });
  } catch (e) {
    const msg = e.response?.data?.error || e.message;
    return error(res, `On-chain lookup failed: ${msg}`, 502);
  }
}

// Reads the deposit address on the blockchain and credits every payment not counted yet
// (each transaction once, by its hash): the same as the customer's Check, from the admin.
async function syncOne(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const d = await prisma.deposit.findUnique({ where: { id } });
    if (!d) return error(res, 'Deposit not found.', 404);
    if (d.currency === 'XMR') return error(res, 'XMR deposits share one wallet address: confirm them by hand.', 422);
    const before = parseFloat(d.amountReceived);
    const { credited, pending, found, failed } = await syncDeposit(d);
    const after = await prisma.deposit.findUnique({ where: { id } });
    return success(res, {
      credited, pending, found, failed, status: after.status,
      amountReceived: parseFloat(after.amountReceived),
      newlyReceived: Math.round((parseFloat(after.amountReceived) - before) * 1e8) / 1e8,
      currency: after.currency,
    });
  } catch (e) { next(e); }
}

module.exports = { listDeposits, confirmDeposit, expireDeposit, cleanup, getUsdValue, getOnchainBalance, syncOne };
