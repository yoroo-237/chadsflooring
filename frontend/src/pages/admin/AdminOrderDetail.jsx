import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';
import ConfirmModal from '../../components/admin/ConfirmModal';
import { decryptWith } from '../../utils/pgp';

// A PGP-encrypted delivery address, read here with the private key file and its
// passphrase. Everything happens in this browser: the key and the address are never sent.
function EncryptedAddress({ message }) {
  const [open, setOpen] = useState(false);
  const [keyText, setKeyText] = useState('');
  const [pass, setPass] = useState('');
  const [plain, setPlain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true); setErr('');
    try { setPlain(await decryptWith(keyText, pass, message)); }
    catch (e) { setErr(/passphrase|decrypt/i.test(e.message) ? 'Wrong passphrase, or this address was encrypted to another key.' : e.message); }
    finally { setBusy(false); }
  }
  const readFile = file => file && file.text().then(setKeyText);

  if (plain) {
    return (
      <span style={{ whiteSpace: 'pre-line' }}>{plain}<br />
        <button type="button" className="admin-btn admin-btn-sm" style={{ marginTop: 6 }} onClick={() => { setPlain(''); setPass(''); }}>Hide</button>
      </span>
    );
  }
  return (
    <span style={{ display: 'grid', gap: 6 }}>
      <span>PGP encrypted address</span>
      {!open ? (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setOpen(true)}>Decrypt</button>
          <button type="button" className="admin-btn admin-btn-sm" onClick={() => navigator.clipboard?.writeText(message)}>Copy the message</button>
        </span>
      ) : (
        <span style={{ display: 'grid', gap: 6, maxWidth: 420 }}>
          <span style={{ color: '#6c757d', fontSize: 13 }}>Your private key file (shop-pgp-private-key.asc) and its passphrase. Read in this browser only.</span>
          <input type="file" accept=".asc,.txt,.key,.gpg" onChange={e => readFile(e.target.files?.[0])} />
          {keyText && <span style={{ color: '#6c757d', fontSize: 13 }}>Key loaded.</span>}
          <input className="admin-input" type="password" autoComplete="off" placeholder="Passphrase" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && keyText && run()} />
          {err && <span style={{ color: '#e53935', fontSize: 13 }}>{err}</span>}
          <span style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="admin-btn admin-btn-primary admin-btn-sm" disabled={!keyText || busy} onClick={run}>{busy ? 'Decrypting…' : 'Decrypt'}</button>
            <button type="button" className="admin-btn admin-btn-sm" onClick={() => { setOpen(false); setKeyText(''); setPass(''); setErr(''); }}>Cancel</button>
          </span>
        </span>
      )}
    </span>
  );
}

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
    adminFetch(`/admin/orders/${id}`)
      .then(d => { setOrder(d.order || d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
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

  const items = order.items || [];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            ← Back
          </button>
          <h1 className="admin-page-title">Order #{order.frontendId || order.id}</h1>
          <p className="admin-page-subtitle">{new Date(order.placedAt).toLocaleString()}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-grid-2" style={{ marginBottom: 20 }}>
        {/* Customer */}
        <div className="admin-card">
          <div className="admin-card-title">Customer</div>
          <div className="admin-info-list">
            <div className="admin-info-row"><span className="admin-info-label">Username</span><span className="admin-info-value">{order.user?.username || '—'}</span></div>
            <div className="admin-info-row"><span className="admin-info-label">Delivery</span><span className="admin-info-value">
              {!order.shipAddress ? 'None (arrange it on Telegram)'
                : order.shipName === 'PGP encrypted' ? <EncryptedAddress message={order.shipAddress} />
                : <>{order.shipName}<br />{order.shipAddress}</>}
            </span></div>
            <div className="admin-info-row"><span className="admin-info-label">Payment</span><span className="admin-info-value">
              {String(order.paymentMethod || '').startsWith('crypto:') ? `Paid in ${order.paymentMethod.slice(7)} to its own address` : 'Wallet balance'}
              {(Array.isArray(order.payments) ? order.payments : []).map((p, i) => <div key={i} style={{ color: '#6c757d', fontSize: 13 }}>{p.amount} {p.currency} @ ${p.rate}</div>)}
            </span></div>
            <div className="admin-info-row"><span className="admin-info-label">Refund address</span><span className="admin-info-value" style={{ wordBreak: 'break-all' }}>
              {order.refundAddress ? `${order.refundCurrency || ''} ${order.refundAddress}` : 'None'}
            </span></div>
          </div>
        </div>

        {/* Update status */}
        <div className="admin-card">
          <div className="admin-card-title">Update Order</div>
          <div className="admin-form-group">
            <label className="admin-label">Status</label>
            <select className="admin-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              {(order.status === 'awaiting_payment' ? ['awaiting_payment', 'cancelled'] : STATUSES).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
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
                    <td>{item.productName || '—'}</td>
                    <td style={{ color: '#6c757d' }}>{item.optionLabel || '—'}</td>
                    <td>{item.quantity}</td>
                    <td>{fmt(item.unitPrice)}</td>
                    <td>{fmt(item.lineTotal)}</td>
                  </tr>
                ))
              }
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{fmt(order.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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
