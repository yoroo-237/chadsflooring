import React, { useState, useEffect, useCallback } from 'react';
import AccountSidebar from '../components/AccountSidebar';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* ── Icons ── */
function TeamEmptyIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14H6L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

/* ── Skeleton row ── */
function SkeletonRow() {
  return (
    <tr>
      {[140, 80, 100, 60].map((w, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div className="skeleton" style={{ height: 14, width: w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

/* ── Status badge ── */
function StatusBadge({ status }) {
  const isActive  = status === 'active';
  const bg        = isActive ? 'rgba(67,160,71,0.15)' : 'rgba(255,152,0,0.15)';
  const color     = isActive ? '#43a047' : '#ff9800';
  return (
    <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

export default function TeamPage() {
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState(null);
  const [teamData,      setTeamData]      = useState(null);

  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviting,      setInviting]      = useState(false);
  const [inviteMsg,     setInviteMsg]     = useState(null); // { type: 'success'|'error', text }

  const [removingId,    setRemovingId]    = useState(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/team`, { headers: authHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to load team.');
      setTeamData(json.data);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeam(); }, [loadTeam]);

  const handleInvite = async e => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${API_BASE}/team/invite`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify({ email: inviteEmail.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Invite failed.');
      setInviteMsg({ type: 'success', text: `Invite sent to ${inviteEmail.trim()}.` });
      setInviteEmail('');
      loadTeam();
    } catch (err) {
      setInviteMsg({ type: 'error', text: err.message });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`${API_BASE}/team/members/${memberId}`, {
        method:  'DELETE',
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Remove failed.');
      setTeamData(prev => prev ? ({
        ...prev,
        members:      prev.members.filter(m => m.id !== memberId),
        totalMembers: prev.totalMembers - 1,
      }) : prev);
    } catch (err) {
      /* silently ignore; user can retry */
    } finally {
      setRemovingId(null);
    }
  };

  const markupPct     = teamData?.owner?.markupPct ?? 0;
  const members       = teamData?.members ?? [];
  const totalMembers  = teamData?.totalMembers ?? 0;

  return (
    <main className="main-content">
      <div className="account-layout">
        <AccountSidebar />

        <div className="account-main">
          <h3 className="account-page-title">Your Team</h3>

          {/* ── Header card ── */}
          <div className="settings-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Reseller Team</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage your reseller team members</div>
              </div>
              {!loading && !fetchError && (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{markupPct}%</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Your markup</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>{totalMembers}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Members</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Invite form ── */}
          <div className="settings-card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MailIcon />
              Invite Member
            </div>

            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="member@email.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                disabled={inviting}
                style={{
                  flex: '1 1 220px',
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input, var(--bg-card))',
                  color: 'var(--text-main)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                style={{
                  padding: '9px 22px',
                  borderRadius: 8,
                  background: inviting ? 'var(--text-muted)' : 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: inviting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </form>

            {inviteMsg && (
              <div style={{
                marginTop: 10,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: inviteMsg.type === 'success' ? 'rgba(67,160,71,0.12)' : 'rgba(229,57,53,0.12)',
                color:      inviteMsg.type === 'success' ? '#43a047' : '#e53935',
              }}>
                {inviteMsg.type === 'success' && <CheckIcon />}
                {inviteMsg.text}
              </div>
            )}
          </div>

          {/* ── Members table ── */}
          {fetchError ? (
            <div className="settings-card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 8, color: '#e53935', fontWeight: 600 }}>Failed to load team</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>{fetchError}</div>
              <button
                onClick={loadTeam}
                style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="credits-table-wrap">
              <table className="credits-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  ) : members.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="credits-table-empty">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 0' }}>
                          <TeamEmptyIcon />
                          <span>No team members yet. Send your first invite above.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    members.map(member => (
                      <tr key={member.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{member.inviteEmail}</div>
                          {member.memberUsername && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              @{member.memberUsername}
                            </div>
                          )}
                        </td>
                        <td><StatusBadge status={member.status} /></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          {member.joinedAt
                            ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '—'}
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemove(member.id)}
                            disabled={removingId === member.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 6,
                              background: removingId === member.id ? 'var(--text-muted)' : 'rgba(229,57,53,0.12)',
                              color: removingId === member.id ? '#fff' : '#e53935',
                              border: 'none',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: removingId === member.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <TrashIcon />
                            {removingId === member.id ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
