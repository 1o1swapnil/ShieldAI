// 2.2: domain registration age — weak prior, AI tools skew younger.
const YOUNG_DOMAIN_DAYS = 730; // 2 years

function registrationAgeFeature(ageDays) {
  const score = ageDays != null && ageDays < YOUNG_DOMAIN_DAYS ? 5 : 0;
  return { ageDays: ageDays ?? null, score };
}

module.exports = { registrationAgeFeature };
