import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import CategoryNav from '../components/CategoryNav';
import { api } from '../utils/api';

/* ───────────────────────── Icons ───────────────────────── */
function ArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function ArrowUpRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </svg>
  );
}
/* Section badge icons (real site: blue stroke line icons) */
function TrendingBadge() {
  return (
    <svg width="30" height="30" viewBox="0 0 42 40" fill="none">
      <path d="M39.3337 10L23.5003 25.8333L15.167 17.5L2.66699 30" stroke="#5590C7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M30 9H40V19" stroke="#5590C7" strokeWidth="3.33333" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function StarBadge() {
  return (
    <svg width="30" height="30" viewBox="0 0 40 40" fill="none">
      <path d="M20 3.3335L25.15 13.7668L36.6667 15.4502L28.3334 23.5668L30.3 35.0335L20 29.6168L9.70004 35.0335L11.6667 23.5668L3.33337 15.4502L14.85 13.7668L20 3.3335Z" stroke="#5590C7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function TagBadge() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5590C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  );
}

/* Category card icons — real CannaExpress glyphs, muted blue-grey */
const ICON_FILL = '#B3BFC6';
function IconBYOB() {
  return (
    <svg width="40" height="44" viewBox="0 0 35 38" fill="none">
      <path d="M34.7602 12.9001C34.7402 10.35 33.3602 8.01005 31.1402 6.75005L20.8502 0.920051C18.6302 -0.329949 15.9102 -0.309949 13.7102 0.980051L3.52022 6.99005C1.32022 8.28005 -0.0197792 10.6501 0.000220787 13.2001L0.100221 25.0301C0.120221 27.5801 1.50022 29.9201 3.72022 31.1801L14.0202 37C16.2402 38.26 18.9602 38.24 21.1502 36.94L31.3502 30.9401C33.5502 29.6501 34.8902 27.2801 34.8602 24.7301L34.7602 12.9001ZM25.6502 26.6001L19.6302 30.1401C18.9502 30.5401 18.1902 30.7301 17.4302 30.7201V20.0701C17.4302 18.8401 16.7202 17.7401 15.6102 17.2401L8.08022 13.4701C8.38022 13.0701 8.77022 12.7301 9.22022 12.4601L15.2402 8.92005C16.5302 8.16005 18.1402 8.14005 19.4502 8.88005L25.5302 12.3201C26.8302 13.0601 27.6502 14.4501 27.6602 15.9501L27.7202 22.9301C27.7302 24.4401 26.9402 25.8301 25.6502 26.6001Z" fill={ICON_FILL}/>
      <path d="M17.4306 20.07V30.72C16.7306 30.71 16.0406 30.53 15.4206 30.18L9.34061 26.74C8.03061 26 7.22061 24.61 7.21061 23.11L7.15061 16.13C7.14061 15.15 7.47061 14.21 8.08061 13.47L15.6106 17.24C16.7206 17.74 17.4306 18.84 17.4306 20.07Z" fill={ICON_FILL}/>
    </svg>
  );
}
function IconEdibles() {
  return (
    <svg width="40" height="42" viewBox="0 0 35 36" fill="none">
      <path d="M33.9904 22.21C31.8904 30.15 24.4304 35.74 16.2204 35.51C8.72041 35.3 2.64041 30.68 0.0504143 24.41C-0.149586 23.93 0.240414 23.43 0.760414 23.48C0.820414 23.48 0.890414 23.49 0.950414 23.5C3.18041 23.72 5.41041 22.7 6.57041 20.78C7.73041 18.86 7.82041 16.79 7.17041 15.09C7.05041 14.78 7.23041 14.44 7.55041 14.36C9.96041 13.79 11.8804 11.8 12.2504 9.18998C12.3304 8.60998 12.2304 7.68998 12.1404 7.10998C12.0904 6.77998 12.3204 6.59998 12.5304 6.63998C12.6404 6.65998 12.7404 6.67998 12.7704 6.67998C16.1704 7.15998 19.1404 4.76998 19.6204 1.37998C19.6604 1.11998 19.6804 0.859983 19.6804 0.609983C19.6804 0.229983 20.0304 -0.0600172 20.4004 0.00998282C30.2404 2.09998 36.6804 12.04 33.9904 22.21Z" fill={ICON_FILL}/>
    </svg>
  );
}
function IconFlower() {
  return (
    <svg width="36" height="44" viewBox="0 0 29 35" fill="none">
      <path d="M0.5 13.25C0.5 13.25 1.39 20.03 4.78 23.25C5.67 24.09 8.89 27.05 13.95 27.26C20.17 27.51 24.13 23.41 24.88 22.59C27.55 19.69 28.23 13.53 28.23 13.53C28.23 13.53 23 13.62 20.38 15.89C15.64 20 14.5 26.6 14.5 26.6C14.5 26.6 13.47 20.66 9.23 16.44C6.35 13.58 0.5 13.25 0.5 13.25Z" fill={ICON_FILL} stroke={ICON_FILL} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M24.3597 6.28C24.3597 10.88 20.1297 14.6 14.9197 14.6C9.70973 14.6 5.46973 10.88 5.46973 6.28C5.46973 6.28 5.46973 6.28 5.46973 6.27C5.46973 5.53 5.70973 4.82 6.08973 4.18L8.53973 0L12.1197 4.96L14.9197 0L18.0197 4.91L22.5297 0L23.9797 4.23C24.1997 4.89 24.3597 5.57 24.3597 6.26V6.28Z" fill={ICON_FILL}/>
      <path d="M13.2998 11.27H16.0498V32.86C16.0498 33.62 15.4298 34.23 14.6798 34.23C13.9198 34.23 13.3098 33.61 13.3098 32.86V11.27H13.2998Z" fill={ICON_FILL}/>
    </svg>
  );
}
function IconDisposables() {
  return (
    <svg width="44" height="42" viewBox="0 0 41 39" fill="none">
      <path d="M27.1296 23.33L33.8896 11.69C33.8896 11.69 30.8096 3.94996 25.4896 1.24996C20.1696 -1.45004 11.9696 0.14996 9.38965 6.62996C9.38965 6.62996 16.1996 5.63996 19.3296 10.36C22.4596 15.08 27.1296 23.32 27.1296 23.32V23.33Z" fill={ICON_FILL}/>
      <path d="M18.25 14.3101L4.79003 14.3601C4.79003 14.3601 -0.349965 20.9201 0.020035 26.8801C0.390035 32.8401 5.89004 39.1001 12.79 38.0601C12.79 38.0601 8.50004 32.6801 11 27.5901C13.5 22.5001 18.25 14.3101 18.25 14.3101Z" fill={ICON_FILL}/>
      <path d="M14.9902 26.6299L21.4502 38.4399C21.4502 38.4399 29.6702 39.8199 34.7302 36.6599C39.7902 33.4999 42.6702 25.6699 38.4602 20.1099C38.4602 20.1099 35.7802 26.4499 30.1202 26.6799C24.4602 26.9099 14.9902 26.6399 14.9902 26.6399V26.6299Z" fill={ICON_FILL}/>
    </svg>
  );
}
function IconConcentrates() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      <path d="M33.0096 31.39C32.4396 33.04 32.2296 34.93 32.9996 36.49C33.2996 37.1 33.7296 37.61 34.2296 38.01C33.0596 38.9 31.7896 39.67 30.4296 40.29C29.5796 40.68 28.6996 41 27.7996 41.27C25.9896 41.81 24.0796 42.1 22.0896 42.1C18.0996 42.1 14.3796 40.93 11.2496 38.92C9.86965 38.04 8.60965 36.99 7.47965 35.8C6.70965 34.98 6.00965 34.11 5.38965 33.17C6.93965 33.01 8.39965 32.22 9.00965 30.8C9.96965 28.62 8.65965 26.2 7.81965 23.97C7.00965 21.86 6.60965 19.59 6.64965 17.32C6.65965 16.46 6.74965 15.57 7.14965 14.81C7.55965 14.04 8.34965 13.43 9.21965 13.46C11.1496 13.55 11.9596 16.5 13.8996 16.64C15.9396 16.78 16.9197 13.72 18.9496 13.49C20.4496 13.32 21.6296 14.83 22.0596 16.28C22.4896 17.73 22.5396 19.34 23.3696 20.6C24.2097 21.88 25.8296 22.6 27.3396 22.36C28.8496 22.12 30.1696 20.94 30.5696 19.46C30.8096 18.58 30.7396 17.65 30.9296 16.75C31.1196 15.86 31.6797 14.93 32.5797 14.78C33.8597 14.55 34.8097 15.93 35.2197 17.16C36.2297 20.2 36.1797 23.58 35.0797 26.58C34.4797 28.22 33.5796 29.74 33.0096 31.39Z" fill={ICON_FILL}/>
      <path d="M21.89 3C32.32 3 40.78 11.46 40.78 21.89C40.78 32.32 32.32 40.78 21.89 40.78C11.46 40.78 3 32.32 3 21.89C3 11.46 11.46 3 21.89 3ZM21.89 0C9.82 0 0 9.82 0 21.89C0 33.96 9.82 43.78 21.89 43.78C33.96 43.78 43.78 33.96 43.78 21.89C43.78 9.82 33.96 0 21.89 0Z" fill={ICON_FILL}/>
    </svg>
  );
}
function IconAccessories() {
  return (
    <svg width="22" height="42" viewBox="0 0 18 35" fill="none">
      <path d="M17.03 3.05009L10.61 13.7701H13.73C14.79 13.7701 15.45 14.9201 14.91 15.8301L4.45004 33.4401C4.01004 34.1401 2.92004 33.7501 3.03004 32.9201L5.10004 19.5301H1.64004C0.840042 19.5301 0.240042 18.8201 0.360042 18.0301L2.98004 1.96009C3.13004 1.03009 3.94004 0.340088 4.88004 0.340088H15.5C16.88 0.340088 17.73 1.85009 17.03 3.04009V3.05009Z" fill={ICON_FILL} stroke={ICON_FILL} strokeWidth="0.69" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconPreRolls() {
  return (
    <svg width="28" height="42" viewBox="0 0 25 36" fill="none">
      <path d="M0 27.7799C0 27.7799 0.32 32.6599 5.1 34.8599C9.88 37.0599 13.59 33.9799 15.82 31.7799C17.13 30.3999 22.54 25.0599 23.43 24.2799C24.32 23.4999 24.24 23.1799 24.28 22.5799C24.32 21.9799 24 21.3099 22.62 20.8099C21.24 20.3099 19.08 20.9499 18.44 21.3799C17.8 21.8099 15.47 23.5699 14.76 24.6699C14.05 25.7699 12.6 27.0799 11.11 26.7599C9.62 26.4399 8.88 25.8399 8.42 24.8099C7.96 23.7799 8.28 21.6599 9.41 20.9199C10.54 20.1799 11.18 20.0399 13.59 20.2099C16 20.3799 18.79 20.7799 20.67 20.1399C22.55 19.4999 24.14 18.1899 24.28 16.3899C24.42 14.5899 22.76 14.5799 22.76 14.5799H3.68C3.68 14.5799 2.19 14.3699 1.13 15.3899C0.0700001 16.4099 0.14 17.5499 0.14 17.5499L0 27.7799Z" fill={ICON_FILL}/>
      <path d="M3.57031 13.9798H15.0403C15.0403 13.9798 20.0303 12.2098 20.8803 8.77983C21.7303 5.34983 19.3903 5.12983 19.3903 5.12983C19.3903 5.12983 18.8603 5.01983 18.3603 5.33983C17.8603 5.65983 3.57031 13.9798 3.57031 13.9798Z" fill={ICON_FILL}/>
      <path d="M1.58984 14.3299L11.8198 8.52992C11.8198 8.52992 14.2598 5.05992 12.9898 1.69992C12.5698 0.599916 11.4698 -0.250084 10.4798 0.069916C9.48984 0.389916 9.02984 1.55992 8.77984 2.01992C8.52984 2.47992 1.58984 14.3299 1.58984 14.3299Z" fill={ICON_FILL}/>
      <path d="M0 15.7499L6.02 5.61993C6.02 5.61993 5.56 1.72993 3.58 0.739931C1.6 -0.250069 0.46 0.169931 0.18 1.69993C0.18 3.21993 0 15.7499 0 15.7499Z" fill={ICON_FILL}/>
    </svg>
  );
}
function IconCarts() {
  return (
    <svg width="30" height="42" viewBox="0 0 24 36" fill="none">
      <rect x="8" y="2" width="8" height="6" rx="1.5" fill={ICON_FILL}/>
      <rect x="6.5" y="8" width="11" height="20" rx="3" fill={ICON_FILL}/>
      <rect x="9.5" y="29" width="5" height="6" rx="1.5" fill={ICON_FILL}/>
    </svg>
  );
}

const HERO_CATS = [
  { label: 'BYOB',         id: '11', Icon: IconBYOB },
  { label: 'Edibles',      id: '7',  Icon: IconEdibles },
  { label: 'Flower',       id: '2',  Icon: IconFlower },
  { label: 'Disposables',  id: '6',  Icon: IconDisposables },
  { label: 'Concentrates', id: '3',  Icon: IconConcentrates },
  { label: 'Carts',        id: '1',  Icon: IconCarts },
  { label: 'Pre-rolls',    id: '9',  Icon: IconPreRolls },
  { label: 'Accessories',  id: '4',  Icon: IconAccessories },
];

const BRAND_BASE = 'https://chadsflooring.bz/assets/images/brands/industry-brands/';
const BRANDS = [
  { title: 'Luigi',       img: 'Luigi_Black_logo.png', w: 92,  slug: 'luigi' },
  { title: 'Maven',       img: 'Maven_Logo.png',       w: 131, slug: 'Maven' },
  { title: 'Jeeter',      img: 'Jeeter.png',           w: 90,  slug: 'Jeeter' },
  { title: 'Stiiizy',     img: 'Stiizy.png',           w: 84,  slug: 'Stiiizy' },
  { title: 'Cookies',     img: 'Cookies.png',          w: 91,  slug: 'Cookies' },
  { title: 'Dime',        img: 'Dime.png',             w: 121, slug: 'Dime' },
  { title: '710 Labs',    img: '710_Labs.png',         w: 160, slug: '710Labs' },
  { title: 'Sherbinskis', img: 'Shirbinskis.png',      w: 186, slug: 'Sherbinskis' },
  { title: 'Puffco',      img: 'PuffCo.png',           w: 140, slug: 'Puffco' },
  { title: 'Alien Labs',  img: 'Alien_Labs.png',       w: 80,  slug: 'AlienLabs' },
];

/* Best Selling Carts — scattered card positions (matches the real asymmetric layout) */
const BEST_POSITIONS = [
  { top: '6%',  left: '40%' },
  { top: '0%',  left: '74%' },
  { top: '44%', left: '28%' },
  { top: '58%', left: '50%' },
  { top: '42%', left: '73%' },
];

/* ─────────────── Focus carousel (center cards bright, edges dim) ─────────────── */
function FocusCarousel({ items, renderItem, onSeeAll, cardWidth = 300, gap = 24 }) {
  const [index, setIndex] = useState(Math.min(2, Math.max(0, items.length - 1)));
  const [vw, setVw] = useState(0);
  const [animate, setAnimate] = useState(false);
  const viewportRef = useRef(null);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setVw(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // enable sliding only after the first measurement so the carousel
    // appears centred on load instead of sliding in from the edge
    const raf = requestAnimationFrame(() => setAnimate(true));
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, []);

  const pitch = cardWidth + gap;
  const offset = vw / 2 - (index * pitch + cardWidth / 2);

  const prev = () => setIndex(i => Math.max(0, i - 1));
  const next = () => setIndex(i => Math.min(items.length - 1, i + 1));

  return (
    <div className="fc">
      <div className="fc-viewport" ref={viewportRef}>
        <div
          className="fc-track"
          style={{ gap, transform: `translateX(${offset}px)`, transition: animate ? undefined : 'none' }}
        >
          {items.map((item, i) => {
            const d = Math.abs(i - index);
            const cls = d <= 1 ? 'fc-card--focus' : d === 2 ? 'fc-card--near' : 'fc-card--far';
            return (
              <div key={item.id ?? i} className={`fc-card ${cls}`} style={{ width: cardWidth }}>
                {renderItem(item)}
              </div>
            );
          })}
        </div>
      </div>
      <div className="fc-controls">
        <button className="explore-circle-btn explore-circle-btn--sm" onClick={prev} disabled={index === 0}><ArrowLeft /></button>
        {onSeeAll && <button className="btn-see-all" onClick={onSeeAll}>See All</button>}
        <button className="explore-circle-btn explore-circle-btn--sm" onClick={next} disabled={index === items.length - 1}><ArrowRight /></button>
      </div>
    </div>
  );
}

/* Product card used inside the focus carousels */
function CarouselProduct({ product, onClick }) {
  return (
    <div className="cprod" onClick={onClick}>
      <div className="cprod-imgwrap">
        <img src={product.image} alt={product.name} loading="lazy"
             onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
      </div>
      <div className="cprod-price">{product.price}</div>
      <div className="cprod-brand">{product.brand}</div>
      <div className="cprod-name">{product.name}</div>
    </div>
  );
}

export default function ExplorePage() {
  const { setActiveCategory, normalizeProduct } = useApp();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get('/products', { limit: 60 })
      .then(data => setProducts((data.products || data || []).map(normalizeProduct)))
      .catch(() => {});
  }, [normalizeProduct]);

  const trending = products.slice(0, 9);
  const newItems = products.slice(9, 18);
  const onSale = products.slice(18, 27);
  const carts = products.filter(p => p.category === '1');
  const bestSelling = (carts.length >= 5 ? carts : products).slice(0, 5);

  // ── Top Categories horizontal scroll ──
  const catTrackRef = useRef(null);
  const scrollCats = (dir) => {
    if (catTrackRef.current) catTrackRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };
  const brandTrackRef = useRef(null);
  const scrollBrands = (dir) => {
    if (brandTrackRef.current) brandTrackRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  const openProduct = (p) => navigate(`/product/${p.id}`);
  const openCategory = (id) => { setActiveCategory(id); navigate('/'); };

  return (
    <>
      <CategoryNav active="explore" />

      <div className="explore-page">
        {/* ── Hero: Top Categories ── */}
        <section className="explore-hero">
          <div className="explore-hero-inner">
            <div className="explore-hero-head">
              <h1 className="explore-hero-title">Top Categories</h1>
              <div className="explore-hero-arrows">
                <button className="explore-circle-btn" onClick={() => scrollCats(-1)}><ArrowLeft /></button>
                <button className="explore-circle-btn explore-circle-btn--solid" onClick={() => scrollCats(1)}><ArrowRight /></button>
              </div>
            </div>
            <div className="cat-track" ref={catTrackRef}>
              {HERO_CATS.map(({ label, id, Icon }) => (
                <button key={label} className="cat-card" onClick={() => openCategory(id)}>
                  <span className="cat-card-icon"><Icon /></span>
                  <span className="cat-card-label">{label}</span>
                  <span className="cat-card-arrow"><ArrowUpRight /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trending Items ── */}
        <section className="explore-section">
          <div className="explore-section-badge"><span className="badge-box"><TrendingBadge /></span></div>
          <h2 className="explore-section-heading">Trending Items</h2>
          <FocusCarousel
            items={trending}
            renderItem={(p) => <CarouselProduct product={p} onClick={() => openProduct(p)} />}
          />
        </section>

        {/* ── New Items ── */}
        <section className="explore-section">
          <div className="explore-section-badge"><span className="badge-box"><StarBadge /></span></div>
          <h2 className="explore-section-heading">New Items</h2>
          <FocusCarousel
            items={newItems}
            renderItem={(p) => <CarouselProduct product={p} onClick={() => openProduct(p)} />}
          />
        </section>

        {/* ── Brand logos ── */}
        <section className="explore-brands">
          <div className="brands-track" ref={brandTrackRef}>
            {BRANDS.map(b => (
              <button key={b.title} className="brand-logo" onClick={() => openCategory('1')} title={b.title}>
                <img
                  src={BRAND_BASE + b.img}
                  alt={b.title}
                  style={{ width: b.w }}
                  onError={e => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { className: 'brand-logo-fallback', textContent: b.title })); }}
                />
              </button>
            ))}
          </div>
          <div className="fc-controls">
            <button className="explore-circle-btn explore-circle-btn--sm" onClick={() => scrollBrands(-1)}><ArrowLeft /></button>
            <button className="explore-circle-btn explore-circle-btn--sm explore-circle-btn--solid" onClick={() => scrollBrands(1)}><ArrowRight /></button>
          </div>
        </section>

        {/* ── Best Selling Carts ── */}
        <section className="explore-section">
          <div className="best-selling">
            <div className="best-selling-text">
              <h2 className="best-selling-title">Best Selling Carts</h2>
              <p className="best-selling-flavors">57 new flavors</p>
              <p className="best-selling-desc">
                Shop the industry's top cannabis cartridge brands at Canna Express. Featuring premium
                quality carts from the most trusted names, we bring you unmatched potency, flavor, and
                consistency. All in one convenient place!
              </p>
              <button className="best-selling-btn" onClick={() => openCategory('1')}>
                Featured Catalog <ArrowRight />
              </button>
            </div>
            <div className="best-selling-stage">
              {bestSelling.map((p, i) => (
                <div
                  key={p.id}
                  className="best-card"
                  style={{ top: BEST_POSITIONS[i].top, left: BEST_POSITIONS[i].left }}
                  onClick={() => openProduct(p)}
                >
                  <div className="best-card-img">
                    <img src={p.image} alt={p.name} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                  </div>
                  <div className="best-card-price">{p.price}</div>
                  <div className="best-card-brand">{p.brand}</div>
                  <div className="best-card-name">{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Shop the Sale ── */}
        <section className="explore-section">
          <div className="explore-section-badge"><span className="badge-box"><TagBadge /></span></div>
          <h2 className="explore-section-heading">Shop the Sale</h2>
          <FocusCarousel
            items={onSale}
            onSeeAll={() => navigate('/')}
            renderItem={(p) => <CarouselProduct product={p} onClick={() => openProduct(p)} />}
          />
        </section>
      </div>
    </>
  );
}
