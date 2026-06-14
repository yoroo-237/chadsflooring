const prisma = require('../db');
const { success, error } = require('../utils/apiResponse');
const walletService = require('../services/wallet.service');

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

module.exports = { getWallet, listTransactions, listDeposits, getDeposit, createDeposit };
