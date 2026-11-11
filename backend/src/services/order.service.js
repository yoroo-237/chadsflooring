const prisma = require('../db');
const { calculateShipping } = require('./shipping.service');
const { formatOrderId, formatTxnId } = require('../utils/formatters');
const { parsePaginationParams, buildPagination } = require('../utils/pagination');
const balanceService = require('./balance.service');
const { getCachedUsdPrices, getCachedUsdPrice } = require('./price.service');
const { sendOrderInvoice } = require('./telegram.service');
const cryptoService = require('./crypto.service');
const orderRefunds = require('./orderRefund.service');
const { isPgpMessage } = require('./pgp.service');
const { isAddress } = require('ethers');

// Minutes a customer has to pay an order straight in crypto
const PAY_WINDOW_MIN = 30;
// A payment within 1% of what was asked settles the order (rate or fee moved a little)
const TOLERANCE = 0.99;

const fail = (message, status = 422) => Object.assign(new Error(message), { status });

const clean = (v, max) => String(v ?? '').trim().slice(0, max) || null;

// Delivery is an option. Without it nothing is asked, no shipping is charged and the
// shop sorts it out with the customer on Telegram. With it: a US address, or that
// address encrypted in the customer's browser to the shop's PGP key (only the shop
// can read it). Returns the order's ship fields, or null for no delivery.
function readDelivery(delivery) {
  if (!delivery) return null;
  if (delivery.pgp) {
    const message = String(delivery.pgp).trim();
    if (message.length > 6000 || !isPgpMessage(message)) throw fail('The encrypted address is not a valid PGP message. Please try again.', 400);
    return { shipName: 'PGP encrypted', shipAddress: message, shipCountry: null };
  }
  const d = Object.fromEntries(['name', 'street', 'apt', 'city', 'state', 'zip'].map(k => [k, String(delivery[k] || '').trim().slice(0, 120)]));
  if (!d.name || !d.street || !d.city || !/^[A-Z]{2}$/.test(d.state) || !/^\d{5}(-\d{4})?$/.test(d.zip)) {
    throw fail('Please complete the delivery address (name, street, city, state and 5-digit ZIP).', 400);
  }
  return {
    shipName:    d.name,
    shipAddress: `${d.street}${d.apt ? `, ${d.apt}` : ''}, ${d.city}, ${d.state} ${d.zip}`,
    shipCity:    d.city,
    shipPostal:  d.zip,
    shipCountry: 'US',
  };
}

// The optional refund address: where the shop sends money back. BTC / XMR ones are
// also kept on the profile (prefilled next time, used for refunds from the admin).
const REFUND_COINS = ['BTC', 'LTC', 'DOGE', 'ETH', 'XMR'];
const validRefund = (coin, a) => coin === 'ETH' ? isAddress(a)
  : coin === 'XMR' ? /^[48][1-9A-HJ-NP-Za-km-z]{94}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(a)
  : cryptoService.isValidUtxoAddress(coin, a);

async function readRefund(userId, refund) {
  const address = clean(refund?.address, 200);
  if (!address) return { refundCurrency: null, refundAddress: null };
  const coin = String(refund.currency || '').toUpperCase();
  if (!REFUND_COINS.includes(coin) || !validRefund(coin, address)) throw fail(`This does not look like a ${coin || 'crypto'} refund address.`, 400);
  const field = { BTC: 'btcRefundAddress', XMR: 'xmrRefundAddress' }[coin];
  if (field) await prisma.user.update({ where: { id: userId }, data: { [field]: address } }).catch(() => {});
  return { refundCurrency: coin, refundAddress: address };
}

const shipTo = o => (o.shipName === 'PGP encrypted' ? 'PGP encrypted address (see the order in the admin)' : [o.shipName, o.shipAddress].filter(Boolean).join(', ')) || null;

async function notify(userId, title, body, link = '/orders') {
  await prisma.notification.create({ data: { userId, type: 'order', title, body, link } }).catch(() => {});
}

// Telegram is the only contact asked for: optional, saved to the profile when given.
async function loadBuyer(userId, telegram) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) throw fail('User not found.', 404);
  const handle = String(telegram || '').trim().replace(/^@/, '').slice(0, 64);
  if (handle && !user.telegramHandle) {
    await prisma.user.update({ where: { id: userId }, data: { telegramHandle: handle } });
    user.telegramHandle = handle;
  }
  return user;
}

// Validates the cart and prices it (with the customer's markup), and the shipping when delivered.
async function prepareCart(user, items, { delivery = false } = {}) {
  const markupPct = parseFloat(user.markupPct);
  const productIds = [...new Set(items.map(i => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { brand: true, options: true },
  });
  const productMap = Object.fromEntries(products.map(p => [p.id, p]));

  // A product sold by variant (flavor, strain, size): the variant is required, and its own stock counts
  for (const item of items) {
    const product = productMap[item.productId];
    if (!product) throw fail(`Product ${item.productId} not found or unavailable.`);
    const option = item.optionId ? product.options.find(o => o.id === item.optionId) : null;
    if (item.optionId && !option) throw fail(`That option of "${product.name}" is no longer available.`);
    if (!option && product.options.length) throw fail(`Please choose an option for "${product.name}".`);
    if (option && option.stock < item.quantity) throw fail(`Only ${option.stock} left of "${product.name} (${option.label})".`);
    if (product.stock < item.quantity) throw fail(`Insufficient stock for "${product.name}".`);
  }

  let usdSubtotal = 0;
  let pointsSubtotal = 0;
  const enrichedItems = items.map(item => {
    const product = productMap[item.productId];
    const option = item.optionId ? product.options.find(o => o.id === item.optionId) : null;
    let unitPrice = parseFloat(product.price) + (option ? parseFloat(option.priceDelta) : 0);
    if (product.priceType === 'usd' && markupPct > 0) {
      unitPrice = parseFloat((unitPrice * (1 + markupPct / 100)).toFixed(2));
    }
    const lineTotal = parseFloat((unitPrice * item.quantity).toFixed(2));
    if (product.priceType === 'usd') usdSubtotal += lineTotal;
    else pointsSubtotal += lineTotal;
    return { ...item, product, option, unitPrice, lineTotal };
  });

  usdSubtotal = parseFloat(usdSubtotal.toFixed(2));
  const shippingCost = delivery ? (await calculateShipping(usdSubtotal)).shippingCost : 0;
  const total = parseFloat((usdSubtotal + shippingCost).toFixed(2));
  const pointsCost = Math.round(pointsSubtotal);
  if (pointsCost > 0 && user.points < pointsCost) throw fail('Insufficient points.');

  return { enrichedItems, usdSubtotal, shippingCost, total, pointsCost, pointsEarned: Math.floor(usdSubtotal * 0.5) };
}

const orderItemRows = (orderId, enrichedItems) => enrichedItems.map(item => ({
  orderId,
  productId:       item.productId,
  productOptionId: item.optionId || null,
  productName:     item.option ? `${item.product.name} (${item.option.label})` : item.product.name,
  productBrand:    item.product.brand?.name || '',
  productImageUrl: item.product.imageUrl,
  unitPrice:       item.unitPrice,
  priceType:       item.product.priceType,
  quantity:        item.quantity,
  lineTotal:       item.lineTotal,
}));

// ── Paid from the wallet balance ─────────────────────────────────────────────
async function placeOrder(userId, { items, payCurrency, telegram, delivery: deliveryIn, refund }) {
  const delivery = readDelivery(deliveryIn);
  const refundTo = await readRefund(userId, refund);
  const user = await loadBuyer(userId, telegram);
  const { enrichedItems, usdSubtotal, shippingCost, total, pointsCost, pointsEarned } = await prepareCart(user, items, { delivery: !!delivery });

  // Freeze the conversion now: these prices and quantities are what the order costs
  // in crypto, whatever the market does afterwards.
  const holdings = await balanceService.getHoldings(userId);
  const prices = await getCachedUsdPrices(holdings.map(h => h.currency));
  if (total > 0 && holdings.length && !holdings.some(h => prices[h.currency])) {
    throw fail('Live prices are unavailable right now — please try again in a minute.', 503);
  }
  const payments = total > 0 ? balanceService.allocateUsd(holdings, prices, total, payCurrency) : [];

  const orderFrontendId = formatOrderId(Date.now());

  const result = await prisma.$transaction(async tx => {
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
        ...(delivery || {}),
        ...refundTo,
      },
    });

    await tx.orderItem.createMany({ data: orderItemRows(order.id, enrichedItems) });

    for (const item of enrichedItems) {
      const { count } = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data:  { stock: { decrement: item.quantity } },
      });
      if (count === 0) throw fail(`"${item.product.name}" just sold out. Please review your cart.`, 409);
      if (item.option) {
        const { count: oc } = await tx.productOption.updateMany({
          where: { id: item.option.id, stock: { gte: item.quantity } },
          data:  { stock: { decrement: item.quantity } },
        });
        if (oc === 0) throw fail(`"${item.product.name} (${item.option.label})" just sold out. Please review your cart.`, 409);
      }
    }

    // Debit the crypto holdings at the frozen rates
    for (const p of payments) await balanceService.debit(tx, userId, p.currency, p.amount);

    await tx.user.update({
      where: { id: userId },
      data: {
        points:     { increment: pointsEarned - pointsCost },
        totalSpent: { increment: usdSubtotal },
      },
    });

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
      lines:       enrichedItems.map(i => ({ name: i.option ? `${i.product.name} (${i.option.label})` : i.product.name, quantity: i.quantity, total: i.lineTotal })),
      shipping:    shippingCost,
      total,
      payments,
      user,
      shipTo:      delivery ? shipTo(delivery) : null,
    }),
    balanceService.getUserBalance(userId),
  ]);
  return { ...result, payments, newBalance: balance, invoice };
}

// ── Paid straight in crypto, no wallet balance needed ───────────────────────
// The order is created "awaiting_payment" (stock and points held) with its own deposit
// address and the exact amount to send: the price, frozen in that coin, plus the
// deposit commission, taken when the payment lands. 30 minutes to pay; payments add up.
async function placePendingOrder(userId, { items, coin, telegram, delivery: deliveryIn, refund }) {
  if (!(await cryptoService.payableCoins()).includes(coin)) throw fail(`${coin} payments are not available right now.`, 400);
  const delivery = readDelivery(deliveryIn);
  // A short, late or surplus payment is refunded in the coin paid: the refund address is that coin's
  if (refund?.address && String(refund.currency || coin).toUpperCase() !== coin) {
    throw fail(`The refund address must be a ${coin} address, the coin you pay with.`, 400);
  }
  const refundTo = await readRefund(userId, refund ? { ...refund, currency: coin } : null);
  const user = await loadBuyer(userId, telegram);
  const { enrichedItems, usdSubtotal, shippingCost, total, pointsCost, pointsEarned } = await prepareCart(user, items, { delivery: !!delivery });
  if (!(total > 0)) throw fail('Nothing to pay in crypto: place this order from your wallet.', 400);

  const [price, pct] = await Promise.all([getCachedUsdPrice(coin), balanceService.getCommissionPct()]);
  if (!price) throw fail(`The ${coin} price is unavailable right now. Please try again in a minute.`, 503);
  if (pct >= 100) throw fail('Payments are unavailable right now.', 503);
  // What the order costs in crypto (frozen), and what to send so that it's left after the commission
  const netNeeded = Math.ceil(total / price * 1e8 - 1e-6) / 1e8;
  const gross     = Math.ceil(netNeeded / (1 - pct / 100) * 1e8 - 1e-6) / 1e8;
  const expiresAt = new Date(Date.now() + PAY_WINDOW_MIN * 60 * 1000);

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        frontendId:    formatOrderId(Date.now()),
        userId,
        status:        'awaiting_payment',
        expiresAt,
        subtotal:      usdSubtotal,
        shippingCost,
        totalAmount:   total,
        pointsEarned,
        payments:      [{ currency: coin, amount: netNeeded, rate: price, usd: total }],
        paymentMethod: `crypto:${coin}`,
        ...(delivery || {}),
        ...refundTo,
      },
    });
    await tx.orderItem.createMany({ data: orderItemRows(created.id, enrichedItems) });
    for (const item of enrichedItems) {
      const { count } = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data:  { stock: { decrement: item.quantity } },
      });
      if (count === 0) throw fail(`"${item.product.name}" just sold out. Please review your cart.`, 409);
      if (item.option) {
        const { count: oc } = await tx.productOption.updateMany({
          where: { id: item.option.id, stock: { gte: item.quantity } },
          data:  { stock: { decrement: item.quantity } },
        });
        if (oc === 0) throw fail(`"${item.product.name} (${item.option.label})" just sold out. Please review your cart.`, 409);
      }
    }
    if (pointsCost > 0) await tx.user.update({ where: { id: userId }, data: { points: { decrement: pointsCost } } });
    return created;
  });

  try {
    const { createDeposit } = require('./wallet.service');
    const deposit = await createDeposit(userId, coin, { orderId: order.id, minutes: PAY_WINDOW_MIN, expected: gross });
    return { order, payment: await paymentView(order.id, userId) , deposit, gross, price, pct };
  } catch (err) {
    await cancelPendingOrder(order.id, null).catch(() => {});
    throw err;
  }
}

const pointsHeld = order => Math.round((order.items || [])
  .filter(i => i.priceType === 'points')
  .reduce((s, i) => s + parseFloat(i.lineTotal), 0));

// An unpaid order is released: stock back on the shelf, points given back. `why` null =
// silent. What was already received is refunded (a request an admin approves) and the
// deposit address keeps being watched 24 hours, so a payment arriving later is seen too.
async function cancelPendingOrder(orderId, why = 'expired') {
  const done = await prisma.$transaction(async tx => {
    const { count } = await tx.order.updateMany({ where: { id: orderId, status: 'awaiting_payment' }, data: { status: 'cancelled' } });
    if (!count) return null;
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    for (const i of order.items) {
      if (i.productId) await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
      if (i.productOptionId) await tx.productOption.updateMany({ where: { id: i.productOptionId }, data: { stock: { increment: i.quantity } } });
    }
    const points = pointsHeld(order);
    if (points > 0) await tx.user.update({ where: { id: order.userId }, data: { points: { increment: points } } });
    const dep = await tx.deposit.findUnique({ where: { orderId } });
    if (dep && ['awaiting', 'partial'].includes(dep.status)) {
      await tx.deposit.update({ where: { id: dep.id }, data: { expiresAt: new Date(Date.now() + 24 * 3600 * 1000) } });
    }
    return { order, dep };
  });
  if (!done) return false;
  const { order, dep } = done;
  if (dep && parseFloat(dep.netAmount) > 0) {
    await orderRefunds.request({
      userId: order.userId, orderId, depositId: dep.id, currency: dep.currency,
      amount: parseFloat(dep.netAmount), reason: `payment short when the order was ${why === 'expired' ? 'expired' : 'cancelled'}`,
    }).catch(err => console.error(`[Orders] refund request for #${orderId} failed:`, err.message));
  }
  if (why === 'expired') {
    await notify(order.userId, `Order ${order.frontendId} expired`,
      `No full payment arrived within ${PAY_WINDOW_MIN} minutes, so the order was cancelled. A payment detected after this is refunded.`);
  }
  return true;
}

// Cancels every awaiting order whose payment window is over (run each minute)
async function expirePendingOrders() {
  const due = await prisma.order.findMany({
    where: { status: 'awaiting_payment', expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  let n = 0;
  for (const { id } of due) {
    const done = await cancelPendingOrder(id).catch(err => {
      console.error(`[Orders] Could not cancel unpaid order #${id}:`, err.message);
      return false;
    });
    if (done) n++;
  }
  return n;
}

// A payment reached the order's deposit (commission taken, net credited to the customer's
// holding). `net` = everything received so far, `deltaNet` = this payment. Once the order
// has what it costs it goes to processing; a payment on a cancelled order, or a surplus,
// is refunded (a request an admin approves).
async function settlePendingOrder(orderId, { currency, net, deltaNet, depositId }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  if (order.status !== 'awaiting_payment') {
    await orderRefunds.request({ userId: order.userId, orderId, depositId, currency, amount: deltaNet, reason: 'payment after the order was closed' })
      .catch(err => console.error(`[Orders] refund request for #${orderId} failed:`, err.message));
    return;
  }
  const due = Array.isArray(order.payments) ? order.payments[0] : null;
  if (!due) return;
  if (net + 1e-9 < due.amount * TOLERANCE) {
    const pct = await balanceService.getCommissionPct();
    const rest = Math.ceil((due.amount - net) / (1 - pct / 100) * 1e8) / 1e8;
    await notify(order.userId, `Partial payment for ${order.frontendId}`,
      `${net} ${currency} received after the fee. Send the rest, ${rest.toFixed(8)} ${currency}, to the same address before the order expires.`,
      `/orders/${order.id}/pay`);
    return;
  }

  const pay = { ...due, amount: balanceService.round8(Math.min(due.amount, net)) };
  const settled = await prisma.$transaction(async tx => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'awaiting_payment' },
      data:  { status: 'processing', expiresAt: null, payments: [pay] },
    });
    if (!count) return false;
    await balanceService.debit(tx, order.userId, currency, pay.amount);
    await tx.user.update({
      where: { id: order.userId },
      data:  { totalSpent: { increment: order.subtotal }, points: { increment: order.pointsEarned } },
    });
    await tx.deposit.updateMany({ where: { orderId }, data: { status: 'confirmed', confirmedAt: new Date() } });
    await tx.transaction.create({
      data: {
        frontendId:   formatTxnId(`${Date.now()}-o${order.id}`),
        userId:       order.userId,
        orderId:      order.id,
        type:         'purchase',
        amount:       -pay.usd,
        currency,
        cryptoAmount: -pay.amount,
        rate:         pay.rate,
        status:       'confirmed',
        note:         `Order ${order.frontendId} — ${pay.amount} ${currency} @ $${pay.rate}`,
      },
    });
    return true;
  });
  if (!settled) return;

  const surplus = balanceService.round8(net - pay.amount);
  if (surplus > due.amount * (1 - TOLERANCE)) {
    await orderRefunds.request({ userId: order.userId, orderId, depositId, currency, amount: surplus, reason: 'surplus paid on the order' })
      .catch(err => console.error(`[Orders] surplus refund for #${orderId} failed:`, err.message));
  }

  // The address stays watched a while (cleanup job): a payment sent again is refunded

  await notify(order.userId, `Payment received for ${order.frontendId}`, 'Your order is confirmed and being prepared.');
  const user = await prisma.user.findUnique({ where: { id: order.userId } });
  await sendOrderInvoice({
    orderNumber: order.frontendId,
    lines:       order.items.map(i => ({ name: i.productName, quantity: i.quantity, total: parseFloat(i.lineTotal) })),
    shipping:    parseFloat(order.shippingCost),
    total:       parseFloat(order.totalAmount),
    payments:    [pay],
    user,
    shipTo:      order.shipAddress ? shipTo(order) : null,
    via:         `paid in ${currency} to its own address`,
  });
}

// What the customer needs to pay an awaiting order (address, amount, deadline, received)
async function paymentView(orderId, userId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } });
  if (!order) throw fail('Order not found.', 404);
  const deposit = await prisma.deposit.findUnique({ where: { orderId } });
  const due = Array.isArray(order.payments) ? order.payments[0] : null;
  const pct = await balanceService.getCommissionPct();
  const netReceived = deposit ? parseFloat(deposit.netAmount) : 0;
  const remainingNet = due ? Math.max(0, due.amount - netReceived) : 0;
  const remaining = remainingNet > 0 && pct < 100 ? Math.ceil(remainingNet / (1 - pct / 100) * 1e8 - 1e-6) / 1e8 : 0;
  return {
    order: {
      id: order.id, frontendId: order.frontendId, status: order.status, expiresAt: order.expiresAt,
      totalAmount: order.totalAmount, subtotal: order.subtotal, shippingCost: order.shippingCost,
      shipName: order.shipName, shipAddress: order.shipAddress,
      refundCurrency: order.refundCurrency, refundAddress: order.refundAddress,
      items: order.items,
    },
    deposit: deposit && {
      id: deposit.id, currency: deposit.currency, address: deposit.address, status: deposit.status,
      amountExpected: deposit.amountExpected, amountReceived: deposit.amountReceived, netAmount: deposit.netAmount,
    },
    currency: due?.currency || deposit?.currency || null,
    amountDue: deposit?.amountExpected != null ? parseFloat(deposit.amountExpected) : null,
    remaining,
    commissionPct: pct,
  };
}

// Looks at the blockchain for an awaiting order's payments (BTC / LTC / DOGE / ETH, each
// transaction counted once); XMR is checked by hand.
async function checkOrderPayment(orderId, userId) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, select: { id: true, status: true } });
  if (!order) throw fail('Order not found.', 404);
  const deposit = await prisma.deposit.findUnique({ where: { orderId } });
  let pending = false;
  if (order.status === 'awaiting_payment' && deposit && ['awaiting', 'partial'].includes(deposit.status)) {
    const { syncDeposit } = require('./wallet.service');
    ({ pending } = await syncDeposit(deposit));
  }
  return { ...(await paymentView(orderId, userId)), unconfirmed: pending };
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
  if (!order) throw fail('Order not found.', 404);
  return order;
}

async function cancelOrder(orderId, userId, isAdmin = false) {
  const order = await prisma.order.findFirst({
    where:   { id: orderId, ...(isAdmin ? {} : { userId }) },
    include: { items: true },
  });
  if (!order) throw fail('Order not found.', 404);
  // Not paid yet: released, anything already received is refunded
  if (order.status === 'awaiting_payment') {
    await cancelPendingOrder(order.id, isAdmin ? 'admin' : 'customer');
    return { cancelled: true, refundAmount: 0, refunded: [] };
  }
  if (order.status !== 'processing') throw fail('Only processing orders can be cancelled.');

  const pointsToRefund = pointsHeld(order);

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
    if (!prices[currency]) throw fail('Live prices are unavailable right now — try the refund again in a minute.', 503);
    payments = [{ currency, amount: balanceService.round8(usdTotal / prices[currency]), rate: prices[currency], usd: usdTotal }];
  }

  await prisma.$transaction(async tx => {
    const { count } = await tx.order.updateMany({ where: { id: order.id, status: 'processing' }, data: { status: 'cancelled' } });
    if (!count) throw fail('This order was already cancelled.', 409);

    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      if (item.productOptionId) {
        await tx.productOption.updateMany({ where: { id: item.productOptionId }, data: { stock: { increment: item.quantity } } });
      }
    }

    // Refund the exact crypto quantities paid, to the wallet balance
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
      await tx.user.update({ where: { id: order.userId }, data: { points: { increment: pointsToRefund } } });
    }
  });

  return { cancelled: true, refundAmount: parseFloat(order.totalAmount), refunded: payments };
}

module.exports = {
  PAY_WINDOW_MIN,
  placeOrder, placePendingOrder, cancelPendingOrder, expirePendingOrders, settlePendingOrder,
  paymentView, checkOrderPayment,
  getUserOrders, getOrderById, cancelOrder,
};
