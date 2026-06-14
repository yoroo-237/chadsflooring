import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import SearchInput from '../../components/admin/SearchInput';
import Pagination from '../../components/admin/Pagination';

const fmt = n => `$${Number(n).toFixed(2)}`;

export default function AdminOrders() {
  const navigate = useNavigate();
  const [orders, setOrders]     = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const d = await adminFetch(`/admin/orders?${params}`);
      setOrders(d.orders || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Orders</h1>
          <p className="admin-page-subtitle">{total} total orders</p>
        </div>
      </div>

      <div className="admin-filters">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search order # or customer…" />
        <select className="admin-filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }, (__, j) => (
                    <td key={j}><span className="admin-skel" style={{ width: '80%', height: 14, display: 'block' }} /></td>
                  ))}
                </tr>
              ))
              : orders.length === 0
                ? <tr><td colSpan={7} className="admin-table-empty">No orders found</td></tr>
                : orders.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/mario-dashboard/orders/${o.id}`, { state: { order: o } })}>
                    <td style={{ fontWeight: 700 }}>#{o.orderNumber}</td>
                    <td>{o.user?.username || o.user?.email || '—'}</td>
                    <td>{o._count?.items ?? o.itemCount ?? '—'}</td>
                    <td>{fmt(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12 }}>{new Date(o.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm"
                        onClick={e => { e.stopPropagation(); navigate(`/mario-dashboard/orders/${o.id}`, { state: { order: o } }); }}>
                        View
                      </button>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
