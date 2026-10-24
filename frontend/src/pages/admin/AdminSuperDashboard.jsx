import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';

function Section({ title, children }) {
  return (
    <div className="admin-card" style={{ marginBottom: 16, maxWidth: 680 }}>
      <div className="admin-card-title">{title}</div>
      {children}
    </div>
  );
}

const fmtDate = d => new Date(d).toLocaleString();
const COINS = [
  { currency: 'BTC',  color: '#f7931a', key: 'btcCommissionAddress' },
  { currency: 'LTC',  color: '#345d9d', key: 'ltcCommissionAddress' },
  { currency: 'DOGE', color: '#c2a633', key: 'dogeCommissionAddress' },
  { currency: 'ETH',  color: '#627eea', key: 'ethCommissionAddress' },
];

// The commission is deducted from each customer deposit when it is credited, and
// stays on the deposit address until swept from here. The admin's own sweep only
// collects the customer-credited share, so the two never touch each other's funds.
export default function AdminSuperDashboard() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState(null);

  const [logs, setLogs]               = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [pending, setPending]         = useState([]);
  const [collected, setCollected]     = useState([]);

  const [confirm, setConfirm]   = useState(null);  // currency awaiting confirmation
  const [sweeping, setSweeping] = useState(null);  // currency being swept
  const [result, setResult]     = useState(null);

  const loadSettings = () => {
    adminFetch('/admin/superadmin/settings')
      .then(d => { setSettings(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  };
  const loadActivity = () => {
    adminFetch('/admin/superadmin/sweep-logs')
      .then(d => { setLogs(d.logs || []); setLogsLoading(false); })
      .catch(() => setLogsLoading(false));
    adminFetch('/admin/superadmin/pending')
      .then(d => { setPending(d.pending || []); setCollected(d.collected || []); })
      .catch(() => {});
  };

  useEffect(() => { loadSettings(); loadActivity(); }, []);

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const saveSettings = async e => {
    e.preventDefault(); setSaving(true); setSaved(false); setErr(null);
    try {
      await adminFetch('/admin/superadmin/settings', {
        method: 'PUT',
        body: {
          commissionPct:          settings.commissionPct,
          btcCommissionAddress:   settings.btcCommissionAddress,
          ltcCommissionAddress:   settings.ltcCommissionAddress,
          dogeCommissionAddress:  settings.dogeCommissionAddress,
          ethCommissionAddress:   settings.ethCommissionAddress,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const doSweep = async () => {
    const currency = confirm;
    setSweeping(currency); setResult(null); setConfirm(null); setErr(null);
    try {
      const path = currency === 'ETH' ? '/admin/superadmin/eth/sweep' : `/admin/superadmin/utxo/sweep/${currency}`;
      setResult(await adminFetch(path, { method: 'POST' }));
      loadActivity();
    } catch (e) { setErr(e.message); }
    finally { setSweeping(null); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;

  const s = settings;
  const pendingOf = c => pending.find(p => p.currency === c);
  const reserveLogs = logs.filter(l => l.kind !== 'shop');

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Super Admin</h1>
          <p className="admin-page-subtitle">Deposit commission & reserve fund — visible only to super admin accounts</p>
        </div>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 14 }}>{err}</div>}

      <Section title="Deposit commission">
        <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 14, lineHeight: 1.6 }}>
          This percentage is deducted from every customer deposit when it is credited — the customer is credited the rest
          and sees the rate before depositing. The commission is swept to the reserve addresses below, separately from the admin's sweep.
          A new rate applies to deposits confirmed after saving.
        </div>
        <form onSubmit={saveSettings}>
          <div className="admin-form-group">
            <label className="admin-label">Commission % per deposit</label>
            <input
              className="admin-input" type="number" min="0" max="99" step="0.1"
              value={s.commissionPct}
              onChange={e => set('commissionPct', e.target.value)}
              style={{ maxWidth: 140 }}
            />
          </div>
          {COINS.map(({ currency, key }) => (
            <div className="admin-form-group" key={key}>
              <label className="admin-label">{currency} reserve address</label>
              <input
                className="admin-input" type="text"
                value={s[key] || ''}
                onChange={e => set(key, e.target.value)}
                placeholder="Destination address"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          ))}
          <button className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </form>
      </Section>

      <Section title="Commission to sweep">
        <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 14, lineHeight: 1.6 }}>
          Commission recorded on confirmed deposits and still sitting on the deposit addresses. Each sweep sends only
          the commission (minus the network fee) and leaves the customer share for the admin. XMR is collected from the Monero wallet by hand.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[...COINS, { currency: 'XMR', color: '#ff6600' }].map(({ currency, color }) => {
            const p = pendingOf(currency);
            const total = collected.find(c => c.currency === currency);
            return (
              <div key={currency} style={{ border: `1px solid ${color}55`, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color }}>{currency}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p ? p.amount : 0}</div>
                <div style={{ fontSize: 11, color: '#6c757d' }}>
                  {p ? `${p.deposits} deposit(s) pending` : 'nothing pending'}
                  {total ? ` · ${total.amount} all-time` : ''}
                </div>
              </div>
            );
          })}
        </div>

        {result && (
          <div style={{ marginBottom: 14, background: result.swept > 0 ? 'rgba(67,160,71,.08)' : 'rgba(108,117,125,.08)', border: `1px solid ${result.swept > 0 ? 'rgba(67,160,71,.25)' : 'rgba(108,117,125,.2)'}`, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {result.swept > 0 ? `✓ ${result.swept} address(es) swept — ${result.total} ${result.currency} to the reserve` : `Nothing to sweep (${result.currency})`}
            </div>
            {result.results?.map((r, i) => (
              <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', marginBottom: 4, color: '#2e7d32' }}>
                {r.amount} {r.currency} <span style={{ color: '#6c757d' }}>({r.txHash?.slice(0, 16)}…)</span>
              </div>
            ))}
            {result.skipped?.filter(x => x.reason !== 'empty').map((x, i) => (
              <div key={`s${i}`} style={{ fontSize: 12, color: '#e65100', marginBottom: 2 }}>⚠ {x.address?.slice(0, 12)}… — {x.reason}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {COINS.map(({ currency, color, key }) => (
            confirm === currency ? (
              <div key={currency} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>Sweep {currency} commission to the reserve?</span>
                <button className="admin-btn admin-btn-success admin-btn-sm" onClick={doSweep} disabled={!!sweeping}>Yes, sweep</button>
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setConfirm(null)}>Cancel</button>
              </div>
            ) : (
              <button
                key={currency} type="button" className="admin-btn admin-btn-sm"
                style={{ background: `${color}22`, color, border: `1px solid ${color}55`, fontWeight: 700 }}
                disabled={!!sweeping || !s[key]}
                title={!s[key] ? `Set the ${currency} reserve address first` : undefined}
                onClick={() => setConfirm(currency)}
              >
                {sweeping === currency ? `Sweeping ${currency}…` : `Sweep ${currency}`}
              </button>
            )
          ))}
        </div>
      </Section>

      <Section title="Reserve fund history">
        {logsLoading ? (
          <div style={{ color: '#6c757d', fontSize: 13 }}>Loading…</div>
        ) : reserveLogs.length === 0 ? (
          <div style={{ color: '#6c757d', fontSize: 13 }}>No sweeps yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Currency</th><th>Reserve</th><th>Tx</th><th>By</th></tr>
              </thead>
              <tbody>
                {reserveLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{fmtDate(l.createdAt)}</td>
                    <td style={{ fontSize: 12 }}>{l.kind === 'legacy' ? `Split sweep (${Number(l.commissionPct)}%)` : 'Commission sweep'}</td>
                    <td>{l.currency}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#e65100' }}>{Number(l.commissionAmount)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#6c757d' }}>{l.commissionTxHash ? `${l.commissionTxHash.slice(0, 12)}…` : '—'}</td>
                    <td>{l.triggeredByUser?.username || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
