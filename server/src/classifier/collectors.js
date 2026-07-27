// Real network lookups for the two features that must NOT touch page
// content (privacy constraint, Section 11): TLS cert metadata and domain
// registration age. Page title is deliberately not collected here — it's a
// content-script, single-DOM-read value supplied by the caller.
const tls = require('node:tls');

function getTlsCertIssuerOrg(domain, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert && cert.issuer ? cert.issuer.O || null : null);
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('tls connect timed out'));
    });
    socket.on('error', reject);
  });
}

async function getDomainAgeDays(domain) {
  const res = await fetch(`https://rdap.org/domain/${domain}`);
  if (!res.ok) throw new Error(`RDAP lookup failed: ${res.status}`);
  const data = await res.json();
  const registration = (data.events || []).find((e) => e.eventAction === 'registration');
  if (!registration) return null;
  const ms = Date.now() - new Date(registration.eventDate).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

module.exports = { getTlsCertIssuerOrg, getDomainAgeDays };
