import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';

const fmt = n => `$${Number(n).toFixed(2)}`;
const TABS = ['Profile', 'Orders', 'Transactions', 'Deposits', 'Tickets', 'API Keys'];

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const [tab, setTab]         = useState('Profile');
  const [balModal, setBalModal] = useState(false);
  const [balForm, setBalForm] = useState({ type: 'credit', amount: '', reason: '' });
  const [balSaving, setBalSaving] = useState(false);
  const [balErr, setBalErr]   = useState(null);

  const load = () => {
    setLoading(true);
    adminFetch(`/admin/users/${id}`)
      .then(d => { setData(d.user || d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, [id]);

  const adjustBalance = async e => {
    e.preventDefault(); setBalSaving(true); setBalErr(null);
    try {
      await adminFetch(`/admin/users/${id}/wallet`, { method: 'POST', body: balForm });
      setBalModal(false);
      load();
    } catch (e) { setBalErr(e.message); }
    finally { setBalSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;
  if (!data)   return <div style={{ padding: 40, color: '#e53935' }}>{err || 'User not found'}</div>;

  const u = data;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="admin-page-title">{u.username || u.email}</h1>
          <p className="admin-page-subtitle">{u.email} · <StatusBadge status={u.tier || 'basic'} label={u.tier || 'basic'} /></p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => { setBalForm({ type: 'credit', amount: '', reason: '' }); setBalModal(true); }}>
          Adjust Balance
        </button>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(t => <button key={t} className={`admin-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Profile' && (
        <div className="admin-grid-2">
          <div className="admin-card">
            <div className="admin-card-title">Account Info</div>
            <div className="admin-info-list">
              <div className="admin-info-row"><span className="admin-info-label">ID</span><span className="admin-info-value">{u.id}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Username</span><span className="admin-info-value">{u.username || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Email</span><span className="admin-info-value">{u.email}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Phone</span><span className="admin-info-value">{u.phone || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Role</span><span className="admin-info-value">{u.role}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Tier</span><span className="admin-info-value">{u.tier || 'basic'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Total Spent</span><span className="admin-info-value">{fmt(u.totalSpent || 0)}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Balance</span><span className="admin-info-value" style={{ color: '#43a047', fontWeight: 700 }}>{fmt(u.balance || 0)}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Joined</span><span className="admin-info-value">{new Date(u.createdAt).toLocaleString()}</span></div>
            </div>
          </div>
          {u.profile && (
            <div className="admin-card">
              <div className="admin-card-title">Profile</div>
              <div className="admin-info-list">
                {u.profile.firstName && <div className="admin-info-row"><span className="admin-info-label">First Name</span><span className="admin-info-value">{u.profile.firstName}</span></div>}
                {u.profile.lastName  && <div className="admin-info-row"><span className="admin-info-label">Last Name</span><span className="admin-info-value">{u.profile.lastName}</span></div>}
                {u.profile.address   && <div className="admin-info-row"><span className="admin-info-label">Address</span><span className="admin-info-value">{u.profile.address}</span></div>}
                {u.profile.city      && <div className="admin-info-row"><span className="admin-info-label">City</span><span className="admin-info-value">{u.profile.city}</span></div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Orders' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order #</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(u.orders || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No orders</td></tr>
                : (u.orders || []).map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mario-dashboard/orders/${o.id}`, { state: { order: o } })}>
                    <td style={{ fontWeight: 700 }}>#{o.orderNumber}</td>
                    <td>{fmt(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Transactions' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Type</th><th>Amount</th><th>Description</th><th>Date</th></tr></thead>
            <tbody>
              {(u.transactions || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No transactions</td></tr>
                : (u.transactions || []).map(t => (
                  <tr key={t.id}>
                    <td><StatusBadge status={t.type} label={t.type} /></td>
                    <td style={{ color: t.amount >= 0 ? '#43a047' : '#e53935', fontWeight: 700 }}>{t.amount >= 0 ? '+' : ''}{fmt(t.amount)}</td>
                    <td style={{ color: '#6c757d' }}>{t.description || '—'}</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Deposits' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(u.deposits || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No deposits</td></tr>
                : (u.deposits || []).map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700 }}>{fmt(d.amount)}</td>
                    <td style={{ color: '#6c757d' }}>{d.method}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'Tickets' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Subject</th><th>Status</th><th>Priority</th><th>Date</th></tr></thead>
            <tbody>
              {(u.tickets || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No tickets</td></tr>
                : (u.tickets || []).map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mario-dashboard/support/${t.id}`)}>
                    <td style={{ fontWeight: 600 }}>{t.subject}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><StatusBadge status={t.priority} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {tab === 'API Keys' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Permissions</th><th>Last Used</th><th>Created</th></tr></thead>
            <tbody>
              {(u.apiKeys || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No API keys</td></tr>
                : (u.apiKeys || []).map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600 }}>{k.name}</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{(k.permissions || []).join(', ')}</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Balance modal */}
      {balModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBalModal(false); }}>
          <div className="admin-modal">
            <div className="admin-modal-title">Adjust Balance</div>
            <form onSubmit={adjustBalance}>
              <div className="admin-form-group">
                <label className="admin-label">Type</label>
                <select className="admin-select" value={balForm.type} onChange={e => setBalForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (−)</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Amount *</label>
                <input className="admin-input" type="number" min="0.01" step="0.01" value={balForm.amount} onChange={e => setBalForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Reason *</label>
                <input className="admin-input" value={balForm.reason} onChange={e => setBalForm(f => ({ ...f, reason: e.target.value }))} required />
              </div>
              {balErr && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{balErr}</div>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setBalModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={balSaving}>{balSaving ? 'Saving…' : 'Apply'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
