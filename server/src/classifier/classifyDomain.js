const { domainTokenFeature, titleTokenFeature } = require('./textSignals');
const { fingerprintFeature } = require('./fingerprint');
const { certFeature } = require('./certFeature');
const { registrationAgeFeature } = require('./registrationAgeFeature');
const { aggregateFeature } = require('./aggregate');
const { getTlsCertIssuerOrg, getDomainAgeDays } = require('./collectors');
const { scoreFeatures, defaultActionFor, explain } = require('./score');

// Shared orchestration for 2.1: given a domain (+ whatever signals are
// available), run the full feature pipeline and score it. Used both by the
// manual /tools/classify endpoint and the real activity-ingestion path.
async function classifyDomain({ domain, title, scriptHints, distinctUsers, avgSessionSeconds }) {
  const [issuerOrg, ageDays] = await Promise.all([
    getTlsCertIssuerOrg(domain).catch(() => null),
    getDomainAgeDays(domain).catch(() => null),
  ]);

  const featureSnapshot = {
    domain,
    titleText: title || null,
    domainTokens: domainTokenFeature(domain),
    titleTokens: titleTokenFeature(title),
    fingerprint: fingerprintFeature(scriptHints),
    cert: certFeature(issuerOrg),
    registrationAge: registrationAgeFeature(ageDays),
    aggregate: aggregateFeature({ distinctUsers, avgSessionSeconds }),
  };

  const confidence = scoreFeatures(featureSnapshot);
  return {
    confidence,
    featureSnapshot,
    defaultAction: defaultActionFor(confidence),
    explanation: explain(featureSnapshot),
  };
}

module.exports = { classifyDomain };
