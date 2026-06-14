import React, { useEffect, useState, useCallback } from 'react';
import { adminFetch } from './utils/api';
import SearchInput from '../../components/admin/SearchInput';
import Pagination from '../../components/admin/Pagination';
import ConfirmModal from '../../components/admin/ConfirmModal';

const STARS = n => {
  const full = Math.round(Number(n) || 0);
  return (
    <span>
      {'★'.repeat(full)}<span style={{ color: '#dee2e6' }}>{'★'.repeat(5 - full)}</span>
    </span>
  );
};

export default function AdminReviews() {
  const [reviews, setReviews]   = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [approved, setApproved] = useState('');
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [delId, setDelId]       = useState(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const p = new URLSearchParams({ page, limit });
      if (search)       p.set('search',   search);
      if (approved !== '') p.set('approved', approved);
      const d = await adminFetch(`/admin/reviews?${p}`);
      setReviews(d.reviews || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page, search, approved]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id, val) => {
    setErr(null);
    try { await adminFetch(`/admin/reviews/${id}`, { method: 'PATCH', body: { approved: val } }); load(); }
    catch (e) { setErr(e.message); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await adminFetch(`/admin/reviews/${delId}`, { method: 'DELETE' }); setDelId(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Reviews</h1>
          <p className="admin-page-subtitle">{total} reviews</p>
        </div>
      </div>

      <div className="admin-filters">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search product…" />
        <select className="admin-filter-select" value={approved} onChange={e => { setApproved(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="false">Pending approval</option>
          <option value="true">Approved</option>
        </select>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>User</th>
              <th>Rating</th>
              <th>Title</th>
              <th>Review</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 8 }, (__, j) => <td key={j}><span className="admin-skel" style={{ width: '75%', height: 13, display: 'block' }} /></td>)}</tr>
              ))
              : reviews.length === 0
                ? <tr><td colSpan={8} className="admin-table-empty">No reviews found</td></tr>
                : reviews.map(r => {
                  const isApproved = r.approved ?? r.isApproved ?? false;
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {r.product?.imageUrl
                            ? <img src={r.product.imageUrl} alt={r.product.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            : <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                          }
                          <span style={{ fontWeight: 600, fontSize: 13, maxWidth: 120 }}>{r.product?.name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.user?.username || r.user?.email || '—'}</td>
                      <td style={{ color: '#ff9800', whiteSpace: 'nowrap' }}>{STARS(r.rating)}</td>
                      <td style={{ fontWeight: 600, fontSize: 13, maxWidth: 120 }}>{r.title || '—'}</td>
                      <td style={{ color: '#6c757d', fontSize: 12, maxWidth: 180 }}>
                        {((r.body || r.comment || '')).slice(0, 50)}{((r.body || r.comment || '')).length > 50 ? '…' : ''}
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20,
                          fontSize: 11.5, fontWeight: 700,
                          background: isApproved ? 'rgba(67,160,71,.12)' : 'rgba(255,152,0,.12)',
                          color: isApproved ? '#43a047' : '#ff9800',
                        }}>
                          {isApproved ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: '#6c757d' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!isApproved
                            ? <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => approve(r.id, true)}>Approve</button>
                            : <button className="admin-btn admin-btn-warning admin-btn-sm" onClick={() => approve(r.id, false)}>Unapprove</button>
                          }
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDelId(r.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} />

      {delId && <ConfirmModal title="Delete review?" message="This cannot be undone." confirmLabel="Delete" danger loading={deleting} onConfirm={doDelete} onCancel={() => setDelId(null)} />}
    </div>
  );
}
