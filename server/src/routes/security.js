const express = require('express');
const { SECURITY_SUMMARY } = require('../security');

const router = express.Router();

// 3.2: machine-readable endpoint security teams can pull into their own
// vendor risk assessment instead of emailing sales.
router.get('/security-summary', (req, res) => {
  res.json(SECURITY_SUMMARY);
});

module.exports = router;
