const axios = require('axios');
const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');

const BLOCKCYPHER_CHAIN = { BTC: 'btc/main', LTC: 'ltc/main', DOGE: 'doge/main' };
const COINGECKO_ID      = { BTC: 'bitcoin', LTC: 'litecoin', DOGE: 'dogecoin', ETH: 'ethereum' };

async function fetchUsdPrice(currency) {
  try {
    const id  = COINGECKO_ID[currency];
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const d   = await res.json();
    return d[id]?.usd || null;
  } catch { return null; }
}

async function getWallet(req, res) {
  const data = await walletService.getWallet(req.user.id);
  return success(res, data);
}

async function listTransactions(req, res) {
  const { type, page, limit } = req.query;
  const result = await walletService.getTransactions(req.user.id, { type, page, limit });
  return success(res, result);
}

async function listDeposits(req, res) {
  const { page, limit } = req.query;
  const result = await walletService.getDeposits(req.user.id, { page, limit });
  return success(res, result);
}

async function getDeposit(req, res) {
  const depositId = parseInt(req.params.id);
  const deposit = await prisma.deposit.findFirst({
    where: { id: depositId, userId: req.user.id },
  });
  if (!deposit) return error(res, 'Deposit not found.', 404);
  return success(res, {
    ...deposit,
    shortId: deposit.id.toString().padStart(8, '0').slice(-8),
  });
}

async function createDeposit(req, res) {
  const { currency } = req.body;
  if (!currency) return error(res, 'Currency is required.', 400);
  const result = await walletService.createDeposit(req.user.id, currency);
  return success(res, result, 201);
}

async function checkDeposit(req, res, next) {
  try {
    const depositId = parseInt(req.params.id);

    const deposit = await prisma.deposit.findFirst({ where: { id: depositId, userId: req.user.id } });
    if (!deposit) return error(res, 'Deposit not found.', 404);

    // Already resolved — return current status + fresh balance
    if (deposit.status === 'confirmed') {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return success(res, { status: 'confirmed', newBalance: parseFloat(u.balance) });
    }
    if (deposit.status === 'expired') return success(res, { status: 'expired' });

    // Auto-expire if past deadline
    if (deposit.expiresAt && new Date(deposit.expiresAt) < new Date()) {
      await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'expired' } });
      return success(res, { status: 'expired' });
    }

    // XMR — manual only, nothing to poll
    if (deposit.currency === 'XMR') return success(res, { status: 'awaiting' });

    // ── BTC / LTC / DOGE via BlockCypher ─────────────────────────────────────
    if (['BTC', 'LTC', 'DOGE'].includes(deposit.currency)) {
      const TOKEN = process.env.BLOCKCYPHER_TOKEN;
      if (!TOKEN) return success(res, { status: 'awaiting' });

      const chain   = BLOCKCYPHER_CHAIN[deposit.currency];
      const addrRes = await axios.get(
        `https://api.blockcypher.com/v1/${chain}/addrs/${deposit.address}?token=${TOKEN}`
      );
      const satoshis = addrRes.data.balance || 0;
      if (satoshis === 0) return success(res, { status: 'awaiting' });

      const price = await fetchUsdPrice(deposit.currency);
      if (!price) return success(res, { status: 'awaiting' });

      const txHash    = addrRes.data.txrefs?.[0]?.tx_hash || null;
      const usdAmount = parseFloat(((satoshis / 1e8) * price).toFixed(2));
      await walletService.confirmDepositManually(deposit.id, usdAmount, null, txHash);

      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return success(res, { status: 'confirmed', newBalance: parseFloat(u.balance) });
    }

    // ── ETH via Alchemy ───────────────────────────────────────────────────────
    if (deposit.currency === 'ETH') {
      const apiKey = process.env.ALCHEMY_API_KEY;
      if (!apiKey) return success(res, { status: 'awaiting' });

      const rpc    = await axios.post(`https://eth-mainnet.g.alchemy.com/v2/${apiKey}`, {
        jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [deposit.address, 'latest'],
      });
      const balWei = BigInt(rpc.data.result || '0x0');
      if (balWei === 0n) return success(res, { status: 'awaiting' });

      const price = await fetchUsdPrice('ETH');
      if (!price) return success(res, { status: 'awaiting' });

      const usdAmount = parseFloat((Number(balWei) / 1e18 * price).toFixed(2));
      await walletService.confirmDepositManually(deposit.id, usdAmount, null, null);

      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } });
      return success(res, { status: 'confirmed', newBalance: parseFloat(u.balance) });
    }

    return success(res, { status: 'awaiting' });
  } catch (e) {
    // Race condition: webhook already confirmed it between our status check and confirmDepositManually
    if (e.status === 422) {
      const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { balance: true } }).catch(() => null);
      return success(res, { status: 'confirmed', newBalance: u ? parseFloat(u.balance) : null });
    }
    next(e);
  }
}

module.exports = { getWallet, listTransactions, listDeposits, getDeposit, createDeposit, checkDeposit };
