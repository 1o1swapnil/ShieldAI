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
import Sessions from './pages/Sessions.jsx';
import Login from './pages/Login.jsx';
import VerifyDevice from './pages/VerifyDevice.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';
import Invites from './pages/Invites.jsx';
import AuditLog from './pages/AuditLog.jsx';
import { getMe, verifyEmail, logout } from './api.js';
import { getToken, setToken, clearToken } from './auth.js';

export default function App() {
  const [tab, setTab] = useState('admin');
  const [user, setUser] = useState(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [verifyError, setVerifyError] = useState(null);
  const [deviceTicket] = useState(() => new URLSearchParams(window.location.search).get('device_ticket'));
  const [resetTicket, setResetTicket] = useState(() => new URLSearchParams(window.location.search).get('reset_ticket'));
  const [inviteTicket, setInviteTicket] = useState(() => new URLSearchParams(window.location.search).get('invite_ticket'));

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
    if (deviceTicket || resetTicket || inviteTicket) return; // handled entirely by their own components below, no session needed yet

    const params = new URLSearchParams(window.location.search);

    // Picks up the JWT an SSO callback redirect appended (?token=...).
    const tokenFromSso = params.get('token');
    if (tokenFromSso) {
      setToken(tokenFromSso);
      window.history.replaceState({}, '', window.location.pathname);
      return refreshUser();
    }

    // Email-verification link click (?ticket=...) — exchanges it for a
    // real session in one step.
    const verificationTicket = params.get('ticket');
    if (verificationTicket) {
      window.history.replaceState({}, '', window.location.pathname);
      verifyEmail(verificationTicket)
        .then((result) => {
          setToken(result.token);
          refreshUser();
        })
        .catch((err) => {
          setVerifyError(err.message);
          setCheckedAuth(true);
        });
      return;
    }

    if (getToken()) refreshUser();
    else setCheckedAuth(true);
  }, []);

  if (deviceTicket) return <VerifyDevice ticket={deviceTicket} />;
  if (inviteTicket) {
    return (
      <AcceptInvite
        ticket={inviteTicket}
        onComplete={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setInviteTicket(null);
          refreshUser();
        }}
      />
    );
  }
  if (resetTicket) {
    return (
      <ResetPassword
        ticket={resetTicket}
        onComplete={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setResetTicket(null);
          refreshUser();
        }}
      />
    );
  }
  if (!checkedAuth) return null;
  if (!user) return <Login onAuthenticated={refreshUser} error={verifyError} />;

  const orgId = user.orgId;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span><strong>{user.role}</strong> · org {orgId}</span>
        <button
          onClick={() => {
            logout()
              .catch(() => {}) // revoke best-effort; clear the local token regardless
              .finally(() => {
                clearToken();
                setUser(null);
              });
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
        <button onClick={() => setTab('invites')} disabled={tab === 'invites'}>Invites</button>
        <button onClick={() => setTab('audit')} disabled={tab === 'audit'}>Audit Log</button>
        <button onClick={() => setTab('sessions')} disabled={tab === 'sessions'}>Sessions</button>
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
      {tab === 'invites' && <Invites orgId={orgId} />}
      {tab === 'audit' && <AuditLog orgId={orgId} />}
      {tab === 'sessions' && (
        <Sessions orgId={orgId} isAdmin={user.role === 'admin'} currentSessionId={user.sid} />
      )}
      {tab === 'integrations' && <DiscoveredIntegrations orgId={orgId} />}
      {tab === 'employee' && <WhatShieldAISees />}
      {tab === 'trust' && <TrustSecurity />}
    </div>
  );
}
