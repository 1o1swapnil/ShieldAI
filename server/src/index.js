const express = require('express');
const consentRouter = require('./routes/consent');
const settingsRouter = require('./routes/settings');
const securityRouter = require('./routes/security');
const extensionRouter = require('./routes/extension');
const toolsRouter = require('./routes/tools');
const coverageRouter = require('./routes/coverage');
const nativeAppRouter = require('./routes/nativeApp');
const integrationsRouter = require('./routes/integrations');
const activityRouter = require('./routes/activity');

const app = express();
app.use(express.json());
app.use('/consent', consentRouter);
app.use('/org', settingsRouter);
app.use('/org', securityRouter);
app.use('/org', coverageRouter);
app.use('/extension', extensionRouter);
app.use('/tools', toolsRouter);
app.use('/native-app', nativeAppRouter);
app.use('/integrations', integrationsRouter);
app.use('/activity', activityRouter);

// Express 5 forwards a rejected async handler here instead of crashing the
// process — one bad request must not take down every other org's traffic.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`ShieldAI server listening on ${port}`));
}

module.exports = app;
