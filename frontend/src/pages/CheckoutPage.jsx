import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

function ArrowLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function CheckoutPage() {
  const { cartItems, placeOrder, balance, settings } = useApp();
  const navigate = useNavigate();

  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced]   = useState(null);
  const [serverErr, setServerErr] = useState('');

  const shippingCost  = Number(settings?.shipping_cost           || 16.99);
  const freeThreshold = Number(settings?.shipping_free_threshold || 75);

  const subtotal = cartItems.reduce((sum, item) => {
    return sum + (parseFloat(String(item.price).replace(/[$P]/g, '')) || 0);
  }, 0);

  const shippingFee = (freeThreshold > 0 && subtotal >= freeThreshold) ? 0 : shippingCost;
  const total = subtotal + shippingFee;
  const hasEnoughBalance = balance >= total;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasEnoughBalance) return;
    setPlacing(true); setServerErr('');
    try {
      const order = await placeOrder();
      setPlaced(order);
    } catch (err) {
      setServerErr(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  if (cartItems.length === 0 && !placed) {
    return (
      <main className="main-content">
        <div className="page-container">
          <div className="empty-state">
            <h3>Your cart is empty</h3>
            <p>Add some products before checking out.</p>
            <Link to="/" className="btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>Go to Shop</Link>
          </div>
        </div>
      </main>
    );
  }

  if (placed) {
    return (
      <main className="main-content">
        <div className="page-container">
          <div className="order-success">
            <div className="order-success-icon"><CheckIcon /></div>
            <h1 className="order-success-title">Order Confirmed!</h1>
            <p className="order-success-sub">Order <strong>{placed.id || placed.orderId}</strong></p>
            <p className="order-success-desc">
              Thank you for your purchase. Your order is being processed and you'll receive a confirmation shortly.
            </p>
            <div className="order-success-actions">
              <Link to="/orders" className="btn-primary">View Orders</Link>
              <Link to="/" className="btn-secondary">Continue Shopping</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <div className="page-container">
        <div className="breadcrumb">
          <button className="breadcrumb-back" onClick={() => navigate(-1)}>
            <ArrowLeftIcon /> Back
          </button>
          <span className="breadcrumb-sep">/</span>
          <Link to="/" className="breadcrumb-link">Shop</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Checkout</span>
        </div>

        <h1 className="page-title">Checkout</h1>

        {serverErr && (
          <div style={{ background: 'rgba(229,57,53,.1)', color: '#e53935', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            {serverErr}
          </div>
        )}

        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={handleSubmit}>
            <div className="checkout-section">
              <h3 className="checkout-section-title">Payment</h3>
              <p className="payment-note">Your order is paid instantly from your wallet balance.</p>
              <div className="summary-row" style={{ marginTop: 8 }}>
                <span>Wallet balance</span>
                <span>${balance.toFixed(2)}</span>
              </div>
            </div>

            {!hasEnoughBalance && (
              <div className="checkout-balance-error">
                Insufficient balance — your wallet has ${balance.toFixed(2)} but this order costs ${total.toFixed(2)}.{' '}
                <Link to="/wallet">Top up your wallet →</Link>
              </div>
            )}

            <button type="submit" className="btn-checkout-submit" disabled={placing || !hasEnoughBalance}>
              {placing ? 'Processing…' : `Place Order — $${total.toFixed(2)}`}
            </button>
          </form>

          <div className="checkout-summary">
            <h3 className="checkout-section-title">Order Summary</h3>
            <div className="summary-items">
              {cartItems.map((item, i) => (
                <div key={i} className="summary-item">
                  <img src={item.image} alt={item.name} className="summary-item-img" onError={e => { e.target.style.opacity = '0'; }} />
                  <div className="summary-item-info">
                    <div className="summary-item-brand">{item.brand}</div>
                    <div className="summary-item-name">{item.name}</div>
                  </div>
                  <div className="summary-item-price">{item.price}</div>
                </div>
              ))}
            </div>
            <div className="summary-totals">
              <div className="summary-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              <div className="summary-row">
                <span>Shipping</span>
                <span className={shippingFee === 0 ? 'text-green' : ''}>{shippingFee === 0 ? 'Free' : `$${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="summary-row summary-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
