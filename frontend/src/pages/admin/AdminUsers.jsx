import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import SearchInput from '../../components/admin/SearchInput';
import Pagination from '../../components/admin/Pagination';

const TIERS = ['', 'basic', 'preferred', 'gold', 'platinum'];
const fmt = n => `$${Number(n).toFixed(2)}`;

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [tier, setTier]       = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const p = new URLSearchParams({ page, limit });
      if (search) p.set('search', search);
      if (tier)   p.set('tier', tier);
      const d = await adminFetch(`/admin/users?${p}`);
      setUsers(d.users || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page, search, tier]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-subtitle">{total} registered users</p>
        </div>
      </div>
      <div className="admin-filters">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search name or email…" />
        <select className="admin-filter-select" value={tier} onChange={e => { setTier(e.target.value); setPage(1); }}>
          <option value="">All tiers</option>
          {TIERS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>User</th><th>Email</th><th>Tier</th><th>Balance</th><th>Orders</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => <tr key={i}>{Array.from({length:7},(_,j)=><td key={j}><span className="admin-skel" style={{width:'80%',height:14,display:'block'}}/></td>)}</tr>)
              : users.length === 0
                ? <tr><td colSpan={7} className="admin-table-empty">No users found</td></tr>
                : users.map(u => (
                  <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mario-dashboard/users/${u.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="admin-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>{(u.username?.[0] || u.email?.[0] || '?').toUpperCase()}</div>
                        <span style={{ fontWeight: 600 }}>{u.username || '—'}</span>
                      </div>
                    </td>
                    <td style={{ color: '#6c757d' }}>{u.email}</td>
                    <td><StatusBadge status={u.tier || 'basic'} label={u.tier || 'basic'} /></td>
                    <td>{fmt(u.balance || 0)}</td>
                    <td>{u._count?.orders ?? u.orderCount ?? 0}</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td><button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={e => { e.stopPropagation(); navigate(`/mario-dashboard/users/${u.id}`); }}>View</button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} />
    </div>
  );
}
