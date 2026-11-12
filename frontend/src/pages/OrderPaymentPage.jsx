import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../utils/api';
import { useApp } from '../context/AppContext';

const URI_SCHEME = { BTC: 'bitcoin', LTC: 'litecoin', DOGE: 'dogecoin', ETH: 'ethereum', XMR: 'monero' };
const AUTO_CHECK = ['BTC', 'LTC', 'DOGE'];
const fmt = n => (n == null ? '' : Number(n).toFixed(8).replace(/\.?0+$/, ''));

function countdown(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return '00:00';
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// The payment screen of an order paid straight in crypto: its own address, the exact
// amount, the time left. Payments add up; the page checks the blockchain every 30 s
// and moves on as soon as the order is paid. It can be reopened from Orders.
export default function OrderPaymentPage() {
  const { id } = useParams();
  const { showToast, refreshBalance } = useApp();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [checking, setChecking] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [copied, setCopied]   = useState('');
  const [cancelling, setCancelling] = useState(false);

  const status = data?.order?.status;
  const currency = data?.currency;
  const awaiting = status === 'awaiting_payment';

  const load = useCallback(() => api.get(`/orders/${id}/payment`).then(setData).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const next = AUTO_CHECK.includes(currency) ? await api.post(`/orders/${id}/payment/check`) : await api.get(`/orders/${id}/payment`);
      setData(next);
    } catch { /* checked again at the next tick */ }
    finally { setChecking(false); }
  }, [id, currency]);

  useEffect(() => {
    if (!awaiting) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30000);
    return () => clearInterval(t);
  }, [awaiting, check]);

  useEffect(() => {
    if (!awaiting || !data?.order?.expiresAt) return;
    const tick = () => {
      setTimeLeft(countdown(data.order.expiresAt));
      if (new Date(data.order.expiresAt) <= Date.now()) load();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [awaiting, data?.order?.expiresAt, load]);

  useEffect(() => { if (status === 'processing') refreshBalance?.(); }, [status, refreshBalance]);

  const copy = (text, what) => navigator.clipboard?.writeText(String(text)).then(() => { setCopied(what); setTimeout(() => setCopied(''), 2000); });

  const cancel = async () => {
    if (!window.confirm('Cancel this order? Anything already received is refunded.')) return;
    setCancelling(true);
    try { await api.patch(`/orders/${id}/cancel`); await load(); showToast?.('Order cancelled.', 'success'); }
    catch (e) { showToast?.(e.message, 'error'); }
    finally { setCancelling(false); }
  };

  if (error) {
    return (
      <main className="main-content"><div className="page-container"><div className="empty-state">
        <h3>Order not found</h3><p>{error}</p>
        <Link to="/orders" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>View Orders</Link>
      </div></div></main>
    );
  }
  if (!data) return <main className="main-content"><div className="page-container" style={{ padding: 40, color: 'var(--text-muted)' }}>Loading…</div></main>;

  const { order, deposit } = data;
  const received = deposit ? Number(deposit.amountReceived) : 0;
  const toSend = received > 0 ? data.remaining : data.amountDue;
  const qr = deposit?.address
    ? `${URI_SCHEME[currency] || currency.toLowerCase()}:${deposit.address}${AUTO_CHECK.includes(currency) && toSend ? `?amount=${fmt(toSend)}` : ''}`
    : '';

  if (status === 'processing' || status === 'shipped' || status === 'delivered') {
    return (
      <main className="main-content"><div className="page-container"><div className="order-success">
        <div className="order-success-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="order-success-title">Payment received</h1>
        <p className="order-success-sub">Order <strong>{order.frontendId}</strong></p>
        <p className="order-success-desc">Your order is paid and being prepared. {order.shipAddress ? 'We’ll message you when it ships.' : 'The shop will reach you on Telegram to arrange it.'}</p>
        <div className="order-success-actions">
          <Link to="/orders" className="btn-primary">View Orders</Link>
          <Link to="/" className="btn-secondary">Continue Shopping</Link>
        </div>
      </div></div></main>
    );
  }

  if (!awaiting) {
    return (
      <main className="main-content"><div className="page-container"><div className="empty-state">
        <h3>Order {order.frontendId} was cancelled</h3>
        <p>{received > 0 ? `${fmt(received)} ${currency} received for it is being refunded.` : 'No payment was received for it.'} A payment sent to its address now is refunded too.</p>
        <Link to="/orders" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>View Orders</Link>
      </div></div></main>
    );
  }

  return (
    <main className="main-content">
      <div className="page-container">
        <h1 className="page-title">Pay order {order.frontendId}</h1>
        <div className="pay-layout">
          <div className="checkout-section pay-card">
            <div className="pay-head">
              <span className="pay-coin">{currency}</span>
              <span className="pay-timer" aria-live="polite">Time left <b>{timeLeft}</b></span>
            </div>

            {qr && <div className="pay-qr"><QRCodeSVG value={qr} size={196} className="wallet-qr-svg" includeMargin /></div>}

            <div className="pay-line">
              <span className="pay-label">{received > 0 ? 'Still to send' : 'Amount to send'}</span>
              <div className="pay-copy">
                <code>{fmt(toSend)} {currency}</code>
                <button type="button" className={`credits-copy-btn${copied === 'amount' ? ' copied' : ''}`} onClick={() => copy(fmt(toSend), 'amount')}>{copied === 'amount' ? 'Copied' : 'Copy'}</button>
              </div>
            </div>
            <div className="pay-line">
              <span className="pay-label">To this address</span>
              <div className="pay-copy">
                <code className="pay-address">{deposit?.address}</code>
                <button type="button" className={`credits-copy-btn${copied === 'address' ? ' copied' : ''}`} onClick={() => copy(deposit?.address, 'address')}>{copied === 'address' ? 'Copied' : 'Copy'}</button>
              </div>
            </div>

            {received > 0 && (
              <p className="pay-received">Received so far: {fmt(received)} {currency}. Send the rest to the same address.</p>
            )}

            <p className="checkout-rate-note">
              Send exactly this amount, in {currency} only. It is priced for this order and includes the {data.commissionPct/10}% deposit fee.
              {' '}Several payments add up. Anything sent after the time runs out, or above the amount, is refunded{order.refundAddress ? ` to ${order.refundAddress.slice(0, 10)}…` : ' to your wallet balance'}.
            </p>

            {AUTO_CHECK.includes(currency) ? (
              <p className="checkout-rate-note">Confirmed after 1 blockchain confirmation. This page checks every 30 seconds.</p>
            ) : currency === 'ETH' ? (
              <p className="checkout-rate-note">ETH payments are detected automatically within a few minutes.</p>
            ) : (
              <p className="checkout-rate-note">Monero payments are checked by hand: after sending, <Link to="/support">open a support ticket</Link> with the transaction ID.</p>
            )}

            <div className="pay-actions">
              <button type="button" className="btn-primary" onClick={check} disabled={checking}>{checking ? 'Checking…' : 'I sent it, check now'}</button>
              <button type="button" className="btn-secondary" onClick={cancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel order'}</button>
            </div>
          </div>

          <div className="checkout-summary">
            <h3 className="checkout-section-title">Order Summary</h3>
            <div className="summary-items">
              {order.items.map(i => (
                <div key={i.id} className="summary-item">
                  <img src={i.productImageUrl} alt={i.productName} className="summary-item-img" onError={e => { e.target.style.opacity = '0'; }} />
                  <div className="summary-item-info">
                    <div className="summary-item-brand">{i.productBrand}</div>
                    <div className="summary-item-name">{i.quantity} × {i.productName}</div>
                  </div>
                  <div className="summary-item-price">${Number(i.lineTotal).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="summary-totals">
              <div className="summary-row"><span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span></div>
              <div className="summary-row"><span>Delivery</span><span>{!order.shipAddress ? 'None' : Number(order.shippingCost) ? `$${Number(order.shippingCost).toFixed(2)}` : 'Free'}</span></div>
              <div className="summary-row summary-total"><span>Total</span><span>${Number(order.totalAmount).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
