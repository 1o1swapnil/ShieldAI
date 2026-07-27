// 2.2: domain-token and page-title features. Both are the same kind of
// signal (does this text contain AI-tool naming conventions), just scored
// against different max weights since a title match is a stronger signal
// than a domain substring match.
const AI_TOKENS = ['chat', 'ai', 'gpt', 'copilot', 'assistant', 'llm', 'bot'];

function textTokenFeature(text, maxScore) {
  const lower = (text || '').toLowerCase();
  const matched = AI_TOKENS.filter((token) => lower.includes(token));
  const score = matched.length ? Math.min(maxScore, matched.length * (maxScore / 2)) : 0;
  return { matched, score };
}

const domainTokenFeature = (domain) => textTokenFeature(domain, 40);
const titleTokenFeature = (title) => textTokenFeature(title, 30);

module.exports = { AI_TOKENS, textTokenFeature, domainTokenFeature, titleTokenFeature };
