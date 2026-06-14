import React from 'react';
import { useNavigate } from 'react-router-dom';
import StarRating from './StarRating';

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}
function HeartIcon({ filled }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill={filled ? '#e53935' : 'transparent'} stroke={filled ? '#e53935' : 'currentColor'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

export default function ProductCard({ product, onAddToCart, delay = 0, wished = false, onWishToggle }) {
  const navigate = useNavigate();
  const isLowStock = product.stock > 0 && product.stock <= 10;
  const inStock = product.stock > 0;
  const stockLabel = product.stock >= 250 ? '250+ left' : `${product.stock} left`;

  return (
    <div
      className="product-card"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => navigate(`/product/${product.id}`)}
    >
      <div className="card-header">
        <a
          href={`https://chadsflooring.bz/brand/${product.brandSlug}`}
          className="card-brand"
          onClick={e => e.stopPropagation()}
          target="_blank"
          rel="noreferrer"
        >
          {product.brand}
        </a>
        <button
          className={`wishlist-btn${wished ? ' active' : ''}`}
          onClick={e => { e.stopPropagation(); onWishToggle && onWishToggle(product.id); }}
          title={wished ? 'Remove from stash' : 'Add to stash'}
        >
          <HeartIcon filled={wished} />
        </button>
      </div>

      <span className="card-title" title={product.name}>{product.name}</span>
      {product.options && (
        <div className="card-options">{product.options} options</div>
      )}

      <div className="card-image-wrap">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={e => { e.target.style.opacity = '.25'; }}
        />
        <div className="quick-add">
          <button
            className="quick-add-btn"
            onClick={e => { e.stopPropagation(); if (inStock) onAddToCart(product); }}
            disabled={!inStock}
          >
            <CartIcon />
            {inStock ? 'Add to cart' : 'Out of stock'}
          </button>
        </div>
      </div>

      <div className="card-footer">
        <div className="card-meta">
          <span className={`card-stock${isLowStock ? ' low' : ''}`}>
            {inStock ? stockLabel : 'Out of stock'}
          </span>
          <span className="card-price">{product.price}</span>
        </div>
        <StarRating rating={product.rating} count={product.reviewCount} />
      </div>
    </div>
  );
}
