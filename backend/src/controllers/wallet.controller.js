const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');
const { getUserBalance } = require('../services/balance.service');
const { getCachedUsdPrices } = require('../services/price.service');


const currentBalance = async userId => (await getUserBalance(userId)).balance;

async function getWallet(req, res) {
  const data = await walletService.getWallet(req.user.id);
  return success(res, data);
}

// Live prices used to value balances — polled by the client to keep the balance current.
async function getPrices(req, res) {
  const prices = await getCachedUsdPrices();
  return success(res, { prices, pricedAt: new Date().toISOString() });
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

// Reads the deposit address on the blockchain and credits every payment not counted yet:
// the first one, and any later one (the customer may pay the same address again).
async function checkDeposit(req, res, next) {
  try {
    const depositId = parseInt(req.params.id);
    let deposit = await prisma.deposit.findFirst({ where: { id: depositId, userId: req.user.id } });
    if (!deposit) return error(res, 'Deposit not found.', 404);

    // XMR: one shared address, checked by hand
    if (deposit.currency === 'XMR') return success(res, { status: deposit.status, amountReceived: deposit.amountReceived });

    const { credited, pending } = await walletService.syncDeposit(deposit);
    deposit = await prisma.deposit.findUnique({ where: { id: deposit.id } });

    // Nothing ever received and past its deadline: expired
    if (['awaiting', 'partial'].includes(deposit.status) && !deposit.orderId && Number(deposit.amountReceived) === 0
      && deposit.expiresAt && new Date(deposit.expiresAt) < new Date()) {
      await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'expired' } });
      deposit.status = 'expired';
    }

    return success(res, {
      status:         deposit.status,
      credited,
      pending,
      amountReceived: deposit.amountReceived,
      orderId:        deposit.orderId,
      newBalance:     await currentBalance(req.user.id),
    });
  } catch (e) { next(e); }
}

module.exports = { getWallet, getPrices, listTransactions, listDeposits, getDeposit, createDeposit, checkDeposit };
