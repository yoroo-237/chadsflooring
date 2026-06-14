import React from 'react';
import { useApp } from '../context/AppContext';
import AccountSidebar from '../components/AccountSidebar';

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

/* ── Brand / detail icons (circular badges) ── */
function PersonBadge() {
  return (
    <span className="profile2-badge" style={{ background: '#0171E3' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
    </span>
  );
}
function BriefcaseBadge() {
  return (
    <span className="profile2-badge" style={{ background: '#0171E3' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
    </span>
  );
}
function SignalIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="#2A6FF3"/><path d="M20 10c-5.5 0-10 3.9-10 8.8 0 2.6 1.3 5 3.4 6.6L12 30l4.6-1.6c1.1.3 2.2.4 3.4.4 5.5 0 10-3.9 10-8.8S25.5 10 20 10z" fill="#fff"/></svg>
  );
}
function SessionIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 303.06 336.3"><path d="m255.67 170.86-63.48-35.17h43.03c37.41 0 67.85-30.43 67.85-67.84s-30.44-67.85-67.85-67.85h-150.22c-46.87 0-85 38.13-85 85 0 33.42 18.16 64.25 47.4 80.45l63.48 35.17h-43.03c-37.41 0-67.85 30.43-67.85 67.84s30.44 67.85 67.85 67.85h150.22c46.87 0 85-38.13 85-85-.01-33.43-18.17-64.25-47.4-80.45zm-198.09-23.81c-22.06-12.22-35.95-35.25-36.54-60.39-.85-36.09 29.46-65.64 65.57-65.64h147.25c25.18 0 46.88 19.31 48.12 44.46 1.33 26.88-20.16 49.18-46.76 49.18 0 0-60.99.01-84.81.01-5.19 0-9.37 4.21-9.38 9.39l-.02 69.22zm158.88 168.23h-147.26c-25.18 0-46.88-19.31-48.12-44.46-1.33-26.88 20.16-49.18 46.76-49.18h84.81c5.19 0 9.39-4.21 9.39-9.39v-69.23l83.44 46.23c22.06 12.22 35.95 35.25 36.54 60.39.85 36.09-29.46 65.64-65.56 65.64z" fill="#00f782"/></svg>
  );
}
function BtcIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#F7931A"/><text x="9" y="23" fontSize="18" fill="#fff" fontWeight="bold" fontFamily="Arial">₿</text></svg>
  );
}
function XmrIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#FF6600"/><path d="M6 9v11h3.6V12.7L16 19l6.4-6.3V20H26V9l-10 9.9z" fill="#fff"/></svg>
  );
}
function TelegramIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#229ED9"/><path d="M23 9 7.5 15c-.9.3-.9 1.5 0 1.8l3.8 1.2 1.5 4.6c.2.6 1 .7 1.4.2l2-2.1 3.9 2.9c.6.4 1.4 0 1.5-.6L25 10.2c.2-.9-.7-1.6-2-1.2z" fill="#fff"/></svg>
  );
}

export default function ProfilePage() {
  const { user, profile } = useApp();
  const username = user?.username || (profile && profile.name) || 'Jadevice55';

  // Read-only profile: the real site does not collect personal data here.
  const EditBtn = () => (
    <button className="profile2-edit" type="button"><EditIcon /> Edit</button>
  );

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
          <h3 className="account-page-title">Profile</h3>

          {/* Private details (full width) */}
          <div className="profile2-card profile2-card--wide">
            <div className="profile2-card-head">
              <h4 className="profile2-card-title">Private details</h4>
              <EditBtn />
            </div>
            <div className="profile2-private-row">
              <div className="profile2-item"><PersonBadge /><span className="profile2-item-value">{username}</span></div>
              <div className="profile2-item">
                <BriefcaseBadge />
                <span className="profile2-item-stack"><span className="profile2-item-value">Logo</span><span className="profile2-item-sub">Markup: 0%</span></span>
              </div>
            </div>
          </div>

          {/* Signal + Session */}
          <div className="profile2-grid">
            <div className="profile2-card">
              <div className="profile2-card-head"><h4 className="profile2-card-title">Signal details</h4><EditBtn /></div>
              <div className="profile2-icon-slot"><SignalIcon /></div>
            </div>
            <div className="profile2-card">
              <div className="profile2-card-head"><h4 className="profile2-card-title">Session details</h4><EditBtn /></div>
              <div className="profile2-icon-slot"><SessionIcon /></div>
            </div>
          </div>

          {/* BTC + XMR */}
          <div className="profile2-grid">
            <div className="profile2-card">
              <div className="profile2-card-head"><h4 className="profile2-card-title">BTC Refund</h4><EditBtn /></div>
              <div className="profile2-icon-slot"><BtcIcon /></div>
            </div>
            <div className="profile2-card">
              <div className="profile2-card-head"><h4 className="profile2-card-title">XMR Refund</h4><EditBtn /></div>
              <div className="profile2-icon-slot"><XmrIcon /></div>
            </div>
          </div>

          {/* Telegram (full width) */}
          <div className="profile2-card profile2-card--wide">
            <div className="profile2-card-head">
              <h4 className="profile2-card-title">Telegram Details</h4>
              <button className="profile2-autolink" type="button"><LinkIcon /> Auto-Link Account</button>
            </div>
            <div className="profile2-icon-slot"><TelegramIcon /></div>
          </div>
        </div>
      </div>
    </main>
  );
}
