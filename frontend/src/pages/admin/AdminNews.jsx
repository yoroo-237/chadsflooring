import React, { useEffect, useState, useCallback } from 'react';
import { adminFetch } from './utils/api';
import Pagination from '../../components/admin/Pagination';
import ConfirmModal from '../../components/admin/ConfirmModal';

const slugify = str =>
  str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const EMPTY = { title: '', slug: '', category: '', excerpt: '', body: '', imageUrl: '', tag: '', tagColor: '#4361ee', isPublished: false };
const CATEGORIES = ['Announcement', 'Community', 'Products', 'Promotions', 'Education', 'Other'];

export default function AdminNews() {
  const [items, setItems]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [modal, setModal]       = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [delId, setDelId]       = useState(null);
  const [deleting, setDeleting] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const d = await adminFetch(`/admin/news?page=${page}&limit=${limit}`);
      setItems(d.articles || d.news || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTitle = v => {
    sf('title', v);
    setForm(f => ({ ...f, title: v, slug: slugify(v) }));
  };

  const openEdit = item => {
    setForm({
      title: item.title || '',
      slug: item.slug || slugify(item.title || ''),
      category: item.category || '',
      excerpt: item.excerpt || '',
      body: item.body || '',
      imageUrl: item.imageUrl || '',
      tag: item.tag || '',
      tagColor: item.tagColor || '#4361ee',
      isPublished: item.isPublished ?? item.published ?? false,
    });
    setModal(item);
  };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      if (modal === 'create') await adminFetch('/admin/news', { method: 'POST', body: form });
      else await adminFetch(`/admin/news/${modal.id}`, { method: 'PUT', body: form });
      setModal(null); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const togglePublish = async item => {
    try {
      await adminFetch(`/admin/news/${item.id}`, {
        method: 'PUT',
        body: { ...item, isPublished: !item.isPublished, published: !item.isPublished },
      });
      load();
    } catch (e) { setErr(e.message); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await adminFetch(`/admin/news/${delId}`, { method: 'DELETE' }); setDelId(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">News Articles</h1>
          <p className="admin-page-subtitle">{total} articles</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ New Article</button>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Category</th><th>Tag</th><th>Published</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={6}><span className="admin-skel" style={{ width: '60%', height: 14, display: 'block' }} /></td></tr>)
              : items.length === 0
                ? <tr><td colSpan={6} className="admin-table-empty">No articles</td></tr>
                : items.map(a => {
                  const isPublished = a.isPublished ?? a.published ?? false;
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600, maxWidth: 240 }}>{a.title}</td>
                      <td style={{ color: '#6c757d', fontSize: 13 }}>{a.category || '—'}</td>
                      <td>
                        {a.tag
                          ? <span className="admin-badge" style={{ background: (a.tagColor || '#4361ee') + '22', color: a.tagColor || '#4361ee' }}>{a.tag}</span>
                          : <span style={{ color: '#6c757d', fontSize: 13 }}>—</span>
                        }
                      </td>
                      <td style={{ fontSize: 12, color: '#6c757d' }}>
                        {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : isPublished ? 'Yes' : '—'}
                      </td>
                      <td>
                        <span style={{ color: isPublished ? '#43a047' : '#ff9800', fontWeight: 700, fontSize: 13 }}>
                          {isPublished ? '✓ Published' : '○ Draft'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className={`admin-btn admin-btn-sm ${isPublished ? 'admin-btn-warning' : 'admin-btn-success'}`}
                            onClick={() => togglePublish(a)}
                          >
                            {isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(a)}>Edit</button>
                          <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDelId(a.id)}>Delete</button>
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

      {modal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="admin-modal" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="admin-modal-title">{modal === 'create' ? 'New Article' : 'Edit Article'}</div>
            <form onSubmit={save}>
              <div className="admin-form-group">
                <label className="admin-label">Title *</label>
                <input className="admin-input" value={form.title} onChange={e => handleTitle(e.target.value)} required />
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-label">Slug</label>
                  <input className="admin-input" value={form.slug} onChange={e => sf('slug', e.target.value)} placeholder="auto-generated" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Category</label>
                  <select className="admin-select" value={form.category} onChange={e => sf('category', e.target.value)}>
                    <option value="">None</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Excerpt</label>
                <textarea className="admin-textarea" rows={2} value={form.excerpt} onChange={e => sf('excerpt', e.target.value)} />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Body *</label>
                <textarea className="admin-textarea" rows={6} value={form.body} onChange={e => sf('body', e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Image URL</label>
                <input className="admin-input" value={form.imageUrl} onChange={e => sf('imageUrl', e.target.value)} placeholder="https://…" />
              </div>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-label">Tag label</label>
                  <input className="admin-input" value={form.tag} onChange={e => sf('tag', e.target.value)} placeholder="e.g. New Product" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Tag color</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={form.tagColor} onChange={e => sf('tagColor', e.target.value)} style={{ width: 40, height: 36, border: '1px solid #dee2e6', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                    {form.tag && (
                      <span className="admin-badge" style={{ background: form.tagColor + '22', color: form.tagColor }}>
                        {form.tag}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <label className="admin-form-check" style={{ marginBottom: 20 }}>
                <input type="checkbox" checked={form.isPublished} onChange={e => sf('isPublished', e.target.checked)} />
                Published
              </label>
              {err && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{err}</div>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId && <ConfirmModal title="Delete article?" message="This cannot be undone." confirmLabel="Delete" danger loading={deleting} onConfirm={doDelete} onCancel={() => setDelId(null)} />}
    </div>
  );
}
