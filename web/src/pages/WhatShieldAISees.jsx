import { useEffect, useState } from 'react';
import { getNotice } from '../api.js';

// 4.3: persistent, always-visible page — not a one-time install-time
// click-through. Same notice text/version as the extension's onboarding step.
export default function WhatShieldAISees() {
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getNotice().then(setNotice).catch((e) => setError(e.message));
  }, []);

  if (error) return <p>Error: {error}</p>;
  if (!notice) return <p>Loading…</p>;

  return (
    <div>
      <h2>What ShieldAI Sees About You</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: 16, borderRadius: 8 }}>
        {notice.text}
      </pre>
      <p><small>Notice version: {notice.version}</small></p>
    </div>
  );
}
