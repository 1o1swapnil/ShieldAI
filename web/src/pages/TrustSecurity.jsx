import { useEffect, useState } from 'react';
import { getSecuritySummary } from '../api.js';

// 3.2: public Trust & Security page — shipped with the product instead of
// assembled ad hoc when a customer's security team asks.
export default function TrustSecurity() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSecuritySummary().then(setSummary).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Trust & Security</h2>

      <h3>Certifications</h3>
      <p>SOC 2 Type II report: in progress, not yet available.</p>
      <p>Third-party penetration test summary: available on request until published here.</p>

      <h3>What ShieldAI Can and Cannot See</h3>
      <p>
        ShieldAI provides governance-grade visibility into browser-based AI tool usage.
        It does not see API-mediated usage, self-hosted LLMs on unlisted domains, unmanaged/BYOD
        devices, or non-Chromium native apps without the optional companion. See the full Coverage Map
        (Section 1) once published.
      </p>

      <h3>Security summary</h3>
      {error && <p>Error: {error}</p>}
      {!error && !summary && <p>Loading…</p>}
      {summary && (
        <ul>
          <li>Data retention: {summary.data_retention_days} days</li>
          <li>Encryption at rest: {summary.encryption.at_rest}</li>
          <li>Encryption in transit: {summary.encryption.in_transit}</li>
          <li>
            Sub-processors: {summary.sub_processors.map((p) => `${p.name} (${p.purpose})`).join(', ')}
          </li>
        </ul>
      )}
      <p>
        <small>Machine-readable: <code>GET /org/security-summary</code></small>
      </p>
    </div>
  );
}
