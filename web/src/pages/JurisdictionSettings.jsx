import { useEffect, useState } from 'react';
import { getSettings, updateSettings } from '../api.js';

const KNOWN_JURISDICTIONS = ['EU-DE', 'US-CT', 'US-DE', 'US-NY'];

export default function JurisdictionSettings({ orgId }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    getSettings(orgId).then(setSettings).catch((e) => setError(e.message));
  }, [orgId]);

  if (!orgId) return <p>Enter an org ID to load settings.</p>;
  if (error) return <p>Error: {error}</p>;
  if (!settings) return <p>Loading…</p>;

  const toggleJurisdiction = (code) => {
    const jurisdictions = settings.jurisdictions.includes(code)
      ? settings.jurisdictions.filter((j) => j !== code)
      : [...settings.jurisdictions, code];
    updateSettings(orgId, { jurisdictions }).then(setSettings).catch((e) => setError(e.message));
  };

  const toggleGatedFeature = (field) => {
    updateSettings(orgId, { [field]: !settings[field] })
      .then(setSettings)
      .catch((e) => setError(e.message));
  };

  return (
    <div>
      <h2>Jurisdiction Configuration</h2>
      <p>Select the jurisdictions your workforce is in.</p>
      {KNOWN_JURISDICTIONS.map((code) => (
        <label key={code} style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={settings.jurisdictions.includes(code)}
            onChange={() => toggleJurisdiction(code)}
          />
          {' '}{code}
        </label>
      ))}

      <h3>Compliance checklist</h3>
      {settings.checklist.map((entry) => (
        <div key={entry.jurisdiction}>
          <strong>{entry.jurisdiction}</strong>
          <ul>
            {entry.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ))}

      <h3>Gated features</h3>
      {!settings.notice_configured && (
        <p style={{ color: '#a33' }}>
          Select at least one jurisdiction before enabling these.
        </p>
      )}
      <label style={{ display: 'block' }}>
        <input
          type="checkbox"
          checked={settings.incognito_monitoring_enabled}
          disabled={!settings.notice_configured}
          onChange={() => toggleGatedFeature('incognito_monitoring_enabled')}
        />
        {' '}Incognito-mode monitoring
      </label>
      <label style={{ display: 'block' }}>
        <input
          type="checkbox"
          checked={settings.native_app_companion_enabled}
          disabled={!settings.notice_configured}
          onChange={() => toggleGatedFeature('native_app_companion_enabled')}
        />
        {' '}Native-app companion
      </label>
    </div>
  );
}
