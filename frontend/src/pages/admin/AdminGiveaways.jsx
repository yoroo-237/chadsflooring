import React, { useEffect, useState, useCallback } from 'react';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import Pagination from '../../components/admin/Pagination';
import ConfirmModal from '../../components/admin/ConfirmModal';

const EMPTY_FORM = {
  title: '', badge: '', gradientFrom: '#4361ee', gradientTo: '#7c3aed', gradientAngle: 135,
  value: '', description: '', prizes: [''], endsAt: '', winnersCount: 1, maxEntries: '', active: true,
};

function GradientPreview({ from, to, angle }) {
  return (
    <div style={{
      height: 60, borderRadius: 10, marginBottom: 16,
      background: `linear-gradient(${angle}deg, ${from}, ${to})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: 0.5,
    }}>
      {angle}° · {from} → {to}
    </div>
  );
}

export default function AdminGiveaways() {
  const [items, setItems]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState(null);
  const [modal, setModal]         = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [delId, setDelId]         = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const [entriesModal, setEntriesModal] = useState(null); // { id, title }
  const [entries, setEntries]     = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const d = await adminFetch(`/admin/giveaways?page=${page}&limit=${limit}`);
      setItems(d.giveaways || []);
      setTotal(d.total || 0);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openEdit = item => {
    setForm({
      title: item.title || '',
      badge: item.badge || '',
      gradientFrom: item.gradientFrom || '#4361ee',
      gradientTo: item.gradientTo || '#7c3aed',
      gradientAngle: item.gradientAngle ?? 135,
      value: item.value || '',
      description: item.description || '',
      prizes: item.prizes?.length ? item.prizes : [''],
      endsAt: item.endsAt ? item.endsAt.slice(0, 16) : '',
      winnersCount: item.winnersCount ?? 1,
      maxEntries: item.maxEntries || '',
      active: item.active ?? true,
    });
    setModal(item);
  };
  const openCreate = () => { setForm(EMPTY_FORM); setModal('create'); };

  const save = async e => {
    e.preventDefault(); setSaving(true); setErr(null);
    try {
      const body = { ...form, prizes: form.prizes.filter(Boolean) };
      if (modal === 'create') await adminFetch('/admin/giveaways', { method: 'POST', body });
      else await adminFetch(`/admin/giveaways/${modal.id}`, { method: 'PUT', body });
      setModal(null); load();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const doDelete = async () => {
    setDeleting(true);
    try { await adminFetch(`/admin/giveaways/${delId}`, { method: 'DELETE' }); setDelId(null); load(); }
    catch (e) { setErr(e.message); }
    finally { setDeleting(false); }
  };

  const openEntries = async item => {
    setEntriesModal({ id: item.id, title: item.title });
    setEntriesLoading(true);
    setEntries([]);
    try {
      const d = await adminFetch(`/admin/giveaways/${item.id}/entries`);
      setEntries(d.entries || d || []);
    } catch (e) { setEntries([]); }
    finally { setEntriesLoading(false); }
  };

  const addPrize   = () => setForm(f => ({ ...f, prizes: [...f.prizes, ''] }));
  const setPrize   = (i, v) => setForm(f => ({ ...f, prizes: f.prizes.map((p, idx) => idx === i ? v : p) }));
  const removePrize = i => setForm(f => ({ ...f, prizes: f.prizes.filter((_, idx) => idx !== i) }));

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Giveaways</h1>
          <p className="admin-page-subtitle">{total} giveaways</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={openCreate}>+ New Giveaway</button>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Title</th><th>Badge</th><th>Value</th><th>Entries</th><th>Winners</th><th>Ends</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => <tr key={i}><td colSpan={8}><span className="admin-skel" style={{ width: '60%', height: 14, display: 'block' }} /></td></tr>)
              : items.length === 0
                ? <tr><td colSpan={8} className="admin-table-empty">No giveaways</td></tr>
                : items.map(g => (
                  <tr key={g.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{g.title}</div>
                    </td>
                    <td>
                      {g.badge
                        ? <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                            background: `linear-gradient(${g.gradientAngle ?? 135}deg, ${g.gradientFrom || '#4361ee'}, ${g.gradientTo || '#7c3aed'})`,
                            color: '#fff',
                          }}>{g.badge}</span>
                        : <span style={{ color: '#6c757d' }}>—</span>
                      }
                    </td>
                    <td style={{ fontWeight: 700 }}>{g.value || '—'}</td>
                    <td>{g._count?.entries ?? g.entryCount ?? 0}</td>
                    <td>{g.winnersCount ?? 1}</td>
                    <td style={{ fontSize: 12, color: '#6c757d' }}>{g.endsAt ? new Date(g.endsAt).toLocaleDateString() : '—'}</td>
                    <td><StatusBadge status={g.active ? 'active' : 'inactive'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEntries(g)}>Entries</button>
                        <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => openEdit(g)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDelId(g.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={Math.ceil(total / limit)} onChange={setPage} />

      {/* Create/Edit modal */}
      {modal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="admin-modal" style={{ maxWidth: 600, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="admin-modal-title">{modal === 'create' ? 'New Giveaway' : 'Edit Giveaway'}</div>

            {/* Gradient preview */}
            <GradientPreview from={form.gradientFrom} to={form.gradientTo} angle={form.gradientAngle} />

            <form onSubmit={save}>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-label">Title *</label>
                  <input className="admin-input" value={form.title} onChange={e => sf('title', e.target.value)} required />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Badge label</label>
                  <input className="admin-input" value={form.badge} onChange={e => sf('badge', e.target.value)} placeholder="e.g. GRAND PRIZE" />
                </div>
              </div>

              <div className="admin-form-row-3">
                <div className="admin-form-group">
                  <label className="admin-label">Gradient from</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="color" value={form.gradientFrom} onChange={e => sf('gradientFrom', e.target.value)} style={{ width: 40, height: 36, border: '1px solid #dee2e6', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                    <input className="admin-input" value={form.gradientFrom} onChange={e => sf('gradientFrom', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Gradient to</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="color" value={form.gradientTo} onChange={e => sf('gradientTo', e.target.value)} style={{ width: 40, height: 36, border: '1px solid #dee2e6', borderRadius: 8, cursor: 'pointer', padding: 2 }} />
                    <input className="admin-input" value={form.gradientTo} onChange={e => sf('gradientTo', e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Angle: {form.gradientAngle}°</label>
                  <input type="range" min="0" max="360" value={form.gradientAngle} onChange={e => sf('gradientAngle', parseInt(e.target.value))} style={{ width: '100%', marginTop: 8 }} />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-label">Value / Prize label</label>
                  <input className="admin-input" value={form.value} onChange={e => sf('value', e.target.value)} placeholder="e.g. $500 worth" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Ends at</label>
                  <input className="admin-input" type="datetime-local" value={form.endsAt} onChange={e => sf('endsAt', e.target.value)} />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-label">Description</label>
                <textarea className="admin-textarea" rows={3} value={form.description} onChange={e => sf('description', e.target.value)} />
              </div>

              {/* Prizes list */}
              <div className="admin-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="admin-label" style={{ marginBottom: 0 }}>Prizes</label>
                  <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={addPrize}>+ Add</button>
                </div>
                {form.prizes.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="admin-input" value={p} onChange={e => setPrize(i, e.target.value)} placeholder={`Prize ${i + 1}`} />
                    {form.prizes.length > 1 && (
                      <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removePrize(i)}>✕</button>
                    )}
                  </div>
                ))}
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-label">Winners count</label>
                  <input className="admin-input" type="number" min="1" value={form.winnersCount} onChange={e => sf('winnersCount', parseInt(e.target.value) || 1)} />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Max entries (optional)</label>
                  <input className="admin-input" type="number" min="1" value={form.maxEntries} onChange={e => sf('maxEntries', e.target.value)} placeholder="Unlimited" />
                </div>
              </div>

              <label className="admin-form-check" style={{ marginBottom: 20 }}>
                <input type="checkbox" checked={form.active} onChange={e => sf('active', e.target.checked)} /> Active
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

      {/* Entries modal */}
      {entriesModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEntriesModal(null); }}>
          <div className="admin-modal" style={{ maxWidth: 500 }}>
            <div className="admin-modal-title">Entries — {entriesModal.title}</div>
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {entriesLoading
                ? <div style={{ padding: 20, textAlign: 'center', color: '#6c757d' }}>Loading…</div>
                : entries.length === 0
                  ? <div style={{ padding: 20, textAlign: 'center', color: '#6c757d' }}>No entries yet</div>
                  : (
                    <table className="admin-table">
                      <thead><tr><th>#</th><th>User</th><th>Entered</th></tr></thead>
                      <tbody>
                        {entries.map((entry, i) => (
                          <tr key={entry.id || i}>
                            <td style={{ color: '#6c757d' }}>{i + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{entry.user?.username || entry.user?.email || '—'}</div>
                            </td>
                            <td style={{ fontSize: 12, color: '#6c757d' }}>{new Date(entry.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
              }
            </div>
            <div className="admin-modal-actions" style={{ marginTop: 16 }}>
              <button className="admin-btn admin-btn-secondary" onClick={() => setEntriesModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {delId && <ConfirmModal title="Delete giveaway?" message="All entries will also be deleted." confirmLabel="Delete" danger loading={deleting} onConfirm={doDelete} onCancel={() => setDelId(null)} />}
    </div>
  );
}
