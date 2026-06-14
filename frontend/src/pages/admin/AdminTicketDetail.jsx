import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminFetch } from './utils/api';
import StatusBadge from '../../components/admin/StatusBadge';

const STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['urgent', 'high', 'normal', 'low'];

export default function AdminTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);
  const [reply, setReply]     = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus]     = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [updating, setUpdating] = useState(false);
  const threadRef = useRef(null);

  const load = () => {
    setLoading(true);
    adminFetch(`/admin/support/${id}`)
      .then(d => {
        const t = d.ticket || d;
        setTicket(t);
        setNewStatus(t.status);
        setNewPriority(t.priority);
        setLoading(false);
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [ticket?.messages]);

  const sendReply = async e => {
    e.preventDefault(); if (!reply.trim()) return;
    setSending(true); setErr(null);
    try {
      await adminFetch(`/admin/support/${id}/messages`, { method: 'POST', body: { message: reply, isInternal } });
      setReply(''); setIsInternal(false);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  const updateTicket = async () => {
    setUpdating(true); setErr(null);
    try {
      await adminFetch(`/admin/support/${id}`, { method: 'PATCH', body: { status: newStatus, priority: newPriority } });
      load();
    } catch (e) { setErr(e.message); }
    finally { setUpdating(false); }
  };

  if (loading) return <div style={{ padding: 40, color: '#6c757d' }}>Loading…</div>;
  if (!ticket) return <div style={{ padding: 40, color: '#e53935' }}>{err || 'Ticket not found'}</div>;

  const messages = ticket.messages || [];

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>← Back</button>
          <h1 className="admin-page-title" style={{ fontSize: 18 }}>{ticket.subject}</h1>
          <p className="admin-page-subtitle">
            {ticket.user?.username || ticket.user?.email || '—'} &nbsp;·&nbsp;
            <StatusBadge status={ticket.status} /> &nbsp;·&nbsp; <StatusBadge status={ticket.priority} />
          </p>
        </div>
      </div>

      {err && <div style={{ color: '#e53935', marginBottom: 12 }}>{err}</div>}

      <div className="admin-grid-2" style={{ alignItems: 'start' }}>
        {/* Thread */}
        <div className="admin-card">
          <div className="admin-card-title">Conversation</div>
          <div className="admin-thread" ref={threadRef}>
            {messages.length === 0
              ? <div style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>No messages yet</div>
              : messages.map(m => (
                <div key={m.id} className={`admin-msg ${m.isStaff ? 'staff' : 'user'}${m.isInternal ? ' internal' : ''}`}>
                  <div className="admin-msg-meta">{m.isStaff ? (m.author?.username || 'Staff') : (ticket.user?.username || 'User')}{m.isInternal ? ' · Internal' : ''}</div>
                  <div className="admin-msg-body">{m.message}</div>
                  <div className="admin-msg-time">{new Date(m.createdAt).toLocaleString()}</div>
                </div>
              ))
            }
          </div>
          <form onSubmit={sendReply} style={{ marginTop: 16 }}>
            <textarea
              className="admin-textarea"
              rows={3}
              value={reply}
              onChange={e => setReply(e.target.value)}
              placeholder="Write a reply…"
              required
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <label className="admin-form-check">
                <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
                Internal note
              </label>
              <button type="submit" className="admin-btn admin-btn-primary" disabled={sending}>
                {sending ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
          </form>
        </div>

        {/* Ticket details */}
        <div>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-title">Update Ticket</div>
            <div className="admin-form-group">
              <label className="admin-label">Status</label>
              <select className="admin-select" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="admin-form-group admin-mb-0">
              <label className="admin-label">Priority</label>
              <select className="admin-select" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn-primary" onClick={updateTicket} disabled={updating}>
                {updating ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>

          <div className="admin-card">
            <div className="admin-card-title">Details</div>
            <div className="admin-info-list">
              <div className="admin-info-row"><span className="admin-info-label">Category</span><span className="admin-info-value">{ticket.category || '—'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Assignee</span><span className="admin-info-value">{ticket.assignee?.username || 'Unassigned'}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Created</span><span className="admin-info-value">{new Date(ticket.createdAt).toLocaleString()}</span></div>
              <div className="admin-info-row"><span className="admin-info-label">Updated</span><span className="admin-info-value">{new Date(ticket.updatedAt).toLocaleString()}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
