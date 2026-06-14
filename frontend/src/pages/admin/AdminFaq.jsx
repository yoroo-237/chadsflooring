import React, { useEffect, useState, useRef } from 'react';
import { adminFetch } from './utils/api';
import ConfirmModal from '../../components/admin/ConfirmModal';

export default function AdminFaq() {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState(null);
  const [modal, setModal]       = useState(null); // null | 'create' | { id, question, answer }
  const [form, setForm]         = useState({ question: '', answer: '', category: '' });
  const [saving, setSaving]     = useState(false);
  const [delId, setDelId]       = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);
  const dragIdx = useRef(null);

  const load = () => {
    setLoading(true);
    adminFetch('/admin/faq?limit=200')
      .then(d => { setItems(d.faqs || d || []); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const openEdit = item => {
    setForm({ question: item.question, answer: item.answer, category: item.category || '' });
    setModal(item);
  };
  const openCreate = () => { setForm({ question: '', answer: '', category: '' }); setModal('create'); };

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      if (modal === 'create') await adminFetch('/admin/faq', { method: 'POST', body: form });
      else await adminFetch(`/admin/faq/${modal.id}`, { method: 'PUT', body: form });
      setModal(null); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await adminFetch(`/admin/faq/${delId}`, { method: 'DELETE' }); setDelId(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  // Drag & drop handlers
  const onDragStart = i => { dragIdx.current = i; };
  const onDragOver  = e => { e.preventDefault(); };
  const onDrop      = async i => {
    const from = dragIdx.current;
    if (from === null || from === i) { dragIdx.current = null; return; }
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(i, 0, moved);
    dragIdx.current = null;
    setItems(reordered);
    // Persist new order
    setReordering(true);
    try {
      await adminFetch('/admin/faq/reorder', {
        method: 'PUT',
        body: { ids: reordered.map(f => f.id) },
      });
    } catch (e) { setErr(e.message); load(); }
    finally { setReordering(false); }
  };
  const onDragEnd = () => { dragIdx.current = null; };

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">FAQ</h1>
          <p className="admin-page-subtitle">{items.length} questions · drag rows to reorder</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ Add Question</button>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}
      {reordering && <div style={{ color: '#ff9800', marginBottom: 12, fontSize: 13 }}>Saving order…</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th style={{ width: 42 }}>#</th>
              <th>Question</th>
              <th>Category</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i}><td colSpan={5}><span className="admin-skel" style={{ width: '60%', height: 14, display: 'block' }} /></td></tr>
              ))
              : items.length === 0
                ? <tr><td colSpan={5} className="admin-table-empty">No FAQ entries</td></tr>
                : items.map((f, i) => (
                  <tr
                    key={f.id}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(i)}
                    onDragEnd={onDragEnd}
                    style={{ cursor: 'grab' }}
                  >
                    <td style={{ color: '#6c757d', fontSize: 18, textAlign: 'center', cursor: 'grab' }} title="Drag to reorder">⠿</td>
                    <td style={{ color: '#6c757d', fontWeight: 700, fontSize: 13 }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {f.question.length > 80 ? f.question.slice(0, 80) + '…' : f.question}
                      </div>
                      <div style={{ color: '#6c757d', fontSize: 12, marginTop: 2 }}>
                        {(f.answer || '').slice(0, 60)}{(f.answer || '').length > 60 ? '…' : ''}
                      </div>
                    </td>
                    <td style={{ color: '#6c757d', fontSize: 13 }}>{f.category || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(f)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDelId(f.id)}>Delete</button>
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
          <div className="admin-modal" style={{ maxWidth: 580 }}>
            <div className="admin-modal-title">{modal === 'create' ? 'New FAQ Entry' : 'Edit FAQ Entry'}</div>
            <form onSubmit={save}>
              <div className="admin-form-group">
                <label className="admin-label">Category</label>
                <input className="admin-input" value={form.category} onChange={e => sf('category', e.target.value)} placeholder="e.g. Shipping, Payment…" />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Question *</label>
                <textarea className="admin-textarea" rows={3} value={form.question} onChange={e => sf('question', e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Answer *</label>
                <textarea className="admin-textarea" rows={5} value={form.answer} onChange={e => sf('answer', e.target.value)} required />
              </div>
              {err && <div style={{ color: '#e53935', fontSize: 13, marginBottom: 12 }}>{err}</div>}
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delId && <ConfirmModal title="Delete FAQ entry?" message="This cannot be undone." confirmLabel="Delete" danger loading={deleting} onConfirm={doDelete} onCancel={() => setDelId(null)} />}
    </div>
  );
}
