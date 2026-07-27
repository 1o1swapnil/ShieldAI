// 2.2: TLS certificate subject/org — weak signal alone (many AI startups
// front their app with the same handful of CDN/CA providers), useful
// combined with the stronger text/fingerprint signals.
const KNOWN_PROVIDERS = ['cloudflare', 'fastly', 'vercel', 'amazon'];

function certFeature(issuerOrg) {
  const knownProvider = Boolean(issuerOrg) && KNOWN_PROVIDERS.some((p) => issuerOrg.toLowerCase().includes(p));
  return { issuerOrg: issuerOrg || null, knownProvider, score: knownProvider ? 5 : 0 };
}

module.exports = { KNOWN_PROVIDERS, certFeature };
