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

export default function AdminSuperDashboard() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [err, setErr]           = useState(null);

  const [logs, setLogs]         = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [sweeping, setSweeping]         = useState(false);
  const [sweepConfirm, setSweepConfirm] = useState(false);
  const [sweepResult, setSweepResult]   = useState(null);

  const [utxoConfirm, setUtxoConfirm]   = useState(null);
  const [utxoSweeping, setUtxoSweeping] = useState(false);
  const [utxoResult, setUtxoResult]     = useState(null);

  const loadSettings = () => {
    adminFetch('/admin/superadmin/settings')
      .then(d => { setSettings(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  };
  const loadLogs = () => {
    adminFetch('/admin/superadmin/sweep-logs')
      .then(d => { setLogs(d.logs || []); setLogsLoading(false); })
      .catch(() => setLogsLoading(false));
  };

  useEffect(() => { loadSettings(); loadLogs(); }, []);

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

  const doEthSweep = async () => {
    setSweeping(true); setSweepResult(null); setSweepConfirm(false); setErr(null);
    try {
      const r = await adminFetch('/admin/superadmin/eth/sweep', { method: 'POST' });
      setSweepResult(r);
      loadLogs();
    } catch (e) { setErr(e.message); }
    finally { setSweeping(false); }
  };

  const doUtxoSweep = async () => {
    const currency = utxoConfirm;
    setUtxoSweeping(true); setUtxoResult(null); setUtxoConfirm(null); setErr(null);
    try {
      const r = await adminFetch(`/admin/superadmin/utxo/sweep/${currency}`, { method: 'POST' });
      setUtxoResult({ ...r, currency });
      loadLogs();
    } catch (e) { setErr(e.message); }
    finally { setUtxoSweeping(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;

  const s = settings;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Super Admin</h1>
          <p className="admin-page-subtitle">Commission sweep — visible only to super admin accounts</p>
        </div>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 14 }}>{err}</div>}

      <Section title="Commission settings">
        <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 14, lineHeight: 1.6 }}>
          Every super admin sweep splits the swept funds: this percentage goes to the commission
          address below, the rest goes to the site's usual crypto address — as agreed with the
          site manager. Regular admin sweeps (Settings → Crypto) are unaffected and always send 100%.
        </div>
        <form onSubmit={saveSettings}>
          <div className="admin-form-group">
            <label className="admin-label">Commission %</label>
            <input
              className="admin-input" type="number" min="0" max="100" step="0.1"
              value={s.commissionPct}
              onChange={e => set('commissionPct', e.target.value)}
              style={{ maxWidth: 140 }}
            />
          </div>
          {[
            ['btcCommissionAddress',  'BTC commission address'],
            ['ltcCommissionAddress',  'LTC commission address'],
            ['dogeCommissionAddress', 'DOGE commission address'],
            ['ethCommissionAddress',  'ETH commission address'],
          ].map(([key, label]) => (
            <div className="admin-form-group" key={key}>
              <label className="admin-label">{label}</label>
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

      <Section title="ETH commission sweep">
        <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 14, lineHeight: 1.6 }}>
          Sends {s.commissionPct}% of swept ETH to the commission address as a separate
          transaction, the rest to the site's ETH address.
        </div>
        {sweepResult && (
          <div style={{ marginBottom: 14, background: 'rgba(67,160,71,.08)', border: '1px solid rgba(67,160,71,.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {sweepResult.swept > 0 ? `✓ ${sweepResult.swept} address(es) swept — ${sweepResult.commissionPct}% commission applied` : 'Nothing to sweep'}
            </div>
            {sweepResult.results?.map((r, i) => (
              <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', marginBottom: 4 }}>
                <div style={{ color: '#2e7d32' }}>{r.amountMain} ETH → main ({r.txHash?.slice(0, 12)}…)</div>
                {r.commissionTxHash && <div style={{ color: '#e65100' }}>{r.amountCommission} ETH → commission ({r.commissionTxHash.slice(0, 12)}…)</div>}
              </div>
            ))}
          </div>
        )}
        {!sweepConfirm ? (
          <button className="admin-btn admin-btn-primary" onClick={() => setSweepConfirm(true)} disabled={sweeping || !s.ethCommissionAddress}>
            {sweeping ? 'Sweeping…' : 'Sweep ETH (with commission)'}
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>
              Split ETH {100 - s.commissionPct}% / {s.commissionPct}% ?
            </span>
            <button className="admin-btn admin-btn-success" onClick={doEthSweep} disabled={sweeping}>{sweeping ? 'Sending…' : 'Yes, sweep'}</button>
            <button className="admin-btn admin-btn-secondary" onClick={() => setSweepConfirm(false)}>Cancel</button>
          </div>
        )}
        {!s.ethCommissionAddress && <div style={{ fontSize: 12, color: '#6c757d', marginTop: 8 }}>Set the ETH commission address above and save first.</div>}
      </Section>

      <Section title="BTC / LTC / DOGE commission sweep">
        <div style={{ fontSize: 13, color: '#6c757d', marginBottom: 14, lineHeight: 1.6 }}>
          Same sweep as the regular admin panel, but each transaction has a second output sending
          {' '}{s.commissionPct}% to the commission address.
        </div>
        {utxoResult && (
          <div style={{ marginBottom: 14, background: 'rgba(67,160,71,.08)', border: '1px solid rgba(67,160,71,.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {utxoResult.swept > 0 ? `✓ ${utxoResult.swept} address(es) swept (${utxoResult.currency}) — ${utxoResult.commissionPct}% commission applied` : `Nothing to sweep (${utxoResult.currency})`}
            </div>
            {utxoResult.results?.map((r, i) => (
              <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', marginBottom: 4 }}>
                <div style={{ color: '#2e7d32' }}>{r.amountMain} {r.currency} → main</div>
                {Number(r.amountCommission) > 0 && <div style={{ color: '#e65100' }}>{r.amountCommission} {r.currency} → commission</div>}
                <div style={{ color: '#6c757d' }}>{r.txHash?.slice(0, 16)}…</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { currency: 'BTC',  color: '#f7931a', addr: s.btcCommissionAddress },
            { currency: 'LTC',  color: '#345d9d', addr: s.ltcCommissionAddress },
            { currency: 'DOGE', color: '#c2a633', addr: s.dogeCommissionAddress },
          ].map(({ currency, color, addr }) => (
            utxoConfirm === currency ? (
              <div key={currency} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#e65100', fontWeight: 600 }}>
                  Split {currency} {100 - s.commissionPct}% / {s.commissionPct}% ?
                </span>
                <button className="admin-btn admin-btn-success admin-btn-sm" onClick={doUtxoSweep} disabled={utxoSweeping}>{utxoSweeping ? 'Sending…' : 'Yes, sweep'}</button>
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setUtxoConfirm(null)}>Cancel</button>
              </div>
            ) : (
              <button
                key={currency} type="button" className="admin-btn admin-btn-sm"
                style={{ background: `${color}22`, color, border: `1px solid ${color}55`, fontWeight: 700 }}
                disabled={utxoSweeping || !addr}
                onClick={() => setUtxoConfirm(currency)}
              >
                {utxoSweeping && utxoConfirm === currency ? `Sweeping ${currency}…` : `Sweep ${currency} (with commission)`}
              </button>
            )
          ))}
        </div>
      </Section>

      <Section title="Commission history">
        {logsLoading ? (
          <div style={{ color: '#6c757d', fontSize: 13 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#6c757d', fontSize: 13 }}>No commission sweeps yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th><th>Currency</th><th>%</th><th>Main</th><th>Commission</th><th>By</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{fmtDate(l.createdAt)}</td>
                    <td>{l.currency}</td>
                    <td>{Number(l.commissionPct)}%</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{Number(l.mainAmount)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#e65100' }}>{Number(l.commissionAmount)}</td>
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
