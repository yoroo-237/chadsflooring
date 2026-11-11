import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';

const FILTERS = [['', 'All'], ['pending', 'Waiting'], ['manual', 'Send by hand'], ['refunded', 'Sent'], ['rejected', 'Kept in wallet']];

// Refunds of orders paid straight in crypto: a payment after the 30 minutes, a short
// payment on an order that expired or was cancelled, a surplus. The amount already left
// the customer's wallet balance. Approve sends it from the deposit address (XMR is sent
// by hand from the shop's wallet, then marked as sent); "Keep in wallet" credits it back.
export default function AdminRefunds() {
  const [status, setStatus]   = useState('pending');
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(null);
  const [msg, setMsg]         = useState(null);
  const [addr, setAddr]       = useState({});
  const [tx, setTx]           = useState({});

  const load = useCallback(() => {
    setLoading(true);
    adminFetch(`/admin/refunds${status ? `?status=${status}` : ''}`)
      .then(d => setRows(d.refunds || []))
      .catch(e => setMsg({ error: true, text: e.message }))
      .finally(() => setLoading(false));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  async function act(id, path, body, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(id); setMsg(null);
    try {
      const r = await adminFetch(`/admin/refunds/${id}/${path}`, { method: 'POST', body: body || {} });
      setMsg({ text: r.status === 'refunded' ? `Refund #${id} sent${r.txHash ? `: ${r.txHash}` : ''}.`
        : r.status === 'manual' ? `Refund #${id}: send ${r.amount} XMR by hand to ${r.address}, then mark it as sent.`
        : `Refund #${id} kept in the customer's wallet.` });
      load();
    } catch (e) {
      setMsg({ error: true, text: e.message });
      load();
    } finally { setBusy(null); }
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Refunds</h1>
          <p className="admin-page-subtitle">Late, short or surplus payments of orders paid straight in crypto.</p>
        </div>
      </div>

      <div className="admin-filters">
        <select className="admin-filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {msg && <div style={{ color: msg.error ? '#e53935' : '#2e7d32', margin: '0 0 12px', wordBreak: 'break-all' }}>{msg.text}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>#</th><th>Customer</th><th>Order</th><th>Amount</th><th>Reason</th><th>Refund address</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="admin-table-empty">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="admin-table-empty">No refunds here.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.user ? <Link to={`/mario-dashboard/users/${r.user.id}`}>{r.user.username}</Link> : r.userId}</td>
                <td>{r.orderId ? <Link to={`/mario-dashboard/orders/${r.orderId}`}>#{r.orderId}</Link> : '—'}</td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{Number(r.amount)} {r.currency}</td>
                <td style={{ maxWidth: 200 }}>{r.reason}{r.error && <div style={{ color: '#e53935', fontSize: 12 }}>{r.error}</div>}</td>
                <td style={{ maxWidth: 240, wordBreak: 'break-all', fontSize: 12 }}>
                  {r.status === 'pending' && !r.address ? (
                    <input className="admin-input" placeholder={`${r.currency} address`} value={addr[r.id] || ''} onChange={e => setAddr(a => ({ ...a, [r.id]: e.target.value }))} />
                  ) : (r.address || '—')}
                  {r.txHash && <div style={{ color: '#6c757d' }}>tx {r.txHash}</div>}
                </td>
                <td><StatusBadge status={r.status} label={FILTERS.find(f => f[0] === r.status)?.[1] || r.status} /></td>
                <td>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy === r.id || (!r.address && !addr[r.id]?.trim())}
                        onClick={() => act(r.id, 'approve', { address: r.address ? undefined : addr[r.id].trim() }, `Send ${Number(r.amount)} ${r.currency} to ${r.address || addr[r.id].trim()}? The network fee is taken from it.`)}>
                        {busy === r.id ? 'Sending…' : r.currency === 'XMR' ? 'Approve' : 'Approve and send'}
                      </button>
                      <button className="admin-btn admin-btn-sm" disabled={busy === r.id}
                        onClick={() => act(r.id, 'keep', null, `Keep ${Number(r.amount)} ${r.currency} in the customer's wallet balance instead?`)}>Keep in wallet</button>
                    </div>
                  )}
                  {r.status === 'manual' && (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <input className="admin-input" placeholder="Transaction ID" value={tx[r.id] || ''} onChange={e => setTx(t => ({ ...t, [r.id]: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="admin-btn admin-btn-primary admin-btn-sm" disabled={busy === r.id} onClick={() => act(r.id, 'sent', { txHash: tx[r.id] || '' })}>Mark as sent</button>
                        <button className="admin-btn admin-btn-sm" disabled={busy === r.id} onClick={() => act(r.id, 'keep', null, 'Keep it in the customer\'s wallet balance instead?')}>Keep in wallet</button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
