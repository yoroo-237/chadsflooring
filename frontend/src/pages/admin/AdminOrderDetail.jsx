import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmModal from '../../components/admin/ConfirmModal';

const fmt = n => `$${Number(n).toFixed(2)}`;
const STATUSES = ['processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [order, setOrder]       = useState(state?.order || null);
  const [loading, setLoading]   = useState(!state?.order);
  const [saving, setSaving]     = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [tracking, setTracking] = useState('');
  const [confirm, setConfirm]   = useState(false);
  const [err, setErr]           = useState(null);

  useEffect(() => {
    if (!order) {
      adminFetch(`/admin/orders/${id}`)
        .then(d => { setOrder(d.order || d); setLoading(false); })
        .catch(e => { setErr(e.message); setLoading(false); });
    } else {
      setNewStatus(order.status);
      setTracking(order.trackingNumber || '');
    }
  }, [id]);

  useEffect(() => {
    if (order) {
      setNewStatus(order.status);
      setTracking(order.trackingNumber || '');
    }
  }, [order]);

  const save = async () => {
    setSaving(true); setErr(null);
    try {
      const body = {};
      if (newStatus !== order.status) body.status = newStatus;
      if (tracking !== (order.trackingNumber || '')) body.trackingNumber = tracking;
      if (!Object.keys(body).length) { setSaving(false); return; }
      const d = await adminFetch(`/admin/orders/${id}/status`, { method: 'PATCH', body });
      setOrder(prev => ({ ...prev, ...d.order, ...body }));
      setConfirm(false);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;
  if (!order)  return <div style={{ padding: 40, color: '#e53935' }}>{err || 'Order not found'}</div>;

  const items = order.items || order.OrderItem || [];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            ← Back
          </button>
          <h1 className="admin-page-title">Order #{order.orderNumber}</h1>
          <p className="admin-page-subtitle">{new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        {/* Customer */}
        <div className="admin-card">
          <div className="admin-card-title">Customer</div>
          <div className="admin-info-list">
            <div className="admin-info-row"><span className="admin-info-label">Name</span><span className="admin-info-value">{order.user?.username || '—'}</span></div>
            <div className="admin-info-row"><span className="admin-info-label">Email</span><span className="admin-info-value">{order.user?.email || '—'}</span></div>
          </div>
        </div>

        {/* Update status */}
        <div className="admin-card">
          <div className="admin-card-title">Update Order</div>
          <div className="admin-form-group">
            <label className="admin-label">Status</label>
            <select className="admin-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="admin-form-group admin-mb-0">
            <label className="admin-label">Tracking Number</label>
            <input className="admin-input" value={tracking} onChange={e => setTracking(e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn-primary" onClick={() => setConfirm(true)} disabled={saving}>
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div className="admin-card-title">Order Items</div>
        <div className="admin-table-wrap" style={{ boxShadow: 'none' }}>
          <table className="admin-table">
            <thead><tr><th>Product</th><th>Option</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
            <tbody>
              {items.length === 0
                ? <tr><td colSpan={5} className="admin-table-empty">No items</td></tr>
                : items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.productName || item.product?.name || '—'}</td>
                    <td style={{ color: '#6c757d' }}>{item.optionLabel || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{fmt(item.unitPrice)}</td>
                    <td>{fmt(item.quantity * item.unitPrice)}</td>
                  </tr>
                ))
              }
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{fmt(order.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipping */}
      {order.shippingAddress && (
        <div className="admin-card">
          <div className="admin-card-title">Shipping Address</div>
          <div className="admin-info-list">
            {Object.entries(order.shippingAddress).map(([k, v]) => (
              <div className="admin-info-row" key={k}>
                <span className="admin-info-label">{k}</span>
                <span className="admin-info-value">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title="Update order?"
          message={`Change status to "${newStatus}"${tracking ? ` with tracking "${tracking}"` : ''}?`}
          confirmLabel="Update"
          loading={saving}
          onConfirm={save}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
