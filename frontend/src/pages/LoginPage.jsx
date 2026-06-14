import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AgeGate from '../components/AgeGate';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const { login } = useApp();

  // All hooks must come before any conditional return (Rules of Hooks)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);

  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [serverErr, setServerErr] = useState('');

  const [ageVerified, setAgeVerified] = useState(
    () => localStorage.getItem('age_verified') === 'true'
  );

  if (localStorage.getItem('token')) return <Navigate to={from} replace />;

  const handleAgeYes = () => {
    localStorage.setItem('age_verified', 'true');
    setAgeVerified(true);
  };

  const handleAgeNo = () => {
    window.location.href = 'https://www.google.com';
  };

  const validate = () => {
    const e = {};
    if (!username.trim()) e.username = 'Username required';
    if (!password || password.length < 6) e.password = 'Min 6 characters';
    return e;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setServerErr('');
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerErr(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <h1 className="login-title-muted">Welcome to our new platform</h1>

        {serverErr && (
          <div className="login-error" role="alert">{serverErr}</div>
        )}

        <form onSubmit={submit} className="login-form" noValidate>

          <div className="form-group">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className={`form-input${errors.username ? ' error' : ''}`}
              value={username}
              onChange={e => { setUsername(e.target.value); setErrors(p => ({...p, username: ''})); setServerErr(''); }}
              placeholder="Username"
              autoComplete="username"
              autoFocus
            />
            {errors.username && <span className="form-error">{errors.username}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="pw-input-wrap">
              <input
                id="login-password"
                className={`form-input${errors.password ? ' error' : ''}`}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({...p, password: ''})); setServerErr(''); }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="pw-eye-btn"
                onClick={() => setShowPw(p => !p)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <hr className="login-divider" />

          <p className="login-2fa-hint">
            If you've enabled 2FA on your account, enter your code below
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="login-token">
              {useRecovery ? 'Recovery code' : '2FA token'}
            </label>
            <div className="pw-input-wrap">
              <input
                id="login-token"
                className="form-input"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                autoComplete="one-time-code"
              />
              <button
                type="button"
                className="pw-eye-btn"
                onClick={() => setShowToken(p => !p)}
                aria-label={showToken ? 'Hide code' : 'Show code'}
              >
                {showToken ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="login-recovery-wrap">
            <button
              type="button"
              className="btn-recovery"
              onClick={() => { setUseRecovery(p => !p); setToken(''); }}
            >
              Use Recovery Code
            </button>
          </div>

          <button
            type="submit"
            className="btn-primary login-submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>

        </form>

      </div>

      {/* AgeGate en modale au-dessus du login */}
      {!ageVerified && (
        <AgeGate onYes={handleAgeYes} onNo={handleAgeNo} />
      )}
    </div>
  );
}