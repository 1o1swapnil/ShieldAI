import { useState } from 'react';
import { acceptInvite } from '../api.js';
import { setToken } from '../auth.js';

// Landing page for an admin-issued invite link (?invite_ticket=...). Same
// "click IS the login" pattern as ResetPassword: setting a password
// completes account creation and logs the user in in one step.
export default function AcceptInvite({ ticket, onComplete }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await acceptInvite(ticket, password);
      setToken(result.token);
      onComplete();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>ShieldAI</h1>
      <h2>Set a password to join</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Set password &amp; continue</button>
      </form>
      {error && <p style={{ color: '#a33' }}>{error}</p>}
    </div>
  );
}
