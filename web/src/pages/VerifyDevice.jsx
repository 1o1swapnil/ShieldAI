import { useEffect, useState } from 'react';
import { verifyDevice } from '../api.js';

// Landing page for the device-verification email link. No session is
// established here — the actual device token goes back to the extension,
// which is polling GET /extension/device-status in the background.
export default function VerifyDevice({ ticket }) {
  const [status, setStatus] = useState('verifying');

  useEffect(() => {
    verifyDevice(ticket)
      .then(() => setStatus('verified'))
      .catch(() => setStatus('error'));
  }, [ticket]);

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
      <h1>ShieldAI</h1>
      {status === 'verifying' && <p>Verifying…</p>}
      {status === 'verified' && <p>Email verified. Return to your browser extension tab to finish setup.</p>}
      {status === 'error' && <p style={{ color: '#a33' }}>This verification link is invalid or has expired.</p>}
    </div>
  );
}
