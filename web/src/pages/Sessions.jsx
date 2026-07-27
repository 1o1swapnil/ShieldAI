import { useEffect, useState } from 'react';
import { getMySessions, revokeMySession, getOrgSessions, revokeOrgSession } from '../api.js';

// Self-service session management for everyone, plus org-wide oversight
// for admins — the incident-response path for a stolen laptop / leaked
// token that doesn't depend on the compromised account's own cooperation.
export default function Sessions({ orgId, isAdmin, currentSessionId }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    const fetcher = isAdmin ? getOrgSessions(orgId) : getMySessions();
    fetcher.then(setSessions).catch((e) => setError(e.message));
  };

  useEffect(load, [orgId, isAdmin]);

  const revoke = (id) => {
    const action = isAdmin ? revokeOrgSession(orgId, id) : revokeMySession(id);
    action.then(load).catch((e) => setError(e.message));
  };

  if (error) return <p>Error: {error}</p>;
  if (!sessions) return <p>Loading…</p>;

  return (
    <div>
      <h2>{isAdmin ? 'Org Sessions' : 'My Sessions'}</h2>
      {sessions.length === 0 && <p>No active sessions.</p>}
      {sessions.map((s) => {
        const isCurrent = isAdmin ? s.id === currentSessionId : s.current;
        return (
          <div key={s.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <div>
              {isAdmin && <strong>{s.email} </strong>}
              {isCurrent && <span style={{ color: '#2a7' }}>(this session)</span>}
              {s.revoked_at && <span style={{ color: '#a33' }}> (revoked)</span>}
            </div>
            <small>
              Started {new Date(s.created_at).toLocaleString()} · last seen {new Date(s.last_seen_at).toLocaleString()}
            </small>
            {!s.revoked_at && (
              <div>
                <button onClick={() => revoke(s.id)}>Revoke</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
