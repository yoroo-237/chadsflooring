const { success } = require('../utils/apiResponse');
const orderService = require('../services/order.service');

async function checkout(req, res) {
  const result = await orderService.placeOrder(req.user.id, req.body);
  return success(res, result, 201);
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

module.exports = { checkout, list, getOne, cancel };
