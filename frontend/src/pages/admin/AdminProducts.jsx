import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import SearchInput from '../../components/admin/SearchInput';
import Pagination from '../../components/admin/Pagination';
import ConfirmModal from '../../components/admin/ConfirmModal';

const fmt = n => `$${Number(n).toFixed(2)}`;

export default function AdminProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [delId, setDelId]       = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr]           = useState(null);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      const d = await adminFetch(`/admin/products?${params}`);
      setProducts(d.products || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async () => {
    setDeleting(true);
    try {
      await adminFetch(`/admin/products/${delId}`, { method: 'DELETE' });
      setDelId(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Products</h1>
          <p className="admin-page-subtitle">{total} products</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => navigate('/mario-dashboard/products/new')}>
          + Add Product
        </button>
      </div>

      <div className="admin-filters">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search products…" />
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Active</th><th></th></tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i}>{Array.from({ length: 7 }, (__, j) => <td key={j}><span className="admin-skel" style={{ width: '80%', height: 14, display: 'block' }} /></td>)}</tr>
              ))
              : products.length === 0
                ? <tr><td colSpan={7} className="admin-table-empty">No products found</td></tr>
                : products.map(p => (
                  <tr key={p.id}>
                    <td>
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="admin-img-preview" />
                        : <div style={{ width: 48, height: 48, background: '#f4f6f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#bdbdbd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
                      }
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ color: '#6c757d' }}>{p.category?.name || '—'}</td>
                    <td>{fmt(p.price)}</td>
                    <td style={{ color: p.stock === 0 ? '#e53935' : p.stock < 10 ? '#ff9800' : '#43a047', fontWeight: 700 }}>{p.stock}</td>
                    <td>
                      <span style={{ color: p.isActive ? '#43a047' : '#e53935', fontWeight: 700 }}>{p.isActive ? '✓' : '✗'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm"
                          onClick={() => navigate(`/mario-dashboard/products/${p.id}/edit`)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm"
                          onClick={() => setDelId(p.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} />

      {delId && (
        <ConfirmModal
          title="Delete product?"
          message="This will deactivate the product. It won't appear in the store anymore."
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={doDelete}
          onCancel={() => setDelId(null)}
        />
      )}
    </div>
  );
}
