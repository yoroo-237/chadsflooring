import React, { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { apiCall } from '../utils/api';

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/';

  if (localStorage.getItem('token')) return <Navigate to={from} replace />;
  const [tab, setTab]             = useState('login');
  const [form, setForm]           = useState({ username: '', password: '' });
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [serverErr, setServerErr] = useState('');

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
    setServerErr('');
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username required';
    if (!form.password || form.password.length < 6) e.password = 'Password must be at least 6 characters';
    return e;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setServerErr('');
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const body = { username: form.username, password: form.password };
      const data = await apiCall(endpoint, { method: 'POST', body });
      if (data.token || data.accessToken) {
        localStorage.setItem('token', data.token || data.accessToken);
        if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
        navigate(from, { replace: true });
      } else {
        setServerErr(data.error || data.message || 'Login failed');
      }
    } catch (err) {
      setServerErr(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="main-content">
      <div className="page-container" style={{ maxWidth: 420, margin: '60px auto' }}>
        <div className="admin-card" style={{ padding: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, textAlign: 'center' }}>
            {tab === 'login' ? 'Sign In' : 'Create Account'}
          </h1>

          <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setErrors({}); setServerErr(''); }} style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--text-muted)',
              }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {serverErr && (
            <div style={{ background: 'rgba(229,57,53,.1)', color: '#e53935', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
              {serverErr}
            </div>
          )}

          <form onSubmit={submit}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Username</label>
              <input
                className={`form-input${errors.username ? ' error' : ''}`}
                value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="yourname"
                autoComplete="username"
              />
              {errors.username && <span className="form-error">{errors.username}</span>}
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Password</label>
              <input
                className={`form-input${errors.password ? ' error' : ''}`}
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••"
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
            <Link to="/" style={{ color: 'var(--accent)' }}>Continue as guest →</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
