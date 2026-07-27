import { useEffect, useState } from 'react';
import { getCoverageMap, updateSettings } from '../api.js';

const STATUS_LABEL = {
  covered: 'Covered',
  partial: 'Partial',
  not_covered: 'Not covered',
  manual: 'Manual',
};

const STATUS_COLOR = {
  covered: '#2a7',
  partial: '#c90',
  not_covered: '#a33',
  manual: '#888',
};

// 1.2: shipped with the product as a stated scope boundary, not discovered
// by the customer later.
export default function CoverageMap({ orgId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    if (!orgId) return;
    getCoverageMap(orgId).then(setData).catch((e) => setError(e.message));
  };

  useEffect(load, [orgId]);

  const toggleDnsProxy = () => {
    updateSettings(orgId, { dns_proxy_configured: true }).then(load).catch((e) => setError(e.message));
  };

  if (!orgId) return <p>Enter an org ID to load the coverage map.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!data) return <p>Loading…</p>;

  return (
    <div>
      <h2>Coverage Map</h2>
      <p>{data.intro}</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Channel</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Detection layer</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Requires</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.channels.map((row) => (
            <tr key={row.channel}>
              <td style={{ padding: '6px 8px 6px 0' }}>{row.channel}</td>
              <td style={{ padding: '6px 8px' }}>{row.detection_layer}</td>
              <td style={{ padding: '6px 8px' }}>{row.requires}</td>
              <td style={{ padding: '6px 0', color: STATUS_COLOR[row.status], fontWeight: 600 }}>
                {STATUS_LABEL[row.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.channels[1].status === 'not_covered' && (
        <p>
          <button onClick={toggleDnsProxy}>Mark DNS/proxy forwarding as configured</button>
        </p>
      )}
    </div>
  );
}
