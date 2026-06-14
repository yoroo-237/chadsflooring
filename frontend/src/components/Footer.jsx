import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer({ theme, onThemeChange }) {
  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Logo — big outlined style matching screenshot */}
        <div className="footer-logo">
          <Link to="/">
            <span className="footer-logo-text">CANNA<br />EXPRESS</span>
          </Link>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <h4>About Us</h4>
            <Link className="footer-link" to="/faq">F.A.Q.</Link>
            <Link className="footer-link" to="/shipping-policy">Shipping policy</Link>
          </div>

          <div className="footer-col">
            <h4>Customer Care</h4>
            <Link className="footer-link" to="/news">News</Link>
            <Link className="footer-link" to="/giveaway">Giveaways</Link>
            <Link className="footer-link" to="/system-status">System status</Link>
          </div>

          <div className="footer-col">
            <h4>Business</h4>
            <a className="footer-link" href="https://chadsflooring.bz/products/scrape" target="_blank" rel="noreferrer">Products API (HTML)</a>
            <a className="footer-link" href="https://chadsflooring.bz/api/products/scrape" target="_blank" rel="noreferrer">Products API (JSON)</a>
            <Link className="footer-link" to="/settings">API keys</Link>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            <Link className="footer-link" to="/support">Support</Link>
          </div>

          <div className="footer-col">
            <h4>Theme</h4>
            <div className="footer-theme-toggle">
              <button
                className={`footer-theme-btn${theme === 'light' ? ' active' : ''}`}
                onClick={() => onThemeChange('light')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                Light
              </button>
              <button
                className={`footer-theme-btn${theme === 'dark' ? ' active' : ''}`}
                onClick={() => onThemeChange('dark')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}