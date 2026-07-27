import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

// 2.6: each queue item shows its top-3 contributing features in plain
// language — this is what actually builds admin trust in the ML layer.
export default function UnverifiedToolsQueue({ orgId }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    if (!orgId) return;
    fetch(`${API_BASE}/tools/unverified?org_id=${orgId}`)
      .then((r) => r.json())
      .then(setItems)
      .catch((e) => setError(e.message));
  };

  useEffect(load, [orgId]);

  const review = (id, review_status) => {
    fetch(`${API_BASE}/tools/unverified/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_status }),
    })
      .then((r) => r.json())
      .then(load)
      .catch((e) => setError(e.message));
  };

  if (!orgId) return <p>Enter an org ID to load the review queue.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!items) return <p>Loading…</p>;
  if (!items.length) return <p>No unverified tools queued.</p>;

  return (
    <div>
      <h2>Unverified Tools</h2>
      {items.map((item) => (
        <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong>{item.domain}</strong> — confidence {item.ml_confidence} ({item.default_action})
          <p><small>Seen {item.times_seen}× since {new Date(item.first_seen_at).toLocaleDateString()}</small></p>
          {item.explanation.length > 0 && (
            <p>Flagged because: {item.explanation.join('; ')}.</p>
          )}
          {item.review_status === 'pending' ? (
            <>
              <button onClick={() => review(item.id, 'confirmed_ai')}>Confirm AI tool</button>{' '}
              <button onClick={() => review(item.id, 'dismissed')}>Dismiss</button>
            </>
          ) : (
            <p><small>Reviewed: {item.review_status}</small></p>
          )}
        </div>
      ))}
    </div>
  );
}
