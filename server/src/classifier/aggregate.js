// 2.2: aggregate org behavior — chat tools tend to show short-burst sessions
// across multiple distinct users, vs. e.g. a single long session on a
// reference/docs site. POST /activity/events computes real distinct-user/
// session data from the activity_events table (Section 8) and passes it in;
// POST /tools/classify is the manual/direct-test entry point and accepts it
// as a raw param instead.
function aggregateFeature({ distinctUsers = 0, avgSessionSeconds = 0 } = {}) {
  let score = 0;
  if (distinctUsers >= 3) score += 5;
  if (avgSessionSeconds > 0 && avgSessionSeconds < 300) score += 5;
  return { distinctUsers, avgSessionSeconds, score: Math.min(10, score) };
}

module.exports = { aggregateFeature };
