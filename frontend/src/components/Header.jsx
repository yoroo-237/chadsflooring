import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

function CannaExpressLogo() {
  return (
    <svg width="140" height="11" viewBox="0 0 154 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.76665 12H5.31129C1.76854 12 0 10.9854 0 6.01417C0 1.04298 1.76854 0.0113368 5.31129 0.0113368H10.9003V2.65281H5.32263C3.7128 2.65281 3.1573 3.29334 3.1573 6.01417C3.1573 8.735 3.72981 9.35853 5.32263 9.35853H10.9003L9.76665 12Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M17.2886 0L12.1304 11.9943H15.4861L16.4384 9.59093H21.9707L22.9173 11.9943H26.3524L21.1998 0H17.2886ZM19.1932 2.79452L20.8824 6.98914H17.504L19.1932 2.79452Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M26.7038 11.9943V0H30.513L35.3821 7.53897V0H38.3807V11.9943H34.6906L29.7024 4.26264V11.9943H26.7038Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M40.6311 12V0H44.4459L49.3094 7.53897V0H52.308V12H48.6235L43.6297 4.26264V12H40.6311Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M57.8687 0L52.7104 11.9943H56.0661L57.0184 9.59093H62.5508L63.4974 11.9943H66.9324L61.7799 0H57.8687ZM59.7733 2.79452L61.4624 6.98914H58.0841L59.7733 2.79452Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M73.4058 11.9943V0H83.1894V2.68115H76.4327V4.73311H83.0307V7.26122H76.4327V9.39254H83.1894V11.9943H73.4058Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M121.349 11.9943V0H131.133V2.68115H124.382V4.73311H130.946V7.26122H124.382V9.39254H131.133V11.9943H121.349Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M83.5692 11.9943L88.3307 6.07086L83.4558 0H87.231L90.1389 3.75248L93.0524 0H96.6802L91.8677 5.99717L96.6405 11.9943H92.8654L90.0425 8.29854L87.2933 11.9943H83.5692Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M96.9976 0V11.9943H100.076V8.20784H103.233C105.903 8.20784 107.926 6.79074 107.926 4.0359C107.926 1.75153 106.339 0 103.624 0H96.9976ZM100.076 2.71516H103.397C104.259 2.71516 104.877 3.24232 104.877 4.09825C104.877 4.8975 104.265 5.48134 103.386 5.48134H100.07V2.72083L100.076 2.71516Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M109.23 0V11.9943H112.229V7.7317H113.493L117.086 11.9943H120.748L116.803 7.57298C118.424 7.43694 120.091 6.04818 120.091 3.88852C120.096 1.36608 118.112 0 115.902 0H109.23ZM112.229 2.68115H115.658C116.48 2.68115 117.081 3.32168 117.081 3.94521C117.081 4.74445 116.304 5.20926 115.703 5.20926H112.229V2.68115Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M132.521 11.9943V9.39254H138.524C139.414 9.39254 139.8 8.91072 139.8 8.38923C139.8 7.86774 139.414 7.37459 138.524 7.37459H135.815C133.457 7.37459 132.147 5.94048 132.147 3.78082C132.142 1.85357 133.343 0 136.846 0H142.685L141.421 2.69816H136.37C135.407 2.69816 135.106 3.20265 135.106 3.69013C135.106 4.17761 135.475 4.73311 136.212 4.73311H139.051C141.682 4.73311 142.821 6.2239 142.821 8.17383C142.821 10.2711 141.551 11.9887 138.91 11.9887H132.521V11.9943Z" fill="currentColor"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M143.53 11.9943V9.39254H149.277C150.167 9.39254 150.553 8.91072 150.553 8.38923C150.553 7.86774 150.167 7.37459 149.277 7.37459H146.817C144.459 7.37459 143.15 5.94048 143.15 3.78082C143.15 1.85357 144.351 0 147.855 0H153.58L152.316 2.69816H147.384C146.42 2.69816 146.12 3.20265 146.12 3.69013C146.12 4.17761 146.488 4.73311 147.225 4.73311H149.81C152.44 4.73311 153.58 6.2239 153.58 8.17383C153.58 10.2711 152.31 11.9887 149.668 11.9887H143.53V11.9943Z" fill="currentColor"/>
    </svg>
  );
}

function LtcIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#345D9D"/>
      <path d="M13.5 20.5l1-4-1.5.5.5-2 1.5-.5 2-8h4l-1.5 6 1.5-.5-.5 2-1.5.5-1 4h7l-.5 2h-11l.5-2z" fill="white"/>
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}
function ClearIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function CartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  );
}
function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

const DEFAULT_NOTIFICATIONS = [
  { id: 1, text: 'Welcome! Browse our latest products.', time: 'Just now' },
  { id: 2, text: 'New arrivals in Accessories!', time: '2h ago' },
  { id: 3, text: 'Limited stock on Focus V Aeris Kit.', time: '5h ago' },
];

const NAV_TABS = [
  { label: 'Shop', path: '/' },
  { label: 'Community', path: '/news' },
  { label: 'Support', path: '/support' },
];

function calcTimeUntilDeadline(deadlineH, deadlineM) {
  const now = new Date();
  const deadline = new Date(now);
  deadline.setHours(Number(deadlineH) || 0, Number(deadlineM) || 0, 0, 0);
  if (deadline <= now) deadline.setDate(deadline.getDate() + 1);
  const diff = Math.max(0, Math.floor((deadline - now) / 1000));
  return { h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 };
}

export default function Header({ onCartOpen }) {
  const { cartItems, search, setSearch, balance, settings, logout, user } = useApp();
  const cartCount = cartItems.length;
  const deadlineH = settings?.shipping_deadline_h ?? 22;
  const deadlineM = settings?.shipping_deadline_m ?? 39;
  const [time, setTime] = useState(() => calcTimeUntilDeadline(deadlineH, deadlineM));
  const [notifSeen, setNotifSeen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setTime(calcTimeUntilDeadline(deadlineH, deadlineM));
  }, [deadlineH, deadlineM]);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  useEffect(() => {
    const iv = setInterval(() => {
      setTime(calcTimeUntilDeadline(deadlineH, deadlineM));
    }, 1000);
    return () => clearInterval(iv);
  }, [deadlineH, deadlineM]);

  const fmt = n => String(n).padStart(2, '0');

  const isTabActive = (path) => {
    const p = location.pathname;
    const accountRoutes = ['/profile', '/rewards', '/wallet', '/credits', '/orders', '/team', '/settings', '/support', '/faq', '/shipping-policy', '/system-status'];
    if (path === '/support') {
      // "Support" lights up across the whole account / help section
      return accountRoutes.some(r => p.startsWith(r));
    }
    if (path === '/news') {
      return p.startsWith('/news') || p.startsWith('/giveaway');
    }
    if (path === '/') {
      // "Shop" covers the shop grid, explore and individual product pages
      return p === '/' || p.startsWith('/explore') || p.startsWith('/product') || p.startsWith('/checkout');
    }
    return p.startsWith(path);
  };

  return (
    <header className="header">
      {/* Mobile nav overlay */}
      {mobileMenuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
      )}

      {/* Mobile nav drawer */}
      <div className={`mobile-nav-drawer${mobileMenuOpen ? ' open' : ''}`} aria-hidden={!mobileMenuOpen}>
        <div className="mobile-nav-head">
          <CannaExpressLogo />
          <button className="mobile-nav-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
            <XIcon />
          </button>
        </div>
        <nav className="mobile-nav-links">
          {NAV_TABS.map(tab => (
            <Link
              key={tab.label}
              to={tab.path}
              className={`mobile-nav-link${isTabActive(tab.path) ? ' active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="mobile-nav-footer">
          <div className="mobile-nav-balance" onClick={() => { navigate('/wallet'); setMobileMenuOpen(false); }}>
            <LtcIcon />
            <span>${balance.toFixed(2)}</span>
          </div>
          {user
            ? <button className="mobile-nav-logout" onClick={() => { logout(); setMobileMenuOpen(false); }}>Sign Out</button>
            : <button className="mobile-nav-logout" onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}>Sign In</button>
          }
        </div>
      </div>

      <div className="header-inner">

        {/* Hamburger — mobile only */}
        <button
          className="header-hamburger"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <HamburgerIcon />
        </button>

        {/* Logo */}
        <div className="header-logo">
          <Link to="/">
            <CannaExpressLogo />
          </Link>
        </div>

        {/* Shipping countdown */}
        <div className="header-shipping">
          <TruckIcon />
          <div className="timer-display">
            <span className="timer-seg">{fmt(time.h)}h</span>
            <span className="timer-sep"> - </span>
            <span className="timer-seg">{fmt(time.m)}m</span>
            <span className="timer-sep"> - </span>
            <span className="timer-seg">{fmt(time.s)}s</span>
          </div>
        </div>

        {/* Divider pipe */}
        <div className="header-divider" />

        {/* Search bar with embedded balance chip */}
        <div className="header-search">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="search-clear"
              onClick={() => { setSearch(''); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <ClearIcon />
            </button>
          )}
          {/* Balance + LTC chip embedded at right of search bar */}
          <div
            className="search-balance-chip"
            onClick={() => navigate('/wallet')}
            title="Open Wallet"
          >
            <LtcIcon />
            <span className="search-balance-amount">${balance.toFixed(2)}</span>
            <span className="search-balance-change">+0.026%</span>
          </div>
        </div>

        {/* Nav tabs */}
        <nav className="header-nav-tabs">
          {NAV_TABS.map(tab => {
            const active = isTabActive(tab.path);
            return (
              <Link
                key={tab.label}
                to={tab.path}
                className={['header-nav-tab', active ? 'active' : ''].filter(Boolean).join(' ')}
              >
                {active && <span className="header-nav-dot" />}
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {/* Right icons */}
        <div className="header-right">
          <button className="icon-btn" onClick={onCartOpen}>
            <CartIcon /> Cart
            <span className={`badge${cartCount > 0 ? ' visible' : ''}`}>{cartCount}</span>
          </button>

          <div className="notif-wrap" onMouseEnter={() => setNotifSeen(true)}>
            <button className="icon-btn" style={{ position: 'relative' }}>
              <BellIcon />
              {!notifSeen && <span className="notif-dot" />}
            </button>
            <div className="notif-menu">
              <div className="notif-menu-header">Notifications</div>
              {DEFAULT_NOTIFICATIONS.map(n => (
                <div key={n.id} className="notif-item">
                  <div className="notif-text">{n.text}</div>
                  <div className="notif-time">{n.time}</div>
                </div>
              ))}
              <Link to="/news" className="notif-link">View all</Link>
            </div>
          </div>

          <div className="profile-wrap" ref={profileRef}>
            <button
              className="profile-btn"
              aria-label="Account menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen(o => !o)}
            >
              <PersonIcon />
            </button>
            <div className={`profile-dropdown${profileOpen ? ' open' : ''}`}>
              {user && <div className="profile-item" style={{ fontWeight: 700, pointerEvents: 'none' }}>{user.username}</div>}
              <div className="profile-item" onClick={() => { navigate('/orders'); setProfileOpen(false); }}>Orders</div>
              <div className="profile-item" onClick={() => { navigate('/profile'); setProfileOpen(false); }}>Profile</div>
              <div className="profile-item" onClick={() => { navigate('/support'); setProfileOpen(false); }}>Support</div>
              {!user
                ? <div className="profile-item" onClick={() => { navigate('/login'); setProfileOpen(false); }}>Sign In</div>
                : <div className="profile-item danger" onClick={() => { logout(); setProfileOpen(false); }}>Logout</div>
              }
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}
