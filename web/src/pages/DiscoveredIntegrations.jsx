import { useEffect, useState } from 'react';
import { getDiscoveredIntegrations, reviewDiscoveredIntegration } from '../api.js';

// 1.4: "Sarah authorized 'OpenAI API access' via Okta" — surfaced here for
// admin review without needing network visibility.
export default function DiscoveredIntegrations({ orgId }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    if (!orgId) return;
    getDiscoveredIntegrations(orgId).then(setItems).catch((e) => setError(e.message));
  };

  useEffect(load, [orgId]);

  const review = (id, status) => {
    reviewDiscoveredIntegration(id, status).then(load).catch((e) => setError(e.message));
  };

  if (!orgId) return <p>Enter an org ID to load discovered integrations.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!items) return <p>Loading…</p>;
  if (!items.length) return <p>No integrations discovered yet.</p>;

  return (
    <div>
      <h2>Discovered Integrations</h2>
      {items.map((item) => (
        <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <strong>{item.tool_name}</strong>
          {item.matched_ai_tool_id ? ' — matched a known AI tool' : ' — no library match'}
          <p><small>{item.discovered_via}</small></p>
          {item.status === 'unreviewed' ? (
            <>
              <button onClick={() => review(item.id, 'confirmed')}>Confirm</button>{' '}
              <button onClick={() => review(item.id, 'dismissed')}>Dismiss</button>
            </>
          ) : (
            <p><small>Reviewed: {item.status}</small></p>
          )}
        </div>
      ))}
    </div>
  );
}
