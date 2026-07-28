import { useState } from 'react';
import { resetPassword } from '../api.js';
import { setToken } from '../auth.js';

// Landing page for the password-reset email link (?reset_ticket=...).
// Submitting sets the token and completes the login in one step, same
// "click IS the login" pattern as email verification.
export default function ResetPassword({ ticket, onComplete }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await resetPassword(ticket, password);
      setToken(result.token);
      onComplete();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>ShieldAI</h1>
      <h2>Choose a new password</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Set new password</button>
      </form>
      {error && <p style={{ color: '#a33' }}>{error}</p>}
    </div>
  );
}
