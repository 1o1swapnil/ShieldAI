import { useEffect, useState } from 'react';
import { getActivitySummary } from '../api.js';

// Section 8: real per-tool usage rollup, fed by the extension's content
// script via POST /activity/events.
export default function ActivitySummary({ orgId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    getActivitySummary(orgId).then(setRows).catch((e) => setError(e.message));
  }, [orgId]);

  if (!orgId) return <p>Enter an org ID to load activity.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!rows) return <p>Loading…</p>;
  if (!rows.length) return <p>No activity logged yet.</p>;

  return (
    <div>
      <h2>Activity Summary</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Domain</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Tool</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Events</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Distinct users</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.domain}>
              <td style={{ padding: '6px 8px 6px 0' }}>{row.domain}</td>
              <td style={{ padding: '6px 8px' }}>{row.tool_name || <em>unclassified</em>}</td>
              <td style={{ padding: '6px 8px' }}>{row.event_count}</td>
              <td style={{ padding: '6px 8px' }}>{row.distinct_users}</td>
              <td style={{ padding: '6px 8px' }}>{new Date(row.last_seen_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
