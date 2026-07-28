import { useState } from 'react';
import { login, register, forgotPassword } from '../api.js';
import { setToken } from '../auth.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function Login({ onAuthenticated, error: externalError }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [form, setForm] = useState({ org_name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null);
  const shownError = error || externalError;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setPendingMessage(null);
    try {
      if (mode === 'login') {
        const result = await login(form.email, form.password);
        setToken(result.token);
        onAuthenticated();
      } else if (mode === 'register') {
        const result = await register(form.org_name, form.email, form.password);
        setPendingMessage(result.message);
      } else {
        const result = await forgotPassword(form.email);
        setPendingMessage(result.message);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>ShieldAI</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode('login')} disabled={mode === 'login'}>Log in</button>
        <button onClick={() => setMode('register')} disabled={mode === 'register'}>Register org</button>
      </div>

      {pendingMessage ? (
        <p>{pendingMessage}</p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mode === 'register' && (
            <input
              placeholder="Organization name"
              value={form.org_name}
              onChange={(e) => setForm({ ...form, org_name: e.target.value })}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {mode !== 'forgot' && (
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
          <button type="submit">
            {mode === 'login' ? 'Log in' : mode === 'register' ? 'Create org + admin account' : 'Send reset link'}
          </button>
        </form>
      )}

      {mode === 'login' && !pendingMessage && (
        <p style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError(null);
            }}
            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Forgot password?
          </button>
        </p>
      )}
      {mode === 'forgot' && (
        <p style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setPendingMessage(null);
              setError(null);
            }}
            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Back to log in
          </button>
        </p>
      )}

      {shownError && <p style={{ color: '#a33' }}>{shownError}</p>}

      <p style={{ marginTop: 16 }}>
        <small>
          Or <a href={`${API_BASE}/auth/sso/login?org_id=`}>sign in with SSO</a> (append your org id — requires
          OIDC_ISSUER_URL etc. configured server-side).
        </small>
      </p>
    </div>
  );
}
