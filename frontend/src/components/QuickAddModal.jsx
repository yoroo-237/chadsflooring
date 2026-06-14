import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import StarRating from './StarRating';

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function MinusIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}
function PlusIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}

export default function QuickAddModal() {
  const { quickAddItem, closeQuickAdd, addManyToCart } = useApp();
  const [qty, setQty] = useState(1);

  useEffect(() => { setQty(1); }, [quickAddItem]);

  if (!quickAddItem) return null;
  const p = quickAddItem;
  const stock = p.stock ?? 250;
  const stockLabel = stock >= 250 ? '250+' : stock;

  const add = () => { addManyToCart(p, qty); closeQuickAdd(); };

  return (
    <div className="qadd-overlay" onClick={closeQuickAdd}>
      <div className="qadd-modal" onClick={e => e.stopPropagation()}>
        <button className="qadd-close" onClick={closeQuickAdd} aria-label="Close"><CloseIcon /></button>

        <div className="qadd-image">
          <img src={p.image} alt={p.name} onError={e => { e.currentTarget.style.opacity = '.3'; }} />
        </div>

        <div className="qadd-info">
          <div className="qadd-top">
            <span className="qadd-price">{p.price}</span>
            <div className="qadd-titles">
              <a className="qadd-brand" href={p.brandSlug ? `https://chadsflooring.bz/brand/${p.brandSlug}` : '#'} onClick={e => e.stopPropagation()} target="_blank" rel="noreferrer">{p.brand}</a>
              <div className="qadd-name-row">
                <StarRating rating={p.rating} count={p.reviewCount} />
              </div>
              <h3 className="qadd-name">{p.name}</h3>
            </div>
          </div>

          <div className="qadd-amount-label">Amount ({stockLabel} in stock)</div>
          <div className="qadd-stepper">
            <button className="qadd-step-btn" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease"><MinusIcon /></button>
            <span className="qadd-qty">{qty}</span>
            <button className="qadd-step-btn" onClick={() => setQty(q => Math.min(stock, q + 1))} aria-label="Increase"><PlusIcon /></button>
          </div>

          <button className="qadd-cta" onClick={add}>
            <PlusIcon /> Add To Cart
          </button>
        </div>
      </div>
    </div>
  );
}
