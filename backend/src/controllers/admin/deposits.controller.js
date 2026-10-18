const axios  = require('axios');
const { ethers } = require('ethers');
const prisma = require('../../db');
const { success, error } = require('../../utils/apiResponse');
const { parsePaginationParams, buildPagination } = require('../../utils/pagination');
const { confirmDepositManually, cleanupExpiredDeposits } = require('../../services/wallet.service');
const { getCurrencyUsdPrice } = require('../../services/price.service');

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
      })),
      total,
      pagination: buildPagination(page, limit, total),
    });
  } catch (e) { next(e); }
}

async function confirmDeposit(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { usdAmount } = req.body;

    const amt = parseFloat(usdAmount);
    if (!amt || amt <= 0) {
      return error(res, 'usdAmount must be a positive number.', 400);
    }

    const result = await confirmDepositManually(id, amt, req.user.id);
    return success(res, result);
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

module.exports = { listDeposits, confirmDeposit, expireDeposit, cleanup, getUsdValue, getOnchainBalance };
