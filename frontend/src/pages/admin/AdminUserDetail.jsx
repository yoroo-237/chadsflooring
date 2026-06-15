import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';

const fmt = n => `$${Number(n).toFixed(2)}`;
const TABS = ['Profile', 'Orders', 'Transactions', 'Deposits', 'Tickets', 'API Keys'];

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [tab, setTab]           = useState('Profile');

  // Balance adjust modal
  const [balModal, setBalModal] = useState(false);
  const [balForm, setBalForm]   = useState({ type: 'credit', amount: '', reason: '' });
  const [balSaving, setBalSaving] = useState(false);
  const [balErr, setBalErr]     = useState(null);

  // Edit user modal
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm]   = useState({ username: '', role: 'customer', isActive: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr]     = useState(null);

  // Set password modal
  const [pwdModal, setPwdModal]   = useState(false);
  const [pwdForm, setPwdForm]     = useState({ password: '', confirm: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdErr, setPwdErr]       = useState(null);
  const [pwdOk, setPwdOk]         = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch(`/admin/users/${id}`)
      .then(d => {
        const u = d.user || d;
        setData(u);
        setEditForm({ username: u.username || '', role: u.role || 'customer', isActive: u.isActive !== false });
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, [id]);

  const adjustBalance = async e => {
    e.preventDefault(); setBalSaving(true); setBalErr(null);
    try {
      await adminFetch(`/admin/users/${id}/wallet/adjust`, { method: 'POST', body: balForm });
      setBalModal(false);
      load();
    } catch (e) { setBalErr(e.message); }
    finally { setBalSaving(false); }
  };

  const saveEdit = async e => {
    e.preventDefault(); setEditSaving(true); setEditErr(null);
    try {
      await adminFetch(`/admin/users/${id}`, { method: 'PUT', body: editForm });
      setEditModal(false);
      load();
    } catch (e) { setEditErr(e.message); }
    finally { setEditSaving(false); }
  };

  const savePassword = async e => {
    e.preventDefault(); setPwdSaving(true); setPwdErr(null); setPwdOk(false);
    if (pwdForm.password !== pwdForm.confirm) {
      setPwdErr('Passwords do not match.'); setPwdSaving(false); return;
    }
    try {
      await adminFetch(`/admin/users/${id}/password`, { method: 'PATCH', body: { password: pwdForm.password } });
      setPwdOk(true);
      setPwdForm({ password: '', confirm: '' });
      setTimeout(() => { setPwdModal(false); setPwdOk(false); }, 1500);
    } catch (e) { setPwdErr(e.message); }
    finally { setPwdSaving(false); }
  };

  const toggleBan = async () => {
    try {
      await adminFetch(`/admin/users/${id}/ban`, { method: 'PATCH' });
      load();
    } catch (e) { setErr(e.message); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;
  if (!data)   return <div style={{ padding: 40, color: '#e53935' }}>{err || 'User not found'}</div>;

  const u = data;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="admin-page-title">{u.username || '—'}</h1>
          <p className="admin-page-subtitle"><StatusBadge status={u.tier || 'basic'} label={u.tier || 'basic'} /></p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={toggleBan}
            style={{ color: u.isActive !== false ? '#e53935' : '#43a047' }}
          >
            {u.isActive !== false ? 'Ban User' : 'Unban User'}
          </button>
          <button className="admin-btn admin-btn-secondary" onClick={() => { setPwdForm({ password: '', confirm: '' }); setPwdErr(null); setPwdOk(false); setPwdVisible(false); setPwdModal(true); }}>Set Password</button>
          <button className="admin-btn admin-btn-secondary" onClick={() => setEditModal(true)}>Edit User</button>
          <button className="admin-btn admin-btn-primary" onClick={() => { setBalForm({ type: 'credit', amount: '', reason: '' }); setBalModal(true); }}>
            Adjust Balance
          </button>
        </div>
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
              <div className="admin-info-row"><span className="admin-info-label">Role</span><span className="admin-info-value">{u.role}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Status</span><span className="admin-info-value"><StatusBadge status={u.isActive !== false ? 'active' : 'banned'} label={u.isActive !== false ? 'Active' : 'Banned'} /></span></div>
              <div className="admin-info-row"><span className="admin-info-label">Tier</span><span className="admin-info-value">{u.tier || 'basic'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Markup</span><span className="admin-info-value">{u.markupPct ?? 0}%</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Points</span><span className="admin-info-value">{u.points ?? 0}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Total Spent</span><span className="admin-info-value">{fmt(u.totalSpent || 0)}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Balance</span><span className="admin-info-value" style={{ color: '#43a047', fontWeight: 700 }}>{fmt(u.balance || 0)}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Joined</span><span className="admin-info-value">{new Date(u.createdAt).toLocaleString()}</span></div>
              {u.lastLoginAt && <div className="admin-info-row"><span className="admin-info-label">Last Login</span><span className="admin-info-value">{new Date(u.lastLoginAt).toLocaleString()}</span></div>}
            </div>
          </div>
          <div className="admin-card">
            <div className="admin-card-title">Contact & Details</div>
            <div className="admin-info-list">
              <div className="admin-info-row"><span className="admin-info-label">Telegram</span><span className="admin-info-value">{u.telegramHandle || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Signal</span><span className="admin-info-value">{u.signalDetails || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Session</span><span className="admin-info-value">{u.sessionDetails || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">BTC Address</span><span className="admin-info-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>{u.btcRefundAddress || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">XMR Address</span><span className="admin-info-value" style={{ fontSize: 11, wordBreak: 'break-all' }}>{u.xmrRefundAddress || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Bio</span><span className="admin-info-value">{u.bio || '—'}</span></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Orders' && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order #</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(u.recentOrders || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No orders</td></tr>
                : (u.recentOrders || []).map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mario-dashboard/orders/${o.id}`)}>
                    <td style={{ fontWeight: 700 }}>#{o.frontendId || o.id}</td>
                    <td>{fmt(o.totalAmount || 0)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(o.placedAt || o.createdAt).toLocaleDateString()}</td>
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
            <thead><tr><th>Type</th><th>Amount</th><th>Note</th><th>Date</th></tr></thead>
            <tbody>
              {(u.recentTransactions || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No transactions</td></tr>
                : (u.recentTransactions || []).map(t => (
                  <tr key={t.id}>
                    <td><StatusBadge status={t.type} label={t.type} /></td>
                    <td style={{ color: t.amount >= 0 ? '#43a047' : '#e53935', fontWeight: 700 }}>{t.amount >= 0 ? '+' : ''}{fmt(t.amount)}</td>
                    <td style={{ color: '#6c757d' }}>{t.note || '—'}</td>
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
            <thead><tr><th>Currency</th><th>USD Credited</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {(u.recentDeposits || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No deposits</td></tr>
                : (u.recentDeposits || []).map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700 }}>{d.currency}</td>
                    <td>{fmt(d.usdCredited || 0)}</td>
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
              {(u.recentTickets || []).length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No tickets</td></tr>
                : (u.recentTickets || []).map(t => (
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
            <thead><tr><th>Label</th><th>Prefix</th><th>Last Used</th><th>Active</th><th>Created</th></tr></thead>
            <tbody>
              {(u.apiKeys || []).length === 0
                ? <tr><td colSpan={5} className="admin-table-empty">No API keys</td></tr>
                : (u.apiKeys || []).map(k => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: 600 }}>{k.label || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{k.keyPrefix}…</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}</td>
                    <td><StatusBadge status={k.isActive ? 'active' : 'inactive'} label={k.isActive ? 'Yes' : 'No'} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Set password modal */}
      {pwdModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setPwdModal(false); }}>
          <div className="admin-modal">
            <div className="admin-modal-title">Set Password — {u.username}</div>
            <form onSubmit={savePassword}>
              <div className="admin-form-group">
                <label className="admin-label">New Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="admin-input"
                    type={pwdVisible ? 'text' : 'password'}
                    value={pwdForm.password}
                    onChange={e => setPwdForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 6 characters"
                    required
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setPwdVisible(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d', fontSize: 13 }}
                  >
                    {pwdVisible ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Confirm Password *</label>
                <input
                  className="admin-input"
                  type={pwdVisible ? 'text' : 'password'}
                  value={pwdForm.confirm}
                  onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat password"
                  required
                />
              </div>
              {pwdErr && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{pwdErr}</div>}
              {pwdOk  && <div style={{ color: '#43a047', fontSize: 13, marginBottom: 12 }}>✓ Password updated.</div>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setPwdModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={pwdSaving}>{pwdSaving ? 'Saving…' : 'Update Password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Balance adjust modal */}
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

      {/* Edit user modal */}
      {editModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditModal(false); }}>
          <div className="admin-modal">
            <div className="admin-modal-title">Edit User</div>
            <form onSubmit={saveEdit}>
              <div className="admin-form-group">
                <label className="admin-label">Username *</label>
                <input className="admin-input" value={editForm.username} onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Role</label>
                <select className="admin-select" value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="customer">Customer</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Status</label>
                <select className="admin-select" value={String(editForm.isActive)} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Banned</option>
                </select>
              </div>
              {editErr && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{editErr}</div>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setEditModal(false)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
