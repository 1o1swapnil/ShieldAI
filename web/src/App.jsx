import { useState } from 'react';
import JurisdictionSettings from './pages/JurisdictionSettings.jsx';
import WhatShieldAISees from './pages/WhatShieldAISees.jsx';
import TrustSecurity from './pages/TrustSecurity.jsx';
import UnverifiedToolsQueue from './pages/UnverifiedToolsQueue.jsx';
import CoverageMap from './pages/CoverageMap.jsx';
import DiscoveredIntegrations from './pages/DiscoveredIntegrations.jsx';

const ORG_SCOPED_TABS = ['admin', 'unverified', 'coverage', 'integrations'];

export default function App() {
  const [tab, setTab] = useState('admin');
  const [orgId, setOrgId] = useState('');

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <nav style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('admin')} disabled={tab === 'admin'}>Admin Settings</button>
        <button onClick={() => setTab('coverage')} disabled={tab === 'coverage'}>Coverage Map</button>
        <button onClick={() => setTab('unverified')} disabled={tab === 'unverified'}>Unverified Tools</button>
        <button onClick={() => setTab('integrations')} disabled={tab === 'integrations'}>Discovered Integrations</button>
        <button onClick={() => setTab('employee')} disabled={tab === 'employee'}>What ShieldAI Sees</button>
        <button onClick={() => setTab('trust')} disabled={tab === 'trust'}>Trust & Security</button>
      </nav>

      {ORG_SCOPED_TABS.includes(tab) && (
        <label>
          Org ID:{' '}
          <input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="paste an organizations.id" />
        </label>
      )}

      {tab === 'admin' && <JurisdictionSettings orgId={orgId} />}
      {tab === 'coverage' && <CoverageMap orgId={orgId} />}
      {tab === 'unverified' && <UnverifiedToolsQueue orgId={orgId} />}
      {tab === 'integrations' && <DiscoveredIntegrations orgId={orgId} />}
      {tab === 'employee' && <WhatShieldAISees />}
      {tab === 'trust' && <TrustSecurity />}
    </div>
  );
}
