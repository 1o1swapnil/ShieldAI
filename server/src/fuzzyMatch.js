// 1.4: match an OAuth-grant app name (e.g. "OpenAI API access") against the
// ai_tools library. No fuzzy-string-distance dependency needed — normalized
// substring containment is enough for names this short and distinctive.
function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fuzzyMatchAiTool(toolName, aiTools) {
  const norm = normalize(toolName);
  if (!norm) return null;
  const match = aiTools.find((tool) => {
    const nName = normalize(tool.name);
    const nDomain = normalize(tool.domain);
    return (
      (nName && (norm.includes(nName) || nName.includes(norm))) ||
      (nDomain && (norm.includes(nDomain) || nDomain.includes(norm)))
    );
  });
  return match ? match.id : null;
}

module.exports = { normalize, fuzzyMatchAiTool };
