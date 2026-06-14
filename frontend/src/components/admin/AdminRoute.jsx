import React, { useState, useCallback, useEffect } from 'react';
import { decodeToken, API_BASE } from '../../pages/admin/utils/api';
import '../../pages/admin/admin.css';

function LoginForm({ onSuccess }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState(null);

  const handle = async e => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Login failed.');
      if (json.data.user?.role !== 'admin') throw new Error('Admin access required.');
      localStorage.setItem('token', json.data.token);
      onSuccess();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <div className="admin-login-logo">🌿 Canna Express</div>
        <div className="admin-login-sub">Admin dashboard — sign in to continue</div>
        <form onSubmit={handle}>
          <div className="admin-form-group">
            <label className="admin-label">Email</label>
            <input className="admin-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Password</label>
            <input className="admin-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {err && <div style={{ color:'#e53935', fontSize:13, marginBottom:12 }}>{err}</div>}
          <button className="admin-btn admin-btn-primary" style={{ width:'100%', justifyContent:'center', padding:'10px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminRoute({ children }) {
  const [status, setStatus] = useState('checking'); // checking | login | forbidden | ok

  const check = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) { setStatus('login'); return; }
    const p = decodeToken(token);
    if (!p || (p.exp && p.exp * 1000 < Date.now())) {
      localStorage.removeItem('token');
      setStatus('login');
      return;
    }
    if (p.role !== 'admin') { setStatus('forbidden'); return; }
    setStatus('ok');
  }, []);

  useEffect(() => { check(); }, [check]);

  if (status === 'checking') {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f6f9' }}>
        <div style={{ fontSize:14, color:'#6c757d' }}>Loading…</div>
      </div>
    );
  }
  if (status === 'login')     return <LoginForm onSuccess={check} />;
  if (status === 'forbidden') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f4f6f9' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🚫</div>
        <div style={{ fontWeight:700, fontSize:18 }}>Access Denied</div>
        <div style={{ color:'#6c757d', fontSize:14 }}>You do not have admin privileges.</div>
      </div>
    </div>
  );
  return children;
}
