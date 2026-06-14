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
const shortId = id => (id || '').slice(0, 8);

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

  const openConfirm = d => {
    setConfirmForm({ usdAmount: String(d.usdAmount || d.expectedUsd || ''), note: '' });
    setConfirmModal({ id: d.id });
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
                      <div style={{ fontSize: 11, color: '#6c757d' }}>{d.user?.email}</div>
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
                    <td><StatusBadge status={d.status} /></td>
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
