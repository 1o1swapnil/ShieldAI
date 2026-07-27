const express = require('express');
const consentRouter = require('./routes/consent');
const settingsRouter = require('./routes/settings');
const securityRouter = require('./routes/security');
const extensionRouter = require('./routes/extension');
const toolsRouter = require('./routes/tools');
const coverageRouter = require('./routes/coverage');
const nativeAppRouter = require('./routes/nativeApp');
const integrationsRouter = require('./routes/integrations');

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

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => console.log(`ShieldAI server listening on ${port}`));
}

module.exports = app;
