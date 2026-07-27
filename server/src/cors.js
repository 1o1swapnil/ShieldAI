// No cookies are used anywhere (auth is Bearer-token based), so there's no
// CSRF exposure from allowing multiple known origins — but we still reflect
// only configured origins rather than '*', least-privilege by default.
const allowedOrigins = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim());

function cors(req, res, next) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

module.exports = { cors };
