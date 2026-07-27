// 2.2: aggregate org behavior — chat tools tend to show short-burst sessions
// across multiple distinct users, vs. e.g. a single long session on a
// reference/docs site. Real distinct-user/session data comes from the
// activity-events pipeline (Section 6/8), not built yet, so callers pass it
// in directly.
function aggregateFeature({ distinctUsers = 0, avgSessionSeconds = 0 } = {}) {
  let score = 0;
  if (distinctUsers >= 3) score += 5;
  if (avgSessionSeconds > 0 && avgSessionSeconds < 300) score += 5;
  return { distinctUsers, avgSessionSeconds, score: Math.min(10, score) };
}

module.exports = { aggregateFeature };
