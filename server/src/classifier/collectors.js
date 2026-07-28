// Real network lookups for the two features that must NOT touch page
// content (privacy constraint, Section 11): TLS cert metadata and domain
// registration age. Page title is deliberately not collected here — it's a
// content-script, single-DOM-read value supplied by the caller.
const tls = require('node:tls');
const dns = require('node:dns').promises;
const net = require('node:net');

// `domain` here is attacker-influenced (it's whatever a device token holder
// reports visiting) and gets used as the connect target — resolve it
// ourselves first and refuse private/loopback/link-local addresses so this
// can't be pointed at internal infrastructure (SSRF). Connecting to the
// address we already resolved (rather than letting tls.connect resolve
// `domain` again) also avoids a DNS-rebinding TOCTOU between the check and
// the connect.
function isPrivateOrReservedIp(ip) {
  const type = net.isIP(ip);
  if (type === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower.startsWith('::ffff:')) return isPrivateOrReservedIp(lower.slice(7));
    return lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd');
  }
  return true; // couldn't even parse it as an IP — don't connect
}

async function getTlsCertIssuerOrg(domain, timeoutMs = 3000) {
  const { address } = await dns.lookup(domain);
  if (isPrivateOrReservedIp(address)) {
    throw new Error(`refusing to connect to private/reserved address ${address}`);
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: address, port: 443, servername: domain, timeout: timeoutMs }, () => {
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

module.exports = { getTlsCertIssuerOrg, getDomainAgeDays, isPrivateOrReservedIp };
