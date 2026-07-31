import { useEffect, useState } from 'react';
import { getAuditLog } from '../api.js';

// One place to look for every admin action that grants, revokes, or
// reviews something on another user's behalf (install tokens, devices,
// sessions, unverified-tool review, discovered-integration review,
// invites) instead of reconstructing it from reviewed_by/revoked_at
// columns scattered across each table.
export default function AuditLog({ orgId }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    getAuditLog(orgId).then(setEntries).catch((e) => setError(e.message));
  }, [orgId]);

  if (!orgId) return <p>Enter an org ID to view the audit log.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!entries) return <p>Loading…</p>;

  return (
    <div>
      <h2>Audit Log</h2>
      {entries.length === 0 && <p>No admin actions logged yet.</p>}
      {entries.map((e) => (
        <div key={e.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div>
            <strong>{e.action}</strong> — {e.target_type}
            {e.target_id && <code> {e.target_id}</code>}
          </div>
          <small>
            {e.actor_email || <em>unknown actor</em>} · {new Date(e.created_at).toLocaleString()}
          </small>
          {e.metadata && (
            <pre style={{ margin: '4px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(e.metadata)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
