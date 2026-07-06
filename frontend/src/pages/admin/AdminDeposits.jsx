import React, { useEffect, useState, useCallback } from 'react';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import Pagination from '../../components/admin/Pagination';
import ConfirmModal from '../../components/admin/ConfirmModal';

const CRYPTO_COLORS = {
  BTC:  { bg: 'rgba(247,147,26,.15)',  color: '#f7931a' },
  ETH:  { bg: 'rgba(98,126,234,.15)',  color: '#627eea' },
  DOGE: { bg: 'rgba(194,166,51,.15)',  color: '#c2a633' },
  LTC:  { bg: 'rgba(52,93,157,.15)',   color: '#345d9d' },
  XMR:  { bg: 'rgba(255,102,0,.15)',   color: '#ff6600' },
};

function CurrencyBadge({ currency }) {
  const s = CRYPTO_COLORS[currency] || { bg: 'rgba(108,117,125,.12)', color: '#6c757d' };
  return (
    <span className="admin-badge" style={{ background: s.bg, color: s.color, fontWeight: 700, fontFamily: 'monospace' }}>
      {currency}
    </span>
  );
}

function truncateAddr(addr) {
  if (!addr || addr.length <= 14) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

const fmt    = n => `$${Number(n || 0).toFixed(2)}`;
const fmtC   = n => Number(n || 0).toFixed(8).replace(/\.?0+$/, '');
const shortId = id => String(id || '').slice(0, 8);

export default function AdminDeposits() {
  const [deposits, setDeposits]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [currency, setCurrency]     = useState('');
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState(null);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState(null); // { id }
  const [confirmForm, setConfirmForm]   = useState({ usdAmount: '', note: '' });
  const [confirming, setConfirming]     = useState(false);

  // Expire confirm
  const [expireId, setExpireId]   = useState(null);
  const [expiring, setExpiring]   = useState(false);

  // Cleanup expired
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMsg, setCleanupMsg]         = useState(null);
  const [cleanupConfirm, setCleanupConfirm] = useState(false);

  // View address modal
  const [addrModal, setAddrModal] = useState(null); // { address, currency }
  const [copied, setCopied]       = useState(false);

  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const p = new URLSearchParams({ page, limit });
      if (statusFilter) p.set('status', statusFilter);
      if (currency)     p.set('currency', currency);
      const d = await adminFetch(`/admin/deposits?${p}`);
      setDeposits(d.deposits || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page, statusFilter, currency]);

  useEffect(() => { load(); }, [load]);

  const doConfirm = async e => {
    e.preventDefault(); setConfirming(true); setErr(null);
    try {
      await adminFetch(`/admin/deposits/${confirmModal.id}/confirm`, {
        method: 'PATCH',
        body: { usdAmount: parseFloat(confirmForm.usdAmount), note: confirmForm.note || undefined },
      });
      setConfirmModal(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setConfirming(false); }
  };

  const doExpire = async () => {
    setExpiring(true); setErr(null);
    try {
      await adminFetch(`/admin/deposits/${expireId}/expire`, { method: 'PATCH' });
      setExpireId(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setExpiring(false); }
  };

  const copyAddr = () => {
    navigator.clipboard?.writeText(addrModal?.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const doCleanup = async () => {
    setCleanupLoading(true); setCleanupMsg(null); setCleanupConfirm(false);
    try {
      const data = await adminFetch('/admin/deposits/cleanup', { method: 'POST' });
      setCleanupMsg(`${data.cleaned} deposit${data.cleaned !== 1 ? 's' : ''} expired and forwards released.`);
      load();
    } catch (e) {
      setCleanupMsg(`Error: ${e.message}`);
    } finally { setCleanupLoading(false); }
  };

  const openConfirm = d => {
    setConfirmForm({ usdAmount: String(d.usdAmount || d.expectedUsd || ''), note: '' });
    setConfirmModal({ id: d.id, currency: d.currency });
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Deposits</h1>
          <p className="admin-page-subtitle">{total} deposits</p>
        </div>
      </div>

      <div className="admin-filters">
        <select className="admin-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="awaiting">Awaiting</option>
          <option value="partial">Partial</option>
          <option value="confirmed">Confirmed</option>
          <option value="expired">Expired</option>
        </select>
        <select className="admin-filter-select" value={currency} onChange={e => { setCurrency(e.target.value); setPage(1); }}>
          <option value="">All currencies</option>
          {Object.keys(CRYPTO_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className="admin-btn admin-btn-danger admin-btn-sm"
          style={{ marginLeft: 'auto' }}
          disabled={cleanupLoading}
          onClick={() => setCleanupConfirm(true)}
        >
          {cleanupLoading ? 'Cleaning…' : 'Cleanup Expired'}
        </button>
      </div>
      {cleanupMsg && (
        <div style={{ marginBottom: 12, fontSize: 13, color: cleanupMsg.startsWith('Error') ? '#e53935' : '#2e7d32', background: cleanupMsg.startsWith('Error') ? 'rgba(229,57,53,.08)' : 'rgba(46,125,50,.08)', border: `1px solid ${cleanupMsg.startsWith('Error') ? 'rgba(229,57,53,.25)' : 'rgba(46,125,50,.25)'}`, borderRadius: 8, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{cleanupMsg}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', lineHeight: 1 }} onClick={() => setCleanupMsg(null)}>×</button>
        </div>
      )}

      {/* Process reference panel */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, background: 'rgba(67,160,71,.08)', border: '1px solid rgba(67,160,71,.25)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#2e7d32', marginBottom: 4 }}>⚡ Auto-confirmed (BTC · LTC · DOGE · ETH)</div>
          <div style={{ fontSize: 12, color: '#388e3c', lineHeight: 1.6 }}>
            A unique address is generated per deposit via BlockCypher (BTC/LTC/DOGE) or Alchemy (ETH).
            Once the transaction gets 1 on-chain confirmation, the webhook credits the customer's balance automatically.
            <strong> No action needed.</strong>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 220, background: 'rgba(251,140,0,.08)', border: '1px solid rgba(251,140,0,.3)', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#e65100', marginBottom: 4 }}>👤 Manual review required (XMR)</div>
          <div style={{ fontSize: 12, color: '#bf360c', lineHeight: 1.6 }}>
            All XMR deposits share a single address. The customer must open a support ticket with their TX Hash.
            Verify the payment in your Monero wallet, then click <strong>Confirm</strong> on the deposit row and enter the USD amount to credit.
          </div>
        </div>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12, fontSize: 13 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Currency</th>
              <th>Address</th>
              <th>Expected</th>
              <th>Received</th>
              <th>USD Credited</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 11 }, (__, j) => <td key={j}><span className="admin-skel" style={{ width: '70%', height: 13, display: 'block' }} /></td>)}</tr>
              ))
              : deposits.length === 0
                ? <tr><td colSpan={11} className="admin-table-empty">No deposits found</td></tr>
                : deposits.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6c757d' }}>{shortId(d.id)}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.user?.username || '—'}</div>
                    </td>
                    <td><CurrencyBadge currency={d.currency} /></td>
                    <td>
                      <button
                        className="admin-btn admin-btn-secondary admin-btn-sm"
                        style={{ fontFamily: 'monospace', fontSize: 11 }}
                        onClick={() => setAddrModal({ address: d.address, currency: d.currency })}
                        title={d.address}
                      >
                        {truncateAddr(d.address)}
                      </button>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {fmtC(d.expectedAmount)} {d.currency}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: d.receivedAmount > 0 ? '#43a047' : '#6c757d' }}>
                      {fmtC(d.receivedAmount)} {d.currency}
                    </td>
                    <td style={{ fontWeight: 700, color: d.usdCredited > 0 ? '#43a047' : '#6c757d' }}>
                      {d.usdCredited > 0 ? fmt(d.usdCredited) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        <StatusBadge status={d.status} />
                        {d.currency === 'XMR' && (d.status === 'awaiting' || d.status === 'partial') && (
                          <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(251,140,0,.15)', color: '#e65100', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                            MANUAL
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#6c757d' }}>
                      {d.expiresAt ? new Date(d.expiresAt).toLocaleString() : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#6c757d' }}>
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(d.status === 'awaiting' || d.status === 'partial') && (
                          <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => openConfirm(d)}>
                            Confirm
                          </button>
                        )}
                        {d.status === 'awaiting' && (
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setExpireId(d.id)}>
                            Expire
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} />

      {/* Confirm modal */}
      {confirmModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null); }}>
          <div className="admin-modal">
            <div className="admin-modal-title">Confirm Deposit</div>
            {confirmModal.currency === 'XMR' && (
              <div style={{ background: 'rgba(251,140,0,.1)', border: '1px solid rgba(251,140,0,.3)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#bf360c', lineHeight: 1.6 }}>
                <strong>XMR manual confirmation checklist:</strong><br />
                1. Open your Monero wallet and confirm you received a transaction from this customer.<br />
                2. Convert the XMR amount to USD at today's rate (e.g. via CoinGecko).<br />
                3. Enter the USD amount below and click Confirm — this credits the customer's balance.
              </div>
            )}
            <form onSubmit={doConfirm}>
              <div className="admin-form-group">
                <label className="admin-label">USD Amount to Credit *</label>
                <input
                  className="admin-input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={confirmForm.usdAmount}
                  onChange={e => setConfirmForm(f => ({ ...f, usdAmount: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Note (optional)</label>
                <input
                  className="admin-input"
                  value={confirmForm.note}
                  onChange={e => setConfirmForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Internal note…"
                />
              </div>
              {err && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{err}</div>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-success" disabled={confirming}>
                  {confirming ? 'Confirming…' : 'Confirm & Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expire confirm */}
      {expireId && (
        <ConfirmModal
          title="Expire this deposit?"
          message="The deposit will be marked as expired and no funds will be credited."
          confirmLabel="Expire"
          danger
          loading={expiring}
          onConfirm={doExpire}
          onCancel={() => setExpireId(null)}
        />
      )}

      {/* Cleanup expired confirm */}
      {cleanupConfirm && (
        <ConfirmModal
          title="Cleanup all expired deposits?"
          message="All awaiting/partial deposits past their expiry time will be marked expired and their BlockCypher forwards will be deleted."
          confirmLabel="Cleanup Expired"
          danger
          loading={cleanupLoading}
          onConfirm={doCleanup}
          onCancel={() => setCleanupConfirm(false)}
        />
      )}

      {/* View address modal */}
      {addrModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setAddrModal(null); }}>
          <div className="admin-modal">
            <div className="admin-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CurrencyBadge currency={addrModal.currency} /> Deposit Address
            </div>
            <div style={{ background: '#f4f6f9', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', lineHeight: 1.6 }}>
              {addrModal.address}
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-secondary" onClick={() => setAddrModal(null)}>Close</button>
              <button className="admin-btn admin-btn-primary" onClick={copyAddr}>
                {copied ? '✓ Copied!' : 'Copy Address'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
