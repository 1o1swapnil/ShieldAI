import { getToken } from './auth.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function json(res) {
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function authFetch(path, options = {}) {
  const token = getToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }).then(json);
}

export const register = (org_name, email, password) =>
  fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ org_name, email, password }),
  }).then(json);

export const login = (email, password) =>
  fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(json);

export const getMe = () => authFetch('/auth/me');

// Public — no auth required (Section 4.1/3.2 are meant to be readable
// without a logged-in session).
export const getNotice = () => fetch(`${API_BASE}/consent/notice`).then(json);
export const getSecuritySummary = () => fetch(`${API_BASE}/org/security-summary`).then(json);

export const getSettings = (orgId) => authFetch(`/org/${orgId}/settings`);

export const updateSettings = (orgId, patch) =>
  authFetch(`/org/${orgId}/settings`, { method: 'PATCH', body: JSON.stringify(patch) });

export const getExtensionVersions = (orgId) => authFetch(`/org/${orgId}/extension-versions`);

export const getCoverageMap = (orgId) => authFetch(`/org/${orgId}/coverage-map`);

export const getDiscoveredIntegrations = (orgId) => authFetch(`/integrations/discovered?org_id=${orgId}`);

export const reviewDiscoveredIntegration = (id, status) =>
  authFetch(`/integrations/discovered/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const getActivitySummary = (orgId) => authFetch(`/activity/summary?org_id=${orgId}`);

export const getToolLibrary = () => authFetch('/tools/library');

export const addLibraryTool = (tool) => authFetch('/tools/library', { method: 'POST', body: JSON.stringify(tool) });

export const getInstallTokens = (orgId) => authFetch(`/org/${orgId}/install-tokens`);

export const createInstallToken = (orgId, label) =>
  authFetch(`/org/${orgId}/install-tokens`, { method: 'POST', body: JSON.stringify({ label }) });

export const revokeInstallToken = (orgId, id) =>
  authFetch(`/org/${orgId}/install-tokens/${id}/revoke`, { method: 'POST' });

export const getDevices = (orgId) => authFetch(`/org/${orgId}/devices`);

export const revokeDevice = (orgId, id) => authFetch(`/org/${orgId}/devices/${id}/revoke`, { method: 'POST' });
