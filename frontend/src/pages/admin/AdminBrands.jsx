import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';
import ConfirmModal from '../../components/admin/ConfirmModal';

export default function AdminBrands() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState({ name: '', description: '', logoUrl: '' });
  const [saving, setSaving]     = useState(false);
  const [delId, setDelId]       = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch('/admin/brands?limit=200')
      .then(d => { setItems(d.brands || d || []); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openEdit = item => { setForm({ name: item.name, description: item.description || '', logoUrl: item.logoUrl || '' }); setModal(item); };
  const openCreate = () => { setForm({ name: '', description: '', logoUrl: '' }); setModal('create'); };

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      if (modal === 'create') await adminFetch('/admin/brands', { method: 'POST', body: form });
      else await adminFetch(`/admin/brands/${modal.id}`, { method: 'PUT', body: form });
      setModal(null); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await adminFetch(`/admin/brands/${delId}`, { method: 'DELETE' }); setDelId(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div><h1 className="admin-page-title">Brands</h1></div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Brand</button>
      </div>
      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Logo</th><th>Name</th><th>Slug</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={5}><span className="admin-skel" style={{ width: '60%', height: 14, display: 'block' }} /></td></tr>)
              : items.length === 0
                ? <tr><td colSpan={5} className="admin-table-empty">No brands</td></tr>
                : items.map(b => (
                  <tr key={b.id}>
                    <td>
                      {b.logoUrl
                        ? <img src={b.logoUrl} alt={b.name} className="admin-img-preview" style={{ width: 36, height: 36 }} />
                        : <span style={{ fontSize: 22 }}>🔖</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{b.name}</td>
                    <td style={{ color: '#6c757d' }}>{b.slug}</td>
                    <td style={{ color: '#6c757d' }}>{b.description || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(b)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDelId(b.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="admin-modal">
            <div className="admin-modal-title">{modal === 'create' ? 'New Brand' : 'Edit Brand'}</div>
            <form onSubmit={save}>
              <div className="admin-form-group">
                <label className="admin-label">Name *</label>
                <input className="admin-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Logo URL</label>
                <input className="admin-input" value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://…" />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Description</label>
                <textarea className="admin-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId && <ConfirmModal title="Delete brand?" message="This cannot be undone." confirmLabel="Delete" danger loading={deleting} onConfirm={doDelete} onCancel={() => setDelId(null)} />}
    </div>
  );
}
