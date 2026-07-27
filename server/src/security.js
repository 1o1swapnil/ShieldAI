// 3.2: source of truth for GET /org/security-summary. Update when retention,
// encryption, or sub-processors actually change.
const SECURITY_SUMMARY = {
  data_retention_days: 400,
  encryption: {
    at_rest: 'AES-256',
    in_transit: 'TLS 1.2+',
  },
  sub_processors: [
    { name: 'AWS', purpose: 'hosting' },
    { name: 'Postgres (self-hosted / RDS)', purpose: 'primary data store' },
  ],
};

module.exports = { SECURITY_SUMMARY };
