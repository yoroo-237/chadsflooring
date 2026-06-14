import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const BRAND_URL = (slug) => `https://chadsflooring.bz/brand/${slug || ''}`;
const SHIPPING = 16.99;

function HeartIcon({ filled }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? '#e53935' : 'none'} stroke={filled ? '#e53935' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function MinusIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}
function PlusIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}
function WarnIcon() {
  return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>);
}

const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const unit = (p) => parseFloat(String(p.price).replace(/[$P,]/g, '')) || 0;

export default function CartPage() {
  const {
    cartItems, addToCart, removeFromCart, clearCart,
    products = [], wishedIds, toggleWish, balance,
  } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('cart');

  // Group cart items by id, keep their original indices for qty changes
  const groups = [];
  const byId = {};
  cartItems.forEach((item, idx) => {
    const key = item.id ?? item.name;
    if (byId[key] == null) {
      byId[key] = groups.length;
      groups.push({ ...item, qty: 1, indices: [idx] });
    } else {
      const g = groups[byId[key]];
      g.qty += 1;
      g.indices.push(idx);
    }
  });

  const stashItems = products.filter(p => wishedIds.has(p.id));

  const subtotal = cartItems.reduce((s, it) => s + unit(it), 0);
  const shipping = cartItems.length ? SHIPPING : 0;
  const grandTotal = subtotal + shipping;
  const credits = balance;
  const creditsRemaining = credits - grandTotal;
  const creditsDue = Math.max(0, grandTotal - credits);
  const notEnough = creditsDue > 0;

  const incr = (g) => addToCart({ ...g, qty: undefined, indices: undefined });
  const decr = (g) => removeFromCart(g.indices[g.indices.length - 1]);

  return (
    <main className="main-content cartpage">
      {/* Tabs */}
      <div className="cartpage-tabs">
        <button className={`cartpage-tab${tab === 'cart' ? ' active' : ''}`} onClick={() => setTab('cart')}>Cart</button>
        <button className={`cartpage-tab${tab === 'stash' ? ' active' : ''}`} onClick={() => setTab('stash')}>
          <HeartIcon filled={false} /> Stash
        </button>
      </div>

      {tab === 'cart' ? (
        <div className="cartpage-grid">
          {/* Left: items */}
          <div className="cartpage-items">
            {groups.length === 0 ? (
              <div className="cartpage-empty">
                <p>Your cart is empty.</p>
                <button className="cartpage-link" onClick={() => navigate('/')}>Start shopping</button>
              </div>
            ) : groups.map((g) => (
              <div key={g.id ?? g.name} className="cartcard">
                <button
                  className={`cartcard-heart${wishedIds.has(g.id) ? ' active' : ''}`}
                  onClick={() => toggleWish(g.id)}
                  aria-label="Move to stash"
                >
                  <HeartIcon filled={wishedIds.has(g.id)} />
                </button>
                <img
                  className="cartcard-img"
                  src={g.image}
                  alt={g.name}
                  onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                />
                <div className="cartcard-main">
                  <button className="cartcard-close" onClick={() => g.indices.forEach((_, i) => decr(g))} aria-label="Remove"><XIcon /></button>
                  <h3 className="cartcard-title">{g.name}</h3>
                  <a className="cartcard-brand" href={BRAND_URL(g.brandSlug)} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{g.brand}</a>
                  <div className="cartcard-price">{g.price}</div>
                  <div className="cartcard-bottom">
                    <span className="cartcard-variant">{g.name}</span>
                    <div className="cartcard-stepper">
                      <button className="cartcard-step" onClick={() => decr(g)} aria-label="Decrease"><MinusIcon /></button>
                      <span className="cartcard-qty">{g.qty}</span>
                      <button className="cartcard-step" onClick={() => incr(g)} aria-label="Increase"><PlusIcon /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: order summary */}
          <aside className="ordersum">
            <h3 className="ordersum-title">Order Summary</h3>

            <div className="ordersum-group">
              <div className="ordersum-row"><span>Subtotal (credits):</span><span>{money(subtotal)}</span></div>
              <div className="ordersum-row"><span>Subtotal (points):</span><span>P0</span></div>
            </div>
            <div className="ordersum-divider" />

            <div className="ordersum-group">
              <div className="ordersum-row"><span>Shipping:</span><span>{money(shipping)}</span></div>
              <div className="ordersum-row muted"><span>Regular shipping:</span><span>{money(0)}</span></div>
              <div className="ordersum-row muted"><span>Require signature:</span><span>{money(0)}</span></div>
            </div>
            <div className="ordersum-divider" />

            <div className="ordersum-group">
              <div className="ordersum-row"><span>Your credits:</span><span>{money(credits)}</span></div>
              <div className="ordersum-row"><span>Credits remaining:</span><span className={creditsRemaining < 0 ? 'neg' : ''}>{money(creditsRemaining)}</span></div>
            </div>
            <div className="ordersum-divider" />

            <div className="ordersum-group">
              <div className="ordersum-row"><span>Your points:</span><span>P0</span></div>
              <div className="ordersum-row"><span>Points remaining:</span><span>P0</span></div>
            </div>
            <div className="ordersum-divider" />

            <div className="ordersum-group">
              <div className="ordersum-row strong"><span>Credits due:</span><span>{money(creditsDue)}</span></div>
              <div className="ordersum-row strong"><span>Points due:</span><span>P0 ($0.00)</span></div>
            </div>

            {notEnough ? (
              <>
                <div className="ordersum-warning">
                  <div className="ordersum-warning-head"><WarnIcon /> Not enough credits</div>
                  <p>Please deposit credits into your account before proceeding to checkout.</p>
                </div>
                <button className="ordersum-cta" onClick={() => navigate('/wallet')}>Deposit Credits</button>
              </>
            ) : (
              <button className="ordersum-cta" disabled={!cartItems.length} onClick={() => navigate('/checkout')}>Proceed to Checkout</button>
            )}
          </aside>
        </div>
      ) : (
        /* Stash tab */
        <div className="cartpage-stash">
          {stashItems.length === 0 ? (
            <div className="cartpage-empty">
              <p>Your stash is empty.</p>
              <button className="cartpage-link" onClick={() => navigate('/')}>Browse products</button>
            </div>
          ) : (
            <div className="stash-grid">
              {stashItems.map(p => (
                <div key={p.id} className="cartcard stashcard">
                  <button className="cartcard-heart active" onClick={() => toggleWish(p.id)} aria-label="Remove from stash">
                    <HeartIcon filled={true} />
                  </button>
                  <img className="cartcard-img" src={p.image} alt={p.name} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  <div className="cartcard-main">
                    <h3 className="cartcard-title">{p.name}</h3>
                    <a className="cartcard-brand" href={BRAND_URL(p.brandSlug)} target="_blank" rel="noreferrer">{p.brand}</a>
                    <div className="cartcard-price">{p.price}</div>
                    <div className="cartcard-bottom">
                      <span className="cartcard-variant">{p.name}</span>
                      <button className="stash-add-btn" onClick={() => { addToCart(p); setTab('cart'); }}>Add to Cart</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
