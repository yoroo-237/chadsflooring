import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import SearchInput from '../../components/admin/SearchInput';
import Pagination from '../../components/admin/Pagination';
import StatCard from '../../components/admin/StatCard';

export default function AdminSupport() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats]     = useState(null);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const p = new URLSearchParams({ page, limit });
      if (status)   p.set('status', status);
      if (priority) p.set('priority', priority);
      if (search)   p.set('search', search);
      const [d, s] = await Promise.all([
        adminFetch(`/admin/support?${p}`),
        stats ? Promise.resolve(null) : adminFetch('/admin/support/stats').catch(() => null),
      ]);
      setTickets(d.tickets || []);
      setTotal(d.total || 0);
      if (s) setStats(s);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page, status, priority, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Support Tickets</h1>
          <p className="admin-page-subtitle">{total} tickets</p>
        </div>
      </div>

      {stats && (
        <div className="admin-stat-grid" style={{ marginBottom: 20 }}>
          <StatCard icon="🔵" color="#2196f3" label="Open"        value={stats.open        ?? 0} />
          <StatCard icon="🟡" color="#ff9800" label="In Progress" value={stats.in_progress ?? 0} />
          <StatCard icon="🟢" color="#43a047" label="Resolved"    value={stats.resolved    ?? 0} />
          <StatCard icon="⚫" color="#6c757d" label="Closed"      value={stats.closed      ?? 0} />
        </div>
      )}

      <div className="admin-filters">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search subject…" />
        <select className="admin-filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select className="admin-filter-select" value={priority} onChange={e => { setPriority(e.target.value); setPage(1); }}>
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Subject</th><th>User</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {loading
              ? Array.from({length:8},(_,i)=><tr key={i}>{Array.from({length:7},(_,j)=><td key={j}><span className="admin-skel" style={{width:'80%',height:14,display:'block'}}/></td>)}</tr>)
              : tickets.length === 0
                ? <tr><td colSpan={7} className="admin-table-empty">No tickets found</td></tr>
                : tickets.map(t => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mario-dashboard/support/${t.id}`)}>
                    <td style={{ fontWeight: 600, maxWidth: 200 }}>{t.subject}</td>
                    <td style={{ color: '#6c757d' }}>{t.user?.username || t.user?.email || '—'}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><StatusBadge status={t.priority} /></td>
                    <td style={{ color: '#6c757d' }}>{t.assignee?.username || '—'}</td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td><button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={e => { e.stopPropagation(); navigate(`/mario-dashboard/support/${t.id}`); }}>Open</button></td>
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
