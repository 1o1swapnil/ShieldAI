const express = require('express');

const router = express.Router();

// 3.2: source of truth for GET /org/security-summary — update when
// retention, encryption, or sub-processors actually change. Machine-readable
// endpoint security teams can pull into their own vendor risk assessment
// instead of emailing sales.
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

router.get('/security-summary', (req, res) => {
  res.json(SECURITY_SUMMARY);
});

module.exports = router;
