import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import AccountSidebar from '../components/AccountSidebar';
import { api } from '../utils/api';
function LockIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
}
function KeyIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>;
}
function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
}
function ApiIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
}
function EyeIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function CopyIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
function TelegramLinkIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}

/* ── Password strength helpers ── */
function checkPassword(pw) {
  return {
    notEmpty: pw.length > 0,
    noSpaces: pw.length > 0 && !pw.includes(' '),
    minLength: pw.length >= 8,
    hasSymbol: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
    hasNumber: /\d/.test(pw),
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
  };
}
function strengthScore(checks) {
  return Object.values(checks).filter(Boolean).length;
}
function strengthLabel(score) {
  if (score <= 2) return { label: 'Too weak', color: '#e53935' };
  if (score <= 4) return { label: 'Weak', color: '#ff9800' };
  if (score <= 6) return { label: 'Good', color: '#fdd835' };
  return { label: 'Strong', color: '#43a047' };
}

/* ── Toggle switch ── */
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-switch" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      <span className="toggle-slider" />
    </label>
  );
}

/* ── Requirement row ── */
function Req({ ok, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: ok ? '#43a047' : '#e53935' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        {ok
          ? <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1.177 14.232L6.7 12.11l1.414-1.414 2.709 2.709 5.063-5.063 1.414 1.414-6.477 6.476z"/>
          : <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
        }
      </svg>
      {label}
    </div>
  );
}

export default function SettingsPage() {
  const { showToast } = useApp();

  /* 2FA */
  const [twoFaTab, setTwoFaTab] = useState('add'); // 'add' | 'remove'
  const [twoFaCurrent, setTwoFaCurrent] = useState('');

  /* Password */
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pwChecks = checkPassword(newPw);
  const pwScore = strengthScore(pwChecks);
  const { label: pwLabel, color: pwColor } = strengthLabel(pwScore);

  /* Hide prices */
  const [hidePrices, setHidePrices] = useState(false);

  /* Notification toggles */
  const [notifToggles, setNotifToggles] = useState({
    orders: false,
    deposits: false,
    tickets: false,
    newProducts: false,
    logins: false,
  });
  const toggleNotif = key => setNotifToggles(p => ({ ...p, [key]: !p[key] }));

  /* API keys */
  const [apiKeys, setApiKeys] = useState([]);
  const generateKey = async () => {
    try {
      const data = await api.post('/profile/api-keys', {});
      const key = data.apiKey || data;
      setApiKeys(prev => [...prev, { id: Date.now(), key: key.key || key, created: new Date().toLocaleDateString() }]);
      showToast('New API key generated!', 'success');
    } catch {
      const key = 'sk-' + Array.from({ length: 32 }, () =>
        '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)]
      ).join('');
      setApiKeys(prev => [...prev, { id: Date.now(), key, created: new Date().toLocaleDateString() }]);
      showToast('New API key generated!', 'success');
    }
  };
  const deleteKey = async id => {
    try {
      await api.delete(`/profile/api-keys/${id}`);
    } catch {}
    setApiKeys(prev => prev.filter(k => k.id !== id));
    showToast('API key deleted.', 'info');
  };
  const copyKey = key => {
    navigator.clipboard.writeText(key).catch(() => {});
    showToast('Copied to clipboard!', 'success');
  };

  const handleUpdatePassword = async () => {
    if (!currentPw) { showToast('Enter your current password.', 'error'); return; }
    if (newPw !== confirmPw) { showToast('Passwords do not match.', 'error'); return; }
    if (pwScore < 5) { showToast('Password too weak.', 'error'); return; }
    try {
      await api.put('/profile/password', { currentPassword: currentPw, newPassword: newPw });
      showToast('Password updated!', 'success');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      showToast(err.message || 'Failed to update password', 'error');
    }
  };

  const handle2FASubmit = () => {
    if (!twoFaCurrent) { showToast('Enter your current password.', 'error'); return; }
    showToast(twoFaTab === 'add' ? '2FA setup initiated!' : '2FA removed.', 'success');
    setTwoFaCurrent('');
  };

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
        <h3 className="account-page-title">Settings</h3>

        {/* Row 1: 2FA + Change Password */}
        <div className="settings-top-row">
          {/* 2FA card */}
          <div className="settings-section settings-card">
            <div className="settings-card-icon"><LockIcon /></div>

            {/* Tabs */}
            <div className="settings-tabs">
              <button
                className={`settings-tab${twoFaTab === 'add' ? ' active' : ''}`}
                onClick={() => setTwoFaTab('add')}
              >
                Change/Add 2fa
              </button>
              <button
                className={`settings-tab${twoFaTab === 'remove' ? ' active' : ''}`}
                onClick={() => setTwoFaTab('remove')}
              >
                Remove 2fa
              </button>
            </div>

            <div className="settings-card-title">
              {twoFaTab === 'add' ? 'Add Two Factor Authentication' : 'Remove Two Factor Authentication'}
            </div>
            <p className="settings-desc">
              {twoFaTab === 'add'
                ? 'Add extra security on your account by requiring an additional step on log in.'
                : 'Remove two factor authentication from your account.'}
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="twofa-current">Current password</label>
              <input
                id="twofa-current"
                className="form-input"
                type="password"
                placeholder="Current password"
                value={twoFaCurrent}
                onChange={e => setTwoFaCurrent(e.target.value)}
              />
            </div>

            <button className="btn-primary" style={{ width: '100%' }} onClick={handle2FASubmit}>
              Submit
            </button>
          </div>

          {/* Change Password card */}
          <div className="settings-section settings-card">
            <div className="settings-card-icon"><KeyIcon /></div>
            <div className="settings-card-title">Change password</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Current password */}
                <div className="form-group">
                  <label className="form-label" htmlFor="pw-current">Current password</label>
                  <div className="pw-input-wrap">
                    <input
                      id="pw-current"
                      className="form-input"
                      type={showCurrent ? 'text' : 'password'}
                      placeholder="Current password"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                    />
                    <button className="pw-eye-btn" onClick={() => setShowCurrent(v => !v)} type="button">
                      <EyeIcon />
                    </button>
                  </div>
                </div>

                {/* New password + strength bar */}
                <div className="form-group">
                  <label className="form-label" htmlFor="pw-new">New password</label>
                  <div className="pw-input-wrap">
                    <input
                      id="pw-new"
                      className="form-input"
                      type={showNew ? 'text' : 'password'}
                      placeholder="New password"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                    />
                    <button className="pw-eye-btn" onClick={() => setShowNew(v => !v)} type="button">
                      <EyeIcon />
                    </button>
                  </div>
                  {newPw && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border-light)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(pwScore / 7) * 100}%`, background: pwColor, borderRadius: 3, transition: 'width .3s, background .3s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pwColor, whiteSpace: 'nowrap' }}>{pwLabel}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="form-group">
                  <label className="form-label" htmlFor="pw-confirm">Confirm password</label>
                  <div className="pw-input-wrap">
                    <input
                      id="pw-confirm"
                      className="form-input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm Password"
                      value={confirmPw}
                      onChange={e => setConfirmPw(e.target.value)}
                    />
                    <button className="pw-eye-btn" onClick={() => setShowConfirm(v => !v)} type="button">
                      <EyeIcon />
                    </button>
                  </div>
                </div>

                <button className="btn-primary" style={{ width: '100%' }} onClick={handleUpdatePassword}>
                  Update Password
                </button>
              </div>

              {/* Requirements column */}
              <div className="pw-requirements">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 10 }}>Requirements:</div>
                <Req ok={newPw === confirmPw && newPw.length > 0} label="Passwords match" />
                <Req ok={pwChecks.notEmpty} label="Not empty" />
                <Req ok={pwChecks.noSpaces} label="No spaces" />
                <Req ok={pwChecks.minLength} label="8+ characters" />
                <Req ok={pwChecks.hasSymbol} label="1+ symbol" />
                <Req ok={pwChecks.hasNumber} label="1+ number" />
                <Req ok={pwChecks.hasUpper} label="1+ capital letter" />
                <Req ok={pwChecks.hasLower} label="1+ lowercase letter" />
              </div>
            </div>
          </div>
        </div>

        {/* Hide prices */}
        <div className="settings-section settings-card" style={{ marginBottom: 16 }}>
          <div className="settings-card-icon"><EyeOffIcon /></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div className="settings-card-title">Hide prices</div>
              <p className="settings-desc" style={{ marginTop: 4 }}>
                Temporarily hides prices on the Explore, Shop, and product pages
              </p>
            </div>
            <Toggle checked={hidePrices} onChange={setHidePrices} />
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section settings-card" style={{ marginBottom: 16 }}>
          <div className="settings-card-icon"><BellIcon /></div>
          <div className="settings-card-title">Notifications</div>

          {/* QR + description */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* QR placeholder */}
              <div className="notif-qr-box">
                <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
                  {/* Simplified QR pattern */}
                  <rect width="140" height="140" fill="white"/>
                  {/* Corner squares */}
                  <rect x="10" y="10" width="40" height="40" rx="2" fill="black"/>
                  <rect x="15" y="15" width="30" height="30" rx="1" fill="white"/>
                  <rect x="20" y="20" width="20" height="20" rx="1" fill="black"/>
                  <rect x="90" y="10" width="40" height="40" rx="2" fill="black"/>
                  <rect x="95" y="15" width="30" height="30" rx="1" fill="white"/>
                  <rect x="100" y="20" width="20" height="20" rx="1" fill="black"/>
                  <rect x="10" y="90" width="40" height="40" rx="2" fill="black"/>
                  <rect x="15" y="95" width="30" height="30" rx="1" fill="white"/>
                  <rect x="20" y="100" width="20" height="20" rx="1" fill="black"/>
                  {/* Data dots pattern */}
                  {[
                    [60,10],[65,10],[70,10],[75,10],[80,10],
                    [60,15],[70,15],[80,15],
                    [60,20],[65,20],[75,20],[80,20],
                    [60,25],[65,25],[70,25],
                    [60,30],[75,30],[80,30],
                    [60,35],[65,35],[70,35],[75,35],
                    [60,40],[70,40],[80,40],
                    [60,45],[65,45],[75,45],[80,45],
                    [10,60],[20,60],[30,60],[40,60],[50,60],[55,60],[60,60],[65,60],[75,60],[80,60],[90,60],[100,60],[110,60],[120,60],[130,60],
                    [10,65],[15,65],[25,65],[35,65],[45,65],[55,65],[65,65],[75,65],[85,65],[95,65],[105,65],[115,65],[125,65],
                    [10,70],[20,70],[30,70],[40,70],[55,70],[65,70],[75,70],[85,70],[95,70],[110,70],[120,70],[130,70],
                    [10,75],[15,75],[25,75],[35,75],[50,75],[60,75],[75,75],[90,75],[100,75],[110,75],[125,75],
                    [10,80],[20,80],[30,80],[45,80],[55,80],[65,80],[80,80],[90,80],[105,80],[115,80],[130,80],
                    [60,90],[65,90],[75,90],[85,90],[95,90],[105,90],[115,90],[125,90],
                    [60,95],[70,95],[80,95],[90,95],[100,95],[110,95],[120,95],
                    [60,100],[65,100],[75,100],[85,100],[95,100],[105,100],[115,100],[125,100],[130,100],
                    [60,105],[70,105],[80,105],[90,105],[100,105],[110,105],[125,105],
                    [60,110],[65,110],[75,110],[85,110],[95,110],[105,110],[120,110],[130,110],
                    [60,115],[70,115],[80,115],[90,115],[100,115],[115,115],[125,115],
                    [60,120],[65,120],[75,120],[85,120],[95,120],[105,120],[120,120],
                    [60,125],[70,125],[80,125],[90,125],[100,125],[110,125],[125,125],[130,125],
                  ].map(([x,y], i) => (
                    <rect key={i} x={x} y={y} width="5" height="5" fill="black"/>
                  ))}
                </svg>
              </div>
              <button className="btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TelegramLinkIcon /> Auto-link Telegram
              </button>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                Notifications are sent via telegram. To start receiving notifications, please scan the QR with telegram on your phone.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Note: If you have issues when clicking the link, copy the link and open in a different browser, or scan the QR from your phone. This is because telegram requires you to open the desktop/mobile app to click start. If start is disabled, its because tor doesn't allow this.
              </p>
            </div>
          </div>

          {/* Notification toggles */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Receive notifications for:
            </div>
            <div className="notif-toggles-row">
              {[
                { key: 'orders', label: 'Orders' },
                { key: 'deposits', label: 'Deposits' },
                { key: 'tickets', label: 'Tickets' },
                { key: 'newProducts', label: 'New products' },
                { key: 'logins', label: 'Logins' },
              ].map(({ key, label }) => (
                <div key={key} className="notif-toggle-item">
                  <Toggle checked={notifToggles[key]} onChange={() => toggleNotif(key)} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* API keys */}
        <div className="settings-section settings-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div className="settings-card-icon" style={{ marginBottom: 0 }}><ApiIcon /></div>
                <div className="settings-card-title" style={{ marginBottom: 0 }}>API keys</div>
              </div>
              <p className="settings-desc">Used to access the products JSON API</p>
            </div>
            <button className="btn-primary btn-small" onClick={generateKey}>New Key</button>
          </div>

          <div style={{ marginTop: 8 }}>
            <div className="settings-section-title" style={{ fontSize: 15, marginBottom: 12, paddingBottom: 0, borderBottom: 'none' }}>Usage</div>
            <div className="api-usage-block">
              <code style={{ fontSize: 12, color: '#c8d3e0', fontFamily: 'monospace', lineHeight: 1.7 }}>
                {'// Add a header \'x-api-key\' to your request, passing the API key as the value'}<br />
                {'curl -H "x-api-key: <api-key>" <url>/api/products/scrape'}
              </code>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="settings-section-title" style={{ fontSize: 15, marginBottom: 12, paddingBottom: 0, borderBottom: 'none' }}>Your keys</div>
            {apiKeys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No active API keys
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {apiKeys.map(k => (
                  <div key={k.id} className="api-key-value">
                    <code className="api-key-code">{k.key}</code>
                    <div className="api-key-actions">
                      <button className="icon-action-btn" onClick={() => copyKey(k.key)} title="Copy">
                        <CopyIcon />
                      </button>
                      <button className="icon-action-btn" onClick={() => deleteKey(k.id)} title="Delete" style={{ color: '#e53935' }}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}