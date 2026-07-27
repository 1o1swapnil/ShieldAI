// 2.3: cold-start v0 model — a weighted linear combination of the Section
// 2.2 features. Stands in for the trained GBT (XGBoost/LightGBM) until the
// admin review queue (2.4's feedback loop) has produced enough labeled
// examples to actually train one; the feature_snapshot this scores is
// exactly the training-row shape that model would consume later.
function scoreFeatures(featureSnapshot) {
  const { domainTokens, titleTokens, fingerprint, cert, registrationAge, aggregate } = featureSnapshot;
  const total =
    domainTokens.score + titleTokens.score + fingerprint.score + cert.score + registrationAge.score + aggregate.score;
  return Math.min(100, Math.round(total));
}

// 2.3 thresholds. null means "not surfaced" (logged only, per the design's
// alert-fatigue guard).
function defaultActionFor(confidence) {
  if (confidence >= 85) return 'warn';
  if (confidence >= 60) return 'allow_silent_log';
  return null;
}

// 2.6: top-3 contributing features in plain language.
function explain(featureSnapshot) {
  const { domain, titleText, domainTokens, titleTokens, fingerprint, cert, registrationAge, aggregate } = featureSnapshot;
  const candidates = [];

  if (domainTokens.matched.length) {
    candidates.push({
      weight: domainTokens.score,
      text: `domain "${domain}" contains ${domainTokens.matched.map((t) => `'${t}'`).join(' + ')}`,
    });
  }
  if (titleTokens.matched.length) {
    candidates.push({
      weight: titleTokens.score,
      text: `page title reads "${titleText}"`,
    });
  }
  if (fingerprint.matched.length) {
    candidates.push({
      weight: fingerprint.score,
      text: `recognized AI chat-widget embed (${fingerprint.matched.join(', ')})`,
    });
  }
  if (cert.knownProvider) {
    candidates.push({
      weight: cert.score,
      text: `TLS cert issued via ${cert.issuerOrg} (common among AI startups)`,
    });
  }
  if (registrationAge.score > 0) {
    candidates.push({
      weight: registrationAge.score,
      text: `registered ${registrationAge.ageDays} days ago (relatively new domain)`,
    });
  }
  if (aggregate.score > 0) {
    candidates.push({
      weight: aggregate.score,
      text: `${aggregate.distinctUsers} distinct users, short-session usage pattern typical of chat tools`,
    });
  }

  candidates.sort((a, b) => b.weight - a.weight);
  return candidates.slice(0, 3).map((c) => c.text);
}

module.exports = { scoreFeatures, defaultActionFor, explain };
