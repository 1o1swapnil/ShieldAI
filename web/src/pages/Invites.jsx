import { useState } from 'react';
import { inviteUser } from '../api.js';

// No invite history/list here — invites are stateless tickets (see
// server/src/routes/invites.js), so there's nothing server-side to list.
export default function Invites({ orgId }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    inviteUser(orgId, email, role)
      .then(() => {
        setMessage(`Invite sent to ${email}.`);
        setEmail('');
      })
      .catch((err) => setError(err.message));
  };

  return (
    <div>
      <h2>Invite a teammate</h2>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="employee">Employee</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit">Send invite</button>
      </form>
      {message && <p style={{ color: '#2a2' }}>{message}</p>}
      {error && <p style={{ color: '#a33' }}>{error}</p>}
    </div>
  );
}
