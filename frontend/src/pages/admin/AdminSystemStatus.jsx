import React, { useEffect, useState, useCallback } from 'react';
import { adminFetch } from './utils/api';

const SERVICES = [
  { key: 'api',           label: 'API',             description: 'REST API endpoints' },
  { key: 'website',       label: 'Website',          description: 'Frontend storefront' },
  { key: 'checkout',      label: 'Checkout',         description: 'Order placement & payment' },
  { key: 'payments',      label: 'Payments',         description: 'Crypto deposit processing' },
  { key: 'notifications', label: 'Notifications',    description: 'Email & push notifications' },
  { key: 'database',      label: 'Database',         description: 'PostgreSQL primary DB' },
  { key: 'cdn',           label: 'CDN / Storage',    description: 'Cloudinary / static assets' },
  { key: 'email',         label: 'Email',            description: 'Transactional email delivery' },
];

const STATUS_OPTIONS = [
  { value: 'operational',         label: 'Operational',         color: '#43a047' },
  { value: 'degraded_performance', label: 'Degraded',           color: '#ff9800' },
  { value: 'partial_outage',      label: 'Partial Outage',      color: '#e53935' },
  { value: 'major_outage',        label: 'Major Outage',        color: '#b71c1c' },
  { value: 'maintenance',         label: 'Maintenance',         color: '#9c27b0' },
];

const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'];

function StatusDot({ status }) {
  const s = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
  return <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block', marginRight: 6, flexShrink: 0 }} />;
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: toast.type === 'error' ? '#e53935' : '#43a047',
      color: '#fff', borderRadius: 10, padding: '12px 20px',
      fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.2)',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
    </div>
  );
}

const EMPTY_INCIDENT = { dateLabel: '', title: '', status: 'investigating', description: '' };

export default function AdminSystemStatus() {
  const [components, setComponents] = useState({});
  const [incidents, setIncidents]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState(null);
  const [toast, setToast]           = useState(null);
  const [incModal, setIncModal]     = useState(null); // null | 'create' | { id, ... }
  const [incForm, setIncForm]       = useState(EMPTY_INCIDENT);
  const [incSaving, setIncSaving]   = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminFetch('/admin/system-status'),
      adminFetch('/admin/system-status/incidents').catch(() => ({ incidents: [] })),
    ]).then(([s, inc]) => {
      const st = s.systemStatus || s;
      setComponents(st.components || {});
      setIncidents(inc.incidents || inc || []);
      setLoading(false);
    }).catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateComponent = async (key, value) => {
    setComponents(c => ({ ...c, [key]: value }));
    try {
      await adminFetch('/admin/system-status', { method: 'PUT', body: { components: { ...components, [key]: value } } });
      showToast(`${SERVICES.find(s => s.key === key)?.label} updated`);
    } catch (e) {
      showToast(e.message, 'error');
      load();
    }
  };

  const saveIncident = async e => {
    e.preventDefault(); setIncSaving(true);
    try {
      if (incModal === 'create') {
        await adminFetch('/admin/system-status/incidents', { method: 'POST', body: incForm });
      } else {
        await adminFetch(`/admin/system-status/${incModal.id}`, { method: 'PUT', body: incForm });
      }
      setIncModal(null);
      showToast(incModal === 'create' ? 'Incident created' : 'Incident updated');
      load();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setIncSaving(false); }
  };

  const sf = (k, v) => setIncForm(f => ({ ...f, [k]: v }));

  const overallOk = Object.values(components).every(v => v === 'operational' || !v);

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;

  return (
    <div>
      <Toast toast={toast} />

      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">System Status</h1>
          <p className="admin-page-subtitle" style={{ color: overallOk ? '#43a047' : '#e53935', fontWeight: 600 }}>
            {overallOk ? '✓ All systems operational' : '⚠ Some systems need attention'}
          </p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => { setIncForm(EMPTY_INCIDENT); setIncModal('create'); }}>
          + Add Incident
        </button>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      {/* Services table */}
      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div className="admin-card-title">Services</div>
        <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="admin-table">
            <thead>
              <tr><th>Service</th><th>Description</th><th>Status</th><th>Last Updated</th></tr>
            </thead>
            <tbody>
              {SERVICES.map(svc => {
                const val   = components[svc.key] || 'operational';
                const label = STATUS_OPTIONS.find(o => o.value === val)?.label || val;
                return (
                  <tr key={svc.key}>
                    <td style={{ fontWeight: 700 }}>{svc.label}</td>
                    <td style={{ color: '#6c757d', fontSize: 13 }}>{svc.description}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StatusDot status={val} />
                        <select
                          className="admin-filter-select"
                          value={val}
                          onChange={e => updateComponent(svc.key, e.target.value)}
                          style={{ fontSize: 13, padding: '5px 8px' }}
                        >
                          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#6c757d' }}>just now</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past Incidents */}
      <div className="admin-card">
        <div className="admin-card-title">Past Incidents</div>
        <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Title</th><th>Status</th><th>Description</th><th></th></tr>
            </thead>
            <tbody>
              {incidents.length === 0
                ? <tr><td colSpan={5} className="admin-table-empty">No incidents recorded</td></tr>
                : incidents.map(inc => (
                  <tr key={inc.id}>
                    <td style={{ fontSize: 12, color: '#6c757d', whiteSpace: 'nowrap' }}>
                      {inc.dateLabel || new Date(inc.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{inc.title}</td>
                    <td>
                      <span className="admin-badge" style={{
                        background: inc.status === 'resolved'
                          ? 'rgba(67,160,71,.12)' : 'rgba(255,152,0,.12)',
                        color: inc.status === 'resolved' ? '#43a047' : '#ff9800',
                      }}>
                        {inc.status}
                      </span>
                    </td>
                    <td style={{ color: '#6c757d', fontSize: 13, maxWidth: 280 }}>
                      {(inc.description || '').slice(0, 100)}{(inc.description || '').length > 100 ? '…' : ''}
                    </td>
                    <td>
                      <button className="admin-btn admin-btn-secondary admin-btn-sm"
                        onClick={() => {
                          setIncForm({ dateLabel: inc.dateLabel || '', title: inc.title, status: inc.status, description: inc.description || '' });
                          setIncModal(inc);
                        }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Incident modal */}
      {incModal && (
        <div className="admin-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setIncModal(null); }}>
          <div className="admin-modal" style={{ maxWidth: 520 }}>
            <div className="admin-modal-title">{incModal === 'create' ? 'New Incident' : 'Update Incident'}</div>
            <form onSubmit={saveIncident}>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-label">Date label</label>
                  <input className="admin-input" value={incForm.dateLabel} onChange={e => sf('dateLabel', e.target.value)} placeholder="e.g. June 10, 2026" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-label">Status</label>
                  <select className="admin-select" value={incForm.status} onChange={e => sf('status', e.target.value)}>
                    {INCIDENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Title *</label>
                <input className="admin-input" value={incForm.title} onChange={e => sf('title', e.target.value)} required />
              </div>
              <div className="admin-form-group">
                <label className="admin-label">Description</label>
                <textarea className="admin-textarea" rows={4} value={incForm.description} onChange={e => sf('description', e.target.value)} />
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setIncModal(null)}>Cancel</button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={incSaving}>{incSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
