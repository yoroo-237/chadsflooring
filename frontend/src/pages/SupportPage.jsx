import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import AccountSidebar from '../components/AccountSidebar';
import { api } from '../utils/api';

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

const CATEGORIES = ['General', 'Order Issue', 'Payment', 'Shipping', 'Product Question', 'Account', 'Technical', 'Other'];

export default function SupportPage() {
  const { showToast } = useApp();
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', category: 'General', message: '' });
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/support/tickets').then(d => setTickets(d.tickets || d || [])).catch(() => {});
  }, []);

  const validate = () => {
    const e = {};
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (form.message.trim().length < 10) e.message = 'Please provide more detail';
    return e;
  };

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(er => ({ ...er, [name]: '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSending(true);
    try {
      const data = await api.post('/support/tickets', {
        subject: form.subject, category: form.category, message: form.message,
      });
      const ticket = data.ticket || data;
      setTickets(prev => [ticket, ...prev]);
      setShowForm(false);
      setForm({ subject: '', category: 'General', message: '' });
      showToast('Support ticket submitted!', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to submit ticket', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
          <div className="support-page-header">
            <h3 className="account-page-title">Support</h3>
            <button
              className="btn-primary support-get-btn"
              onClick={() => setShowForm(v => !v)}
            >
              {showForm ? <><XIcon /> Cancel</> : <>Get Support</>}
            </button>
          </div>

          {showForm && (
            <div className="support-form-card">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" name="category" value={form.category} onChange={handleChange}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Subject *</label>
                  <input className={`form-input${errors.subject ? ' error' : ''}`} name="subject" value={form.subject} onChange={handleChange} placeholder="Brief description of your issue" />
                  {errors.subject && <span className="form-error">{errors.subject}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Message *</label>
                  <textarea
                    className={`form-input form-textarea${errors.message ? ' error' : ''}`}
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your issue in detail..."
                    rows={4}
                  />
                  {errors.message && <span className="form-error">{errors.message}</span>}
                </div>
                <button type="submit" className="btn-primary" disabled={sending}>
                  {sending ? 'Submitting…' : 'Submit Ticket'}
                </button>
              </form>
            </div>
          )}

          <div className="support-tickets-card">
            <div className="credits-table-wrap">
            <table className="credits-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Support ticket #</th>
                  <th>Status</th>
                  <th>Response</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr><td colSpan={5} className="credits-table-empty">No support tickets yet. Click "Get Support" to open one.</td></tr>
                ) : tickets.map(ticket => (
                  <tr key={ticket.id}>
                    <td>{ticket.type || ticket.category || '—'}</td>
                    <td className="credits-table-id">{ticket.id}</td>
                    <td><span className="credits-status-badge open">{ticket.status || 'Open'}</span></td>
                    <td><span className="credits-status-badge pending">{ticket.response || ticket.adminResponse ? 'Replied' : 'Pending'}</span></td>
                    <td>{ticket.created || (ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
