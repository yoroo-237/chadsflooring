const prisma = require('../db');
const { calculateShipping } = require('./shipping.service');
const { formatOrderId, formatTxnId } = require('../utils/formatters');
const { parsePaginationParams, buildPagination } = require('../utils/pagination');
const balanceService = require('./balance.service');
const { getCachedUsdPrices } = require('./price.service');
const { sendOrderInvoice } = require('./telegram.service');

// No customer details are collected: the only contact is the Telegram
// username/ID, optional, saved to the profile when given at checkout.
async function placeOrder(userId, { items, payCurrency, telegram }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found.'), { status: 404 });
  }
  const handle = String(telegram || '').trim().replace(/^@/, '').slice(0, 64);
  if (handle && !user.telegramHandle) {
    await prisma.user.update({ where: { id: userId }, data: { telegramHandle: handle } });
    user.telegramHandle = handle;
  }

  const markupPct = parseFloat(user.markupPct);

  // Load and validate products
  const productIds = [...new Set(items.map(i => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { brand: true },
  });
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) {
      throw Object.assign(
        new Error(`Product ${item.productId} not found or unavailable.`),
        { status: 422 }
      );
    }
    if (product.stock < item.quantity) {
      throw Object.assign(
        new Error(`Insufficient stock for "${product.name}".`),
        { status: 422 }
      );
    }
  }

  // Compute prices
  let usdSubtotal = 0;
  let pointsSubtotal = 0;

  const enrichedItems = items.map(item => {
    const product = productMap[item.productId];
    let unitPrice = parseFloat(product.price);
    if (product.priceType === 'usd' && markupPct > 0) {
      unitPrice = parseFloat((unitPrice * (1 + markupPct / 100)).toFixed(2));
    }
    const lineTotal = parseFloat((unitPrice * item.quantity).toFixed(2));
    if (product.priceType === 'usd') usdSubtotal += lineTotal;
    else pointsSubtotal += lineTotal;
    return { ...item, product, unitPrice, lineTotal };
  });

  usdSubtotal = parseFloat(usdSubtotal.toFixed(2));
  const { shippingCost } = await calculateShipping(usdSubtotal);
  const total = parseFloat((usdSubtotal + shippingCost).toFixed(2));
  const pointsCost = Math.round(pointsSubtotal);

  // Freeze the conversion now: these prices and quantities are what the order costs
  // in crypto, whatever the market does afterwards.
  const holdings = await balanceService.getHoldings(userId);
  const prices = await getCachedUsdPrices(holdings.map(h => h.currency));
  if (total > 0 && holdings.length && !holdings.some(h => prices[h.currency])) {
    throw Object.assign(new Error('Live prices are unavailable right now — please try again in a minute.'), { status: 503 });
  }
  const payments = total > 0 ? balanceService.allocateUsd(holdings, prices, total, payCurrency) : [];
  if (pointsCost > 0 && user.points < pointsCost) {
    throw Object.assign(new Error('Insufficient points.'), { status: 422 });
  }

  const pointsEarned = Math.floor(usdSubtotal * 0.5);
  const orderFrontendId = formatOrderId(Date.now());

  const result = await prisma.$transaction(async tx => {
    // 1. Create Order
    const order = await tx.order.create({
      data: {
        frontendId:  orderFrontendId,
        userId,
        status:      'processing',
        subtotal:    usdSubtotal,
        shippingCost,
        totalAmount: total,
        pointsEarned,
        payments,
        paymentMethod: payments.map(p => p.currency).join('+') || null,
      },
    });

    // 2. Create OrderItems (price snapshot)
    await tx.orderItem.createMany({
      data: enrichedItems.map(item => ({
        orderId:         order.id,
        productId:       item.productId,
        productOptionId: item.optionId || null,
        productName:     item.product.name,
        productBrand:    item.product.brand?.name || '',
        productImageUrl: item.product.imageUrl,
        unitPrice:       item.unitPrice,
        priceType:       item.product.priceType,
        quantity:        item.quantity,
        lineTotal:       item.lineTotal,
      })),
    });

    // 3. Decrement stock
    for (const item of enrichedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data:  { stock: { decrement: item.quantity } },
      });
    }

    // 4. Debit the crypto holdings at the frozen rates
    for (const p of payments) await balanceService.debit(tx, userId, p.currency, p.amount);

    // 5. Adjust points, update totalSpent
    const userNow = await tx.user.findUnique({
      where:  { id: userId },
      select: { points: true },
    });
    const newPoints = userNow.points - pointsCost + pointsEarned;

    await tx.user.update({
      where: { id: userId },
      data: {
        points:     newPoints,
        totalSpent: { increment: usdSubtotal },
      },
    });

    // 6. One transaction per currency debited
    const now = Date.now();
    for (const [i, p] of payments.entries()) {
      await tx.transaction.create({
        data: {
          frontendId:   formatTxnId(payments.length > 1 ? `${now}-${i + 1}` : now),
          userId,
          orderId:      order.id,
          type:         'purchase',
          amount:       -p.usd,
          currency:     p.currency,
          cryptoAmount: -p.amount,
          rate:         p.rate,
          status:       'confirmed',
          note:         `Order ${order.frontendId} — ${p.amount} ${p.currency} @ $${p.rate}`,
        },
      });
    }

    return { order, pointsEarned };
  });

  // Paid in the app, invoiced on Telegram (best-effort: never fails the order)
  const [invoice, { balance }] = await Promise.all([
    sendOrderInvoice({
      orderNumber: result.order.frontendId,
      lines:       enrichedItems.map(i => ({ name: i.product.name, quantity: i.quantity, total: i.lineTotal })),
      shipping:    shippingCost,
      total,
      payments,
      user,
    }),
    balanceService.getUserBalance(userId),
  ]);
  return { ...result, payments, newBalance: balance, invoice };
}

async function getUserOrders(userId, { page = 1, limit = 20, status } = {}) {
  const { page: p, limit: l } = parsePaginationParams({ page, limit });
  const where = { userId, ...(status ? { status } : {}) };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include:  { items: { include: { product: { include: { brand: true } } } } },
      orderBy:  { placedAt: 'desc' },
      skip:     (p - 1) * l,
      take:     l,
    }),
  ]);

  return { orders, pagination: buildPagination(p, l, total) };
}

async function getOrderById(orderId, userId, isAdmin = false) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, ...(isAdmin ? {} : { userId }) },
    include: { items: true },
  });
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
  return order;
}

async function cancelOrder(orderId, userId, isAdmin = false) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, ...(isAdmin ? {} : { userId }) },
    include: { items: true },
  });
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
  if (order.status !== 'processing') {
    throw Object.assign(new Error('Only processing orders can be cancelled.'), { status: 422 });
  }

  const pointsToRefund = order.items
    .filter(i => i.priceType === 'points')
    .reduce((sum, i) => sum + parseFloat(i.lineTotal), 0);

  // Orders paid before balances became crypto have no `payments`: refund their USD
  // total in the customer's main currency (BTC if they hold none) at today's price.
  let payments = Array.isArray(order.payments) ? order.payments : [];
  const usdTotal = parseFloat(order.totalAmount);
  if (!payments.length && usdTotal > 0) {
    const holdings = await balanceService.getHoldings(order.userId);
    const prices = await getCachedUsdPrices([...holdings.map(h => h.currency), 'BTC']);
    const main = holdings
      .filter(h => prices[h.currency])
      .sort((a, b) => b.amount * prices[b.currency] - a.amount * prices[a.currency])[0];
    const currency = main?.currency || 'BTC';
    if (!prices[currency]) {
      throw Object.assign(new Error('Live prices are unavailable right now — try the refund again in a minute.'), { status: 503 });
    }
    payments = [{ currency, amount: balanceService.round8(usdTotal / prices[currency]), rate: prices[currency], usd: usdTotal }];
  }

  await prisma.$transaction(async tx => {
    // Restore stock
    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { stock: { increment: item.quantity } },
        });
      }
    }

    // Refund the exact crypto quantities debited at checkout
    const now = Date.now();
    for (const [i, p] of payments.entries()) {
      await balanceService.credit(tx, order.userId, p.currency, p.amount);
      await tx.transaction.create({
        data: {
          frontendId:   formatTxnId(payments.length > 1 ? `${now}-${i + 1}` : now),
          userId:       order.userId,
          orderId:      order.id,
          type:         'refund',
          amount:       p.usd,
          currency:     p.currency,
          cryptoAmount: p.amount,
          rate:         p.rate,
          status:       'confirmed',
          note:         `Refund for Order ${order.frontendId} — ${p.amount} ${p.currency}`,
        },
      });
    }

    if (pointsToRefund > 0) {
      await tx.user.update({
        where: { id: order.userId },
        data:  { points: { increment: Math.round(pointsToRefund) } },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data:  { status: 'cancelled' },
    });
  });

  return { cancelled: true, refundAmount: parseFloat(order.totalAmount), refunded: payments };
}

module.exports = { placeOrder, getUserOrders, getOrderById, cancelOrder };
