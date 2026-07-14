const prisma = require('../db');
const { calculateShipping } = require('./shipping.service');
const { formatOrderId, formatTxnId } = require('../utils/formatters');
const { parsePaginationParams, buildPagination } = require('../utils/pagination');

const ALLOWED_PAYMENT_METHODS = ['XMR', 'BTC', 'ETH'];
const ALLOWED_COUNTRIES = ['US', 'CA', 'UK', 'AU', 'DE', 'FR', 'Other'];

async function placeOrder(userId, { items, paymentMethod, shipping }) {
  if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
    throw Object.assign(new Error('Invalid payment method.'), { status: 422 });
  }
  if (!ALLOWED_COUNTRIES.includes(shipping.country)) {
    throw Object.assign(new Error('Shipping country not available.'), { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found.'), { status: 404 });
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

  if (parseFloat(user.balance) < total) {
    throw Object.assign(new Error('Insufficient balance.'), { status: 422 });
  }
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
        paymentMethod,
        subtotal:    usdSubtotal,
        shippingCost,
        totalAmount: total,
        pointsEarned,
        shipName:    shipping.name,
        shipEmail:   shipping.email,
        shipAddress: shipping.address,
        shipCity:    shipping.city,
        shipPostal:  shipping.postal,
        shipCountry: shipping.country,
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

    // 4 & 5. Debit balance, adjust points, update totalSpent
    const userNow = await tx.user.findUnique({
      where:  { id: userId },
      select: { points: true },
    });
    const newPoints = userNow.points - pointsCost + pointsEarned;

    await tx.user.update({
      where: { id: userId },
      data: {
        balance:    { decrement: total },
        points:     newPoints,
        totalSpent: { increment: usdSubtotal },
      },
    });

    // 6. Create Transaction
    await tx.transaction.create({
      data: {
        frontendId: formatTxnId(Date.now()),
        userId,
        orderId:    order.id,
        type:       'purchase',
        amount:     -total,
        currency:   'USD',
        status:     'confirmed',
        note:       `Order ${order.frontendId}`,
      },
    });

    const updatedUser = await tx.user.findUnique({
      where:  { id: userId },
      select: { balance: true },
    });

    return { order, newBalance: parseFloat(updatedUser.balance), pointsEarned };
  });

  return result;
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

    // Refund balance and points
    await tx.user.update({
      where: { id: order.userId },
      data: {
        balance: { increment: parseFloat(order.totalAmount) },
        ...(pointsToRefund > 0 ? { points: { increment: Math.round(pointsToRefund) } } : {}),
      },
    });

    // Refund transaction
    await tx.transaction.create({
      data: {
        frontendId: formatTxnId(Date.now()),
        userId:     order.userId,
        orderId:    order.id,
        type:       'refund',
        amount:     parseFloat(order.totalAmount),
        currency:   'USD',
        status:     'confirmed',
        note:       `Refund for Order ${order.frontendId}`,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data:  { status: 'cancelled' },
    });
  });

  return { cancelled: true, refundAmount: parseFloat(order.totalAmount) };
}

module.exports = { placeOrder, getUserOrders, getOrderById, cancelOrder };
