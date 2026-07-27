import { useEffect, useState } from 'react';
import JurisdictionSettings from './pages/JurisdictionSettings.jsx';
import WhatShieldAISees from './pages/WhatShieldAISees.jsx';
import TrustSecurity from './pages/TrustSecurity.jsx';
import UnverifiedToolsQueue from './pages/UnverifiedToolsQueue.jsx';
import CoverageMap from './pages/CoverageMap.jsx';
import DiscoveredIntegrations from './pages/DiscoveredIntegrations.jsx';
import ActivitySummary from './pages/ActivitySummary.jsx';
import ToolLibrary from './pages/ToolLibrary.jsx';
import Devices from './pages/Devices.jsx';
import Login from './pages/Login.jsx';
import { getMe } from './api.js';
import { getToken, setToken, clearToken } from './auth.js';

export default function App() {
  const [tab, setTab] = useState('admin');
  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const refreshUser = () => {
    getMe()
      .then(({ user: u }) => setUser(u))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setCheckedAuth(true));
  };

  useEffect(() => {
    // Picks up the JWT an SSO callback redirect appended (?token=...).
    const params = new URLSearchParams(window.location.search);
    const tokenFromSso = params.get('token');
    if (tokenFromSso) {
      setToken(tokenFromSso);
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (getToken()) refreshUser();
    else setCheckedAuth(true);
  }, []);

  if (!checkedAuth) return null;
  if (!user) return <Login onAuthenticated={refreshUser} />;

  const orgId = user.orgId;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span><strong>{user.role}</strong> · org {orgId}</span>
        <button
          onClick={() => {
            clearToken();
            setUser(null);
          }}
        >
          Log out
        </button>
      </div>

      <nav style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('admin')} disabled={tab === 'admin'}>Admin Settings</button>
        <button onClick={() => setTab('coverage')} disabled={tab === 'coverage'}>Coverage Map</button>
        <button onClick={() => setTab('activity')} disabled={tab === 'activity'}>Activity Summary</button>
        <button onClick={() => setTab('unverified')} disabled={tab === 'unverified'}>Unverified Tools</button>
        <button onClick={() => setTab('library')} disabled={tab === 'library'}>Tool Library</button>
        <button onClick={() => setTab('devices')} disabled={tab === 'devices'}>Devices</button>
        <button onClick={() => setTab('integrations')} disabled={tab === 'integrations'}>Discovered Integrations</button>
        <button onClick={() => setTab('employee')} disabled={tab === 'employee'}>What ShieldAI Sees</button>
        <button onClick={() => setTab('trust')} disabled={tab === 'trust'}>Trust & Security</button>
      </nav>

      {tab === 'admin' && <JurisdictionSettings orgId={orgId} />}
      {tab === 'coverage' && <CoverageMap orgId={orgId} />}
      {tab === 'activity' && <ActivitySummary orgId={orgId} />}
      {tab === 'unverified' && <UnverifiedToolsQueue orgId={orgId} />}
      {tab === 'library' && <ToolLibrary />}
      {tab === 'devices' && <Devices orgId={orgId} />}
      {tab === 'integrations' && <DiscoveredIntegrations orgId={orgId} />}
      {tab === 'employee' && <WhatShieldAISees />}
      {tab === 'trust' && <TrustSecurity />}
    </div>
  );
}
