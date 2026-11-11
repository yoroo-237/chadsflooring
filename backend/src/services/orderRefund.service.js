const prisma = require('../db');
const balanceService = require('./balance.service');
const { refundFromDeposit } = require('./crypto.service');
const { formatTxnId } = require('../utils/formatters');

// Refunds of orders paid straight in crypto, approved by an admin: a payment after the
// 30 minutes, a short payment on an order that expired, a surplus. A request takes its
// amount off the customer's holding at once (so it can't be spent meanwhile); keeping
// it in the wallet instead (reject) gives it back.

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

async function notify(userId, title, body) {
  await prisma.notification.create({ data: { userId, type: 'order', title, body, link: '/orders' } }).catch(() => {});
}

// The refund address: the one given at checkout, else the profile's for that coin
async function refundAddressFor(userId, order, currency) {
  if (order?.refundAddress && (!order.refundCurrency || order.refundCurrency === currency)) return order.refundAddress;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { btcRefundAddress: true, xmrRefundAddress: true } });
  if (currency === 'BTC') return user?.btcRefundAddress || null;
  if (currency === 'XMR') return user?.xmrRefundAddress || null;
  return null;
}

async function request({ userId, orderId = null, depositId, currency, amount, reason }) {
  const qty = balanceService.round8(Number(amount));
  if (!(qty > 0)) return null;
  const order = orderId
    ? await prisma.order.findUnique({ where: { id: orderId }, select: { frontendId: true, refundAddress: true, refundCurrency: true } })
    : null;
  const address = await refundAddressFor(userId, order, currency);
  const req = await prisma.$transaction(async tx => {
    // The money is on the customer's holding: it leaves it now (never below what is there)
    const row = await tx.walletHolding.findUnique({ where: { userId_currency: { userId, currency } } });
    const held = row ? parseFloat(row.amount) : 0;
    const take = balanceService.round8(Math.min(qty, held));
    if (!(take > 0)) return null;
    await balanceService.debit(tx, userId, currency, take);
    return tx.refundRequest.create({ data: { userId, orderId, depositId, currency, amount: take, address, reason } });
  });
  if (req) {
    await notify(userId, 'Refund requested',
      `${req.amount} ${currency}${order ? ` for order ${order.frontendId}` : ''} (${reason}). The shop reviews it, then sends it to ${address ? 'your refund address' : 'you: add a refund address in your profile, or it stays in your wallet'}.`);
  }
  return req;
}

function list(status) {
  return prisma.refundRequest.findMany({
    where: status ? { status } : {},
    orderBy: { id: 'desc' },
    take: 200,
    include: { user: { select: { id: true, username: true, btcRefundAddress: true, xmrRefundAddress: true } } },
  });
}

async function finish(req, txHash) {
  await prisma.$transaction(async tx => {
    // Guarded by its status: a double click or a reject at the same moment can't also go through
    const { count } = await tx.refundRequest.updateMany({
      where: { id: req.id, status: req.status },
      data:  { status: 'refunded', txHash, decidedAt: new Date() },
    });
    if (!count) throw fail('This refund was already handled', 409);
    await tx.transaction.create({
      data: {
        frontendId:   formatTxnId(`${Date.now()}-r${req.id}`),
        userId:       req.userId,
        orderId:      req.orderId,
        type:         'refund',
        amount:       0,
        currency:     req.currency,
        cryptoAmount: -req.amount,
        status:       'confirmed',
        txHash:       txHash || null,
        note:         `Refund sent to ${req.address}: ${req.reason}`,
      },
    });
  });
  await notify(req.userId, 'Refund sent', `${req.amount} ${req.currency} was sent to ${req.address}.`);
}

// Approve: the refund is sent from the deposit address. XMR (no key here) is sent by
// hand from the shop's wallet, then marked as sent with its transaction id.
async function approve(id, address = null) {
  if (address) {
    await prisma.refundRequest.updateMany({ where: { id, status: 'pending' }, data: { address: String(address).trim().slice(0, 200) } });
  }
  const { count } = await prisma.refundRequest.updateMany({ where: { id, status: 'pending' }, data: { status: 'sending', error: null } });
  if (!count) throw fail('This refund is not waiting for approval', 409);
  const req = await prisma.refundRequest.findUnique({ where: { id } });
  let txHash;
  try {
    if (!req.address) throw fail('No refund address: enter one, or keep the amount in the customer\'s wallet');
    if (req.currency === 'XMR') {
      await prisma.refundRequest.update({ where: { id }, data: { status: 'manual' } });
      return { status: 'manual', address: req.address, amount: req.amount };
    }
    const dep = await prisma.deposit.findUnique({ where: { id: req.depositId } });
    if (!dep) throw fail('Deposit not found', 404);
    // What is left on a swept address is the reserve's commission, not this refund's money
    if (dep.shopSweptAt) throw fail('This deposit was already swept: send the refund by hand, or keep it in the wallet', 409);
    ({ txHash } = await refundFromDeposit(dep, req.amount, req.address));
  } catch (err) {
    // Nothing was sent: back to pending, with the reason, to retry or reject
    await prisma.refundRequest.update({
      where: { id },
      data:  { status: 'pending', error: String(err.response?.data?.error || err.message).slice(0, 500) },
    });
    throw err;
  }
  // The money has left: whatever happens now, it never goes back to pending (a retry would send it twice)
  try {
    await finish(req, txHash);
  } catch (err) {
    await prisma.refundRequest.update({ where: { id }, data: { txHash, error: `Sent, but not recorded: ${err.message}`.slice(0, 500) } }).catch(() => {});
    throw err;
  }
  return { status: 'refunded', txHash };
}

// A refund sent by hand (XMR): the admin gives the transaction id
async function markSent(id, txHash) {
  const req = await prisma.refundRequest.findUnique({ where: { id } });
  if (!req || req.status !== 'manual') throw fail('This refund is not waiting to be sent by hand', 409);
  await finish(req, String(txHash || '').trim().slice(0, 200) || null);
  return { status: 'refunded' };
}

// Not sent: the amount goes back to the customer's wallet balance
async function keepInWallet(id) {
  const req = await prisma.refundRequest.findUnique({ where: { id } });
  if (!req || !['pending', 'manual'].includes(req.status)) throw fail('This refund can no longer be changed', 409);
  const done = await prisma.$transaction(async tx => {
    const { count } = await tx.refundRequest.updateMany({ where: { id, status: req.status }, data: { status: 'rejected', decidedAt: new Date() } });
    if (count) await balanceService.credit(tx, req.userId, req.currency, Number(req.amount));
    return count > 0;
  });
  if (done) await notify(req.userId, 'Refund added to your wallet', `${req.amount} ${req.currency} is back in your wallet balance.`);
  return { status: 'rejected' };
}

module.exports = { request, list, approve, markSent, keepInWallet };
