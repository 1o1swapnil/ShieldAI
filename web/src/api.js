const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function json(res) {
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const getNotice = () => fetch(`${API_BASE}/consent/notice`).then(json);

export const getSettings = (orgId) =>
  fetch(`${API_BASE}/org/${orgId}/settings`).then(json);

export const updateSettings = (orgId, patch) =>
  fetch(`${API_BASE}/org/${orgId}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(json);

export const getSecuritySummary = () => fetch(`${API_BASE}/org/security-summary`).then(json);

export const getExtensionVersions = (orgId) =>
  fetch(`${API_BASE}/org/${orgId}/extension-versions`).then(json);

export const getCoverageMap = (orgId) => fetch(`${API_BASE}/org/${orgId}/coverage-map`).then(json);

export const getDiscoveredIntegrations = (orgId) =>
  fetch(`${API_BASE}/integrations/discovered?org_id=${orgId}`).then(json);

export const reviewDiscoveredIntegration = (id, status) =>
  fetch(`${API_BASE}/integrations/discovered/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then(json);
