const { success } = require('../utils/apiResponse');
const orderService = require('../services/order.service');
const { payableCoins } = require('../services/crypto.service');

async function checkout(req, res) {
  const result = await orderService.placeOrder(req.user.id, req.body);
  return success(res, result, 201);
}

// Pay the order itself in crypto: it waits for its payment on its own address
async function pay(req, res) {
  const result = await orderService.placePendingOrder(req.user.id, req.body);
  return success(res, result, 201);
}

async function coins(req, res) {
  return success(res, { coins: await payableCoins(), payWindowMinutes: orderService.PAY_WINDOW_MIN });
}

async function payment(req, res) {
  return success(res, await orderService.paymentView(parseInt(req.params.id), req.user.id));
}

async function checkPayment(req, res) {
  return success(res, await orderService.checkOrderPayment(parseInt(req.params.id), req.user.id));
}

async function list(req, res) {
  const { page, limit, status } = req.query;
  const result = await orderService.getUserOrders(req.user.id, { page, limit, status });
  return success(res, result);
}

async function getOne(req, res) {
  const orderId = parseInt(req.params.id);
  const order = await orderService.getOrderById(orderId, req.user.id, req.user.role === 'admin');
  return success(res, { order });
}

async function cancel(req, res) {
  const orderId = parseInt(req.params.id);
  const result = await orderService.cancelOrder(orderId, req.user.id, req.user.role === 'admin');
  return success(res, result);
}

module.exports = { checkout, pay, coins, payment, checkPayment, list, getOne, cancel };
