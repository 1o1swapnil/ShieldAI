import { useEffect, useState } from 'react';
import {
  getInstallTokens,
  createInstallToken,
  revokeInstallToken,
  getDevices,
  revokeDevice,
} from '../api.js';

const EXTENSION_BASE_URL = 'chrome-extension://<your-extension-id>/notice.html';

// Section 7 gap fix: admins issue install tokens, employees exchange one
// for a device token during install, admins can revoke either.
export default function Devices({ orgId }) {
  const [tokens, setTokens] = useState(null);
  const [devices, setDevices] = useState(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState(null);

  const load = () => {
    if (!orgId) return;
    getInstallTokens(orgId).then(setTokens).catch((e) => setError(e.message));
    getDevices(orgId).then(setDevices).catch((e) => setError(e.message));
  };

  useEffect(load, [orgId]);

  const create = (e) => {
    e.preventDefault();
    createInstallToken(orgId, label || undefined)
      .then(() => {
        setLabel('');
        load();
      })
      .catch((e2) => setError(e2.message));
  };

  if (!orgId) return <p>Enter an org ID to manage install tokens and devices.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!tokens || !devices) return <p>Loading…</p>;

  return (
    <div>
      <h2>Install Tokens</h2>
      <form onSubmit={create} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Label (e.g. Engineering rollout)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit">Create install token</button>
      </form>
      {tokens.map((t) => (
        <div key={t.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div>{t.label || <em>unlabeled</em>} {t.revoked_at && <span style={{ color: '#a33' }}>(revoked)</span>}</div>
          <code style={{ wordBreak: 'break-all' }}>
            {EXTENSION_BASE_URL}?install_token={t.token}
          </code>
          {!t.revoked_at && (
            <div>
              <button onClick={() => revokeInstallToken(orgId, t.id).then(load)}>Revoke</button>
            </div>
          )}
        </div>
      ))}

      <h2>Registered Devices</h2>
      {devices.length === 0 && <p>No devices registered yet.</p>}
      {devices.map((d) => (
        <div key={d.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 8 }}>
          <div>{d.email || d.user_id} {d.revoked_at && <span style={{ color: '#a33' }}>(revoked)</span>}</div>
          <small>Last seen: {new Date(d.last_seen_at).toLocaleString()}</small>
          {!d.revoked_at && (
            <div>
              <button onClick={() => revokeDevice(orgId, d.id).then(load)}>Revoke device</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
