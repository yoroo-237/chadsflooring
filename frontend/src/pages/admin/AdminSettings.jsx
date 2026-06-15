import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';

const TIERS = [
  { name: 'Basic',     min: 0,    max: 999,   cashback: '0%',  color: '#6c757d' },
  { name: 'Preferred', min: 1000, max: 1999,  cashback: '1%',  color: '#2196f3' },
  { name: 'Gold',      min: 2000, max: 4999,  cashback: '2.5%', color: '#ff9800' },
  { name: 'Platinum',  min: 5000, max: null,  cashback: '5%',  color: '#9c27b0' },
];

const TABS = ['General', 'Shipping', 'Loyalty', 'Deposits', 'Crypto'];

const fmt = v => v != null ? `$${Number(v).toFixed(2)}` : '—';

function Section({ title, children }) {
  return (
    <div className="admin-card" style={{ marginBottom: 16, maxWidth: 680 }}>
      <div className="admin-card-title">{title}</div>
      {children}
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState(null);
  const [saved, setSaved]           = useState(false);
  const [tab, setTab]               = useState('General');
  const [sweeping, setSweeping]     = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [sweepConfirm, setSweepConfirm] = useState(false);

  useEffect(() => {
    adminFetch('/admin/settings')
      .then(d => { setSettings(d.settings || d || {}); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const doSweep = async () => {
    setSweeping(true); setSweepResult(null); setSweepConfirm(false); setErr(null);
    try {
      const r = await adminFetch('/admin/eth/sweep', { method: 'POST' });
      setSweepResult(r);
    } catch (e) { setErr(e.message); }
    finally { setSweeping(false); }
  };

  const submit = async e => {
    e.preventDefault(); setSaving(true); setSaved(false); setErr(null);
    try {
      await adminFetch('/admin/settings', { method: 'PUT', body: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;

  const s = settings;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-subtitle">Global site configuration</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {err   && <div style={{ color: '#e53935',  marginBottom: 12, fontWeight: 600 }}>{err}</div>}
      {saved && <div style={{ color: '#43a047', marginBottom: 12, fontWeight: 600 }}>✓ Settings saved.</div>}

      <div className="admin-tabs">
        {TABS.map(t => <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <form onSubmit={submit}>
        {tab === 'General' && (
          <Section title="General">
            <div className="admin-form-group">
              <label className="admin-label">Site Name</label>
              <input className="admin-input" value={s.site_name || ''} onChange={e => set('site_name', e.target.value)} placeholder="Canna Express" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-check">
                <input type="checkbox"
                  checked={String(s.maintenance_mode) === 'true' || s.maintenance_mode === true}
                  onChange={e => set('maintenance_mode', e.target.checked)}
                />
                Maintenance Mode
              </label>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>When enabled, the store is inaccessible to customers.</div>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-check">
                <input type="checkbox"
                  checked={String(s.registration_open) !== 'false' && s.registration_open !== false}
                  onChange={e => set('registration_open', e.target.checked)}
                />
                Registration Open
              </label>
            </div>
          </Section>
        )}

        {tab === 'Shipping' && (
          <Section title="Shipping">
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-label">Shipping Cost ($)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#6c757d', fontWeight: 700 }}>$</span>
                  <input className="admin-input" type="number" min="0" step="0.01"
                    value={s.shipping_cost || ''} onChange={e => set('shipping_cost', e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Free Shipping Threshold ($)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#6c757d', fontWeight: 700 }}>$</span>
                  <input className="admin-input" type="number" min="0" step="0.01"
                    value={s.shipping_free_threshold || ''} onChange={e => set('shipping_free_threshold', e.target.value)} placeholder="0.00" />
                </div>
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Shipping Deadline</label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#6c757d' }}>Hours</span>
                  <input className="admin-input" type="number" min="0" max="23"
                    value={s.shipping_deadline_h ?? ''} onChange={e => set('shipping_deadline_h', e.target.value)}
                    style={{ width: 80 }} placeholder="HH" />
                </div>
                <span style={{ fontSize: 20, color: '#6c757d', marginTop: 16 }}>:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, color: '#6c757d' }}>Minutes</span>
                  <input className="admin-input" type="number" min="0" max="59"
                    value={s.shipping_deadline_m ?? ''} onChange={e => set('shipping_deadline_m', e.target.value)}
                    style={{ width: 80 }} placeholder="MM" />
                </div>
                <div style={{ marginTop: 14, fontSize: 13, color: '#6c757d' }}>
                  Orders placed before this time ship same day.
                </div>
              </div>
            </div>
          </Section>
        )}

        {tab === 'Loyalty' && (
          <>
            <Section title="Points Rate">
              <div className="admin-form-group">
                <label className="admin-label">Points per $1 spent</label>
                <input className="admin-input" type="number" min="0" step="0.01"
                  value={s.points_rate || ''} onChange={e => set('points_rate', e.target.value)}
                  placeholder="0.5" style={{ maxWidth: 160 }} />
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>
                  e.g. 0.5 = 50 points per $100 spent
                </div>
              </div>
            </Section>

            <Section title="Membership Tiers (read-only)">
              <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
                <table className="admin-table">
                  <thead>
                    <tr><th>Tier</th><th>Min Spent</th><th>Max Spent</th><th>Cashback</th></tr>
                  </thead>
                  <tbody>
                    {TIERS.map(t => (
                      <tr key={t.name}>
                        <td>
                          <span className="admin-badge" style={{ background: t.color + '20', color: t.color }}>{t.name}</span>
                        </td>
                        <td>{fmt(t.min)}</td>
                        <td>{t.max != null ? fmt(t.max) : 'No limit'}</td>
                        <td style={{ fontWeight: 700, color: t.color }}>{t.cashback}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </>
        )}

        {tab === 'Deposits' && (
          <Section title="Deposit Settings">
            <div className="admin-form-group">
              <label className="admin-label">Deposit Expiry (hours)</label>
              <input className="admin-input" type="number" min="1"
                value={s.deposit_expiry_hours || ''} onChange={e => set('deposit_expiry_hours', e.target.value)}
                placeholder="24" style={{ maxWidth: 160 }} />
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>
                Crypto deposit addresses expire after this many hours.
              </div>
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Minimum Deposit ($)</label>
              <input className="admin-input" type="number" min="0" step="0.01"
                value={s.min_deposit || ''} onChange={e => set('min_deposit', e.target.value)}
                placeholder="10.00" style={{ maxWidth: 160 }} />
            </div>
            <div className="admin-form-group">
              <label className="admin-label">Maximum Deposit ($)</label>
              <input className="admin-input" type="number" min="0" step="0.01"
                value={s.max_deposit || ''} onChange={e => set('max_deposit', e.target.value)}
                placeholder="5000.00" style={{ maxWidth: 160 }} />
            </div>
          </Section>
        )}

        {tab === 'Crypto' && (
          <>
            <Section title="Destination Addresses">
              <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 16 }}>
                Funds sent by customers are automatically forwarded to these addresses. Save after editing.
              </div>
              {[
                { key: 'btc_address',  label: 'Bitcoin (BTC)',   color: '#f7931a', placeholder: 'bc1q...',   note: 'Auto-forwarded via BlockCypher' },
                { key: 'doge_address', label: 'Dogecoin (DOGE)', color: '#c2a633', placeholder: 'D...',      note: 'Auto-forwarded via BlockCypher' },
                { key: 'ltc_address',  label: 'Litecoin (LTC)',  color: '#345d9d', placeholder: 'ltc1q...', note: 'Auto-forwarded via BlockCypher' },
                { key: 'eth_address',  label: 'Ethereum (ETH)',  color: '#627eea', placeholder: '0x...',     note: 'Sweep manually using the button below' },
                { key: 'xmr_address',  label: 'Monero (XMR)',   color: '#ff6600', placeholder: '4...',      note: 'Manual confirmation required' },
              ].map(f => (
                <div key={f.key} className="admin-form-group">
                  <label className="admin-label" style={{ color: f.color }}>
                    {f.label}
                    <span style={{ fontWeight: 400, fontSize: 11, color: '#6c757d', marginLeft: 8 }}>{f.note}</span>
                  </label>
                  <input
                    className="admin-input"
                    value={s[f.key] || ''}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>
              ))}
            </Section>

            <Section title="ETH Sweep">
              <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 14, lineHeight: 1.6 }}>
                Collects all ETH sitting in confirmed deposit addresses and sends it to the ETH address configured above.
                Run this whenever you want to retrieve your funds.
              </div>

              {sweepResult && (
                <div style={{ marginBottom: 14, background: sweepResult.swept > 0 ? 'rgba(67,160,71,.08)' : 'rgba(108,117,125,.08)', border: `1px solid ${sweepResult.swept > 0 ? 'rgba(67,160,71,.25)' : 'rgba(108,117,125,.2)'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {sweepResult.swept > 0 ? `✓ ${sweepResult.swept} address(es) swept` : 'Nothing to sweep'}
                  </div>
                  {sweepResult.results?.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', color: '#2e7d32', marginBottom: 2 }}>
                      {r.amountEth} ETH → <span style={{ color: '#6c757d' }}>{r.txHash?.slice(0, 16)}…</span>
                    </div>
                  ))}
                  {sweepResult.skipped?.filter(s => s.reason !== 'empty').map((s, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#e65100', marginBottom: 2 }}>
                      ⚠ {s.address?.slice(0, 10)}… — {s.reason}
                    </div>
                  ))}
                </div>
              )}

              {!sweepConfirm ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => setSweepConfirm(true)}
                  disabled={sweeping || !s.eth_address}
                >
                  {sweeping ? 'Sweeping…' : 'Sweep ETH to my address'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>
                    Send all ETH to {s.eth_address?.slice(0, 12)}… ?
                  </span>
                  <button type="button" className="admin-btn admin-btn-success" onClick={doSweep} disabled={sweeping}>
                    {sweeping ? 'Sending…' : 'Yes, sweep'}
                  </button>
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setSweepConfirm(false)}>
                    Cancel
                  </button>
                </div>
              )}
              {!s.eth_address && (
                <div style={{ fontSize: 12, color: '#6c757d', marginTop: 8 }}>
                  Enter your ETH address above and save first.
                </div>
              )}
            </Section>
          </>
        )}
      </form>
    </div>
  );
}
