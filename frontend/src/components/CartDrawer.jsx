import React from 'react';
import { useApp } from '../context/AppContext';

function ShoppingBag() {
  return (
    <svg className="cart-bag-img" width="90" height="105" viewBox="0 0 93 109" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M80.3123 106.122H13.7663C8.78247 106.122 4.74243 102.075 4.74243 97.0816V6.50505C4.74243 5.0506 5.91927 3.87134 7.37129 3.87134H86.7078C88.1596 3.87134 89.3367 5.05034 89.3367 6.50505V97.0816C89.3364 102.075 85.2961 106.122 80.3123 106.122Z" fill="#EC6178"/>
      <path d="M89.3355 6.50578V97.0811C89.3355 102.074 85.2952 106.122 80.3108 106.122H71.1443C76.1258 106.122 80.1661 102.075 80.1661 97.0811V6.50578C80.1661 5.04929 78.991 3.87207 77.5372 3.87207H86.7063C88.1576 3.87207 89.3355 5.04929 89.3355 6.50578Z" fill="#D23F57"/>
      <path d="M89.3352 6.5057V21.129H4.74243V6.5057C4.74243 5.04972 5.91875 3.87378 7.37206 3.87378H86.7055C88.1588 3.87378 89.3352 5.04946 89.3352 6.5057Z" fill="#4B566B"/>
      <path d="M15.8017 12.4993V21.1272H4.74146L15.8017 12.4993Z" fill="#4B566B"/>
      <path d="M78.2755 12.4993V21.1272H89.3357L78.2755 12.4993Z" fill="#4B566B"/>
      <path d="M86.7068 3.87158L78.2755 12.4996L89.3357 21.1275V6.50504C89.3357 5.05059 88.1586 3.87158 86.7068 3.87158Z" fill="#879AB0"/>
      <path d="M7.37032 3.87231L15.8017 12.5003L4.74146 21.128V6.50577C4.74146 5.05132 5.91855 3.87231 7.37032 3.87231Z" fill="#879AB0"/>
      <path d="M47.0386 82.9143C35.3509 82.9143 25.8423 73.3881 25.8423 61.6788V46.0203C25.8423 44.9295 26.725 44.0452 27.8138 44.0452C28.9026 44.0452 29.7853 44.9295 29.7853 46.0203V61.6788C29.7853 71.2099 37.5251 78.964 47.0386 78.964C56.552 78.964 64.2918 71.2099 64.2918 61.6788V45.9236C64.2918 44.8329 65.1746 43.9485 66.2634 43.9485C67.3521 43.9485 68.2349 44.8329 68.2349 45.9236V61.6788C68.2349 73.3881 58.7263 82.9143 47.0386 82.9143Z" fill="#E3364E"/>
      <path d="M47.0386 76.3016C35.3667 76.3016 25.8708 66.7882 25.8708 55.0948V39.4363C25.8708 38.3611 26.7408 37.4898 27.8138 37.4898C28.887 37.4898 29.7567 38.3613 29.7567 39.4363V55.0948C29.7567 64.6417 37.5093 72.4083 47.0383 72.4083C56.5673 72.4083 64.3199 64.6414 64.3199 55.0948V39.3393C64.3199 38.2642 65.1899 37.3928 66.2628 37.3928C67.336 37.3928 68.206 38.2644 68.206 39.3393V55.0948C68.2063 66.7885 58.7104 76.3016 47.0386 76.3016Z" fill="#F6F9FC"/>
      <path d="M66.2634 39.4367C68.6869 39.4367 70.6516 37.4684 70.6516 35.0404C70.6516 32.6124 68.6869 30.644 66.2634 30.644C63.8398 30.644 61.8751 32.6124 61.8751 35.0404C61.8751 37.4684 63.8398 39.4367 66.2634 39.4367Z" fill="#AEB4BE"/>
      <path d="M27.8138 39.4367C30.2373 39.4367 32.202 37.4684 32.202 35.0404C32.202 32.6124 30.2373 30.644 27.8138 30.644C25.3902 30.644 23.4255 32.6124 23.4255 35.0404C23.4255 37.4684 25.3902 39.4367 27.8138 39.4367Z" fill="#AEB4BE"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  );
}
function WarnIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );
}

export default function CartDrawer({ isOpen, onClose, items, onRemove, onCheckout, onDeposit }) {
  const { balance, clearCart, addToCart } = useApp();
  if (!isOpen) return null;

  // Group identical products and keep a representative + the original indices
  const groups = [];
  const byId = {};
  items.forEach((item, idx) => {
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

  const unit = (it) => parseFloat(String(it.price).replace(/[$P,]/g, '')) || 0;
  const total = items.reduce((sum, it) => sum + unit(it), 0);
  const hasEnoughBalance = balance >= total;
  const empty = items.length === 0;

  const incr = (g) => addToCart && addToCart({ ...g, qty: undefined, indices: undefined });
  const decr = (g) => onRemove(g.indices[g.indices.length - 1]);

  return (
    <div className="cart-modal-overlay" onClick={onClose}>
      <div className={`cart-modal${empty ? '' : ' cart-modal--filled'}`} onClick={e => e.stopPropagation()}>
        <div className="cart-modal-head">
          <h3 className="cart-modal-title">Cart</h3>
          <div className="cart-modal-actions">
            <button
              className="cart-empty-btn"
              onClick={() => { if (clearCart) clearCart(); }}
              disabled={empty}
            >
              <TrashIcon /> Empty Cart
            </button>
            <button className="cart-close-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
          </div>
        </div>

        {empty ? (
          <div className="cart-modal-empty">
            <ShoppingBag />
            <p className="cart-empty-text">
              Your shopping bag is empty.{' '}
              <button className="cart-start-link" onClick={onClose}>Start shopping</button>
            </p>
          </div>
        ) : (
          <>
            <div className="cart-modal-body">
              {groups.map((g) => (
                <div key={g.id ?? g.name} className="cart-row">
                  <img
                    src={g.image}
                    alt={g.name}
                    className="cart-row-img"
                    onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                  />
                  <div className="cart-row-name">{g.name}</div>
                  <div className="cart-row-price">{g.price}</div>
                  <div className="cart-stepper">
                    <button className="cart-step-btn" onClick={() => decr(g)} aria-label="Decrease"><MinusIcon /></button>
                    <span className="cart-step-qty">{g.qty}</span>
                    <button className="cart-step-btn" onClick={() => incr(g)} aria-label="Increase"><PlusIcon /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-modal-footer">
              {!hasEnoughBalance && (
                <div className="cart-credits-banner"><WarnIcon /> Not enough credits</div>
              )}
              <div className="cart-actions-row">
                <button className="cart-secondary-btn" onClick={onCheckout}>View Cart Or Stash</button>
                {hasEnoughBalance ? (
                  <button className="cart-primary-btn" onClick={onCheckout}>Checkout</button>
                ) : (
                  <button className="cart-primary-btn" onClick={() => onDeposit && onDeposit()}>Deposit Credits</button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
