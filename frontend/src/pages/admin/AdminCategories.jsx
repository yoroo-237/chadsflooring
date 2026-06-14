import React, { useEffect, useState } from 'react';
import { adminFetch } from './utils/api';
import ConfirmModal from '../../components/admin/ConfirmModal';

export default function AdminCategories() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [modal, setModal]       = useState(null); // null | 'create' | { id, name, description }
  const [form, setForm]         = useState({ name: '', description: '' });
  const [saving, setSaving]     = useState(false);
  const [delId, setDelId]       = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch('/admin/categories?limit=200')
      .then(d => { setItems(d.categories || d || []); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openEdit = item => { setForm({ name: item.name, description: item.description || '' }); setModal(item); };
  const openCreate = () => { setForm({ name: '', description: '' }); setModal('create'); };

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      if (modal === 'create') await adminFetch('/admin/categories', { method: 'POST', body: form });
      else await adminFetch(`/admin/categories/${modal.id}`, { method: 'PUT', body: form });
      setModal(null); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await adminFetch(`/admin/categories/${delId}`, { method: 'DELETE' }); setDelId(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div><h1 className="admin-page-title">Categories</h1></div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Category</button>
      </div>
      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Slug</th><th>Description</th><th></th></tr></thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={4}><span className="admin-skel" style={{ width: '60%', height: 14, display: 'block' }} /></td></tr>)
              : items.length === 0
                ? <tr><td colSpan={4} className="admin-table-empty">No categories</td></tr>
                : items.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ color: '#6c757d' }}>{c.slug}</td>
                    <td style={{ color: '#6c757d' }}>{c.description || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(c)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDelId(c.id)}>Delete</button>
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
            <div className="admin-modal-title">{modal === 'create' ? 'New Category' : 'Edit Category'}</div>
            <form onSubmit={save}>
              <div className="admin-form-group">
                <label className="admin-label">Name *</label>
                <input className="admin-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
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

      {delId && <ConfirmModal title="Delete category?" message="This cannot be undone." confirmLabel="Delete" danger loading={deleting} onConfirm={doDelete} onCancel={() => setDelId(null)} />}
    </div>
  );
}
