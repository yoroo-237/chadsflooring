import React, { useEffect, useState, useCallback } from 'react';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import SearchInput from '../../components/admin/SearchInput';
import Pagination from '../../components/admin/Pagination';

const fmt    = n => `$${Number(n || 0).toFixed(2)}`;
const shortId = id => String(id || '').slice(0, 8);

export default function AdminTransactions() {
  const [rows, setRows]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [type, setType]         = useState('');
  const [status, setStatus]     = useState('');
  const [currency, setCurrency] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const p = new URLSearchParams({ page, limit });
      if (search)   p.set('search',   search);
      if (type)     p.set('type',     type);
      if (status)   p.set('status',   status);
      if (currency) p.set('currency', currency);
      if (dateFrom) p.set('dateFrom', dateFrom);
      if (dateTo)   p.set('dateTo',   dateTo);
      const d = await adminFetch(`/admin/transactions?${p}`);
      setRows(d.transactions || []);
      setTotal(d.total || 0);
    } catch (e) {
      if (e.status === 404) { setRows([]); setTotal(0); }
      else setErr(e.message);
    }
    finally { setLoading(false); }
  }, [page, search, type, status, currency, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setSearch(''); setType(''); setStatus(''); setCurrency(''); setDateFrom(''); setDateTo(''); setPage(1); };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Transactions</h1>
          <p className="admin-page-subtitle">{total} records</p>
        </div>
      </div>

      <div className="admin-filters">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search user…" />
        <select className="admin-filter-select" value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          <option value="deposit">Deposit</option>
          <option value="purchase">Purchase</option>
          <option value="refund">Refund</option>
          <option value="adjustment">Adjustment</option>
          <option value="bonus">Bonus</option>
        </select>
        <select className="admin-filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select className="admin-filter-select" value={currency} onChange={e => { setCurrency(e.target.value); setPage(1); }}>
          <option value="">All currencies</option>
          <option value="USD">USD</option>
          <option value="BTC">BTC</option>
          <option value="DOGE">DOGE</option>
          <option value="LTC">LTC</option>
          <option value="XMR">XMR</option>
        </select>
        <input className="admin-filter-input" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} style={{ minWidth: 130 }} title="From date" />
        <input className="admin-filter-input" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} style={{ minWidth: 130 }} title="To date" />
        {(search || type || status || currency || dateFrom || dateTo) && (
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={reset}>✕ Clear</button>
        )}
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12, fontSize: 13 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Status</th>
              <th>Note</th>
              <th>Related to</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 9 }, (__, j) => <td key={j}><span className="admin-skel" style={{ width: '75%', height: 13, display: 'block' }} /></td>)}</tr>
              ))
              : rows.length === 0
                ? <tr><td colSpan={9} className="admin-table-empty">No transactions found</td></tr>
                : rows.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#6c757d' }}>{shortId(t.id)}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.user?.username || '—'}</div>
                    </td>
                    <td><StatusBadge status={t.type} label={t.type} /></td>
                    <td style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: Number(t.amount) >= 0 ? '#43a047' : '#e53935',
                    }}>
                      {Number(t.amount) >= 0 ? '+' : ''}{fmt(t.amount)}
                    </td>
                    <td style={{ color: '#6c757d', fontFamily: 'monospace', fontSize: 12 }}>{t.currency || 'USD'}</td>
                    <td><StatusBadge status={t.status || 'completed'} /></td>
                    <td style={{ color: '#6c757d', fontSize: 12, maxWidth: 160 }}>{t.note || t.description || '—'}</td>
                    <td style={{ fontSize: 12, color: '#6c757d' }}>
                      {t.orderId ? `Order #${t.orderId}` : t.depositId ? `Deposit #${t.depositId}` : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: '#6c757d', whiteSpace: 'nowrap' }}>
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
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
