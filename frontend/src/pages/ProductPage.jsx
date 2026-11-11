import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StarRating from '../components/StarRating';
import CategoryNav from '../components/CategoryNav';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';

function MinusIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}
function PlusIcon() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>);
}
function ChevronDown() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>);
}
function ShieldCheck() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>);
}
function ImageIcon() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>);
}

const DESCRIPTION =
  'Crafted by one of the most trusted names in the category, this product pairs reliable performance with a clean, modern design. Built to last and ready for everyday use — exactly what you expect from a premium pick.';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, normalizeProduct } = useApp();

  const [product, setProduct]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [qty, setQty]           = useState(1);
  const [optionOpen, setOptionOpen] = useState(false);
  const [optionIdx, setOptionIdx]   = useState(0);
  const [imageIdx, setImageIdx]     = useState(0);

  useEffect(() => {
    setLoading(true);
    api.get(`/products/${id}`)
      .then(data => {
        const p = data.product || data;
        setProduct(normalizeProduct(p));
        // First variant still in stock
        const firstInStock = (p.variants || []).findIndex(v => v.stock > 0);
        setOptionIdx(firstInStock > 0 ? firstInStock : 0);
        setImageIdx(0);
        setQty(1);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id, normalizeProduct]);

  if (loading) {
    return (
      <main className="main-content">
        <div className="page-container">
          <div className="empty-state"><p>Loading…</p></div>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="main-content">
        <div className="page-container">
          <div className="empty-state">
            <h3>Product not found</h3>
            <p>This product doesn't exist or has been removed.</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>Back to Shop</button>
          </div>
        </div>
      </main>
    );
  }

  // The real variants (flavor, strain, size), each with its own price and stock
  const variants  = product.variants || [];
  const variant   = variants[optionIdx] || null;
  const optionLabels = variants.length
    ? variants.map(v => `${v.label}${v.stock > 0 ? '' : ' (sold out)'}`)
    : [`${product.brand} ${product.name}`];

  const stock     = variant ? variant.stock : (product.stock || 0);
  const inStock   = stock > 0;
  const reviewCount = product.reviewCount || 0;
  const rating    = product.rating || 0;
  const priceLabel = variant ? `$${Number(variant.price).toFixed(2)}` : product.price;
  const gallery   = [product.image, ...(product.images || [])].filter((u, i, a) => u && a.indexOf(u) === i);

  const cartItem = variant
    ? { ...product, optionId: variant.id, optionLabel: variant.label, name: `${product.name} (${variant.label})`, price: priceLabel }
    : product;
  const updateCart = () => { for (let i = 0; i < qty; i++) addToCart(cartItem); };
  const buyNow = () => { for (let i = 0; i < qty; i++) addToCart(cartItem); navigate('/cart'); };

  const dist = [5, 4, 3, 2, 1].map(star => ({
    star,
    pct: reviewCount === 0 ? 0 : (Math.round(rating) === star ? 100 : 0),
  }));

  return (
    <>
      <CategoryNav active={product.category} />

      <main className="main-content pdpage">
        <div className="pd-wrap">
          <div className="pd-hero">
            <div className="pd-gallery">
              <div className="pd-image">
                <img src={gallery[imageIdx] || product.image} alt={product.name} onError={e => { e.currentTarget.style.opacity = '.25'; }} />
              </div>
              {gallery.length > 1 && (
                <div className="pd-thumbs">
                  {gallery.map((u, i) => (
                    <button key={u} type="button" className={`pd-thumb${i === imageIdx ? ' active' : ''}`} onClick={() => setImageIdx(i)} aria-label={`Image ${i + 1}`}>
                      <img src={u} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
              <button className="pd-report"><ImageIcon /> Report missing/incorrect image.</button>
            </div>

            <div className="pd-info">
              <a className="pd-brand" href={`https://chadsflooring.bz/brand/${product.brandSlug}`} target="_blank" rel="noreferrer">{product.brand}</a>
              <h1 className="pd-name">{product.name}</h1>

              <div className="pd-field">
                <label className="pd-label">Choose an option</label>
                <div className={`pd-select${optionOpen ? ' open' : ''}`}>
                  <button className="pd-select-btn" onClick={() => setOptionOpen(o => !o)}>
                    <span>{optionLabels[optionIdx]}</span><ChevronDown />
                  </button>
                  {optionOpen && (
                    <div className="pd-select-menu">
                      {optionLabels.map((opt, i) => (
                        <button key={i} className={`pd-select-opt${i === optionIdx ? ' active' : ''}`} onClick={() => { setOptionIdx(i); setOptionOpen(false); setQty(1); }}>{opt}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pd-field">
                <label className="pd-label">How many would you like?</label>
                <div className="pd-stepper">
                  <button className="pd-step" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease"><MinusIcon /></button>
                  <span className="pd-qty">{qty}</span>
                  <button className="pd-step" onClick={() => setQty(q => Math.min(stock || 99, q + 1))} aria-label="Increase"><PlusIcon /></button>
                </div>
                <div className="pd-stock">Stock: {stock}</div>
              </div>

              <div className="pd-actions">
                <button className="pd-update" onClick={updateCart} disabled={!inStock}>Update cart</button>
                <button className="pd-buy" onClick={buyNow} disabled={!inStock}>Buy now</button>
              </div>

              <div className="pd-price">{priceLabel}</div>

              <div className="pd-meta-row">
                <span className="pd-auth"><ShieldCheck /> Authenticity <strong>Authentic</strong></span>
              </div>
              <div className="pd-rating-row">
                <span className="pd-rating-num">{rating.toFixed(1)}</span>
                <StarRating rating={rating} count={null} />
                <span className="pd-review-count">{reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          <div className="pd-body">
            <section className="pd-section">
              <h2 className="pd-section-title">Pricing Tiers</h2>
              <div className="pd-tiers">
                <div className="pd-tier"><span>1+</span><span>{priceLabel}</span></div>
              </div>
            </section>

            <section className="pd-section">
              <p className="pd-desc">{product.description || DESCRIPTION}</p>
            </section>

            <section className="pd-section">
              <h2 className="pd-section-title">Reviews</h2>
              <div className="pd-reviews-head">
                <div className="pd-reviews-stat"><span className="pd-stat-label">Total Ratings</span><span className="pd-stat-value">{reviewCount}</span></div>
                <div className="pd-reviews-stat"><span className="pd-stat-label">Average Rating</span><span className="pd-stat-value">{rating.toFixed(1)} <StarRating rating={rating} count={null} /></span></div>
              </div>
              <div className="pd-dist">
                {dist.map(d => (
                  <div key={d.star} className="pd-dist-row">
                    <span className="pd-dist-label">{d.star} star</span>
                    <span className="pd-dist-bar"><span className="pd-dist-fill" style={{ width: `${d.pct}%` }} /></span>
                    <span className="pd-dist-pct">{d.pct}%</span>
                  </div>
                ))}
              </div>
              {reviewCount === 0 && <p className="pd-no-reviews">No written reviews yet.</p>}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
