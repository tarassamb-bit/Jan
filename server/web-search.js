const SEARCH_URL = 'https://api.firecrawl.dev/v2/search';
const SCRAPE_URL = 'https://api.firecrawl.dev/v2/scrape';
const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map();

function userText(messages) {
  const content = [...messages].reverse().find((message) => message.role === 'user')?.content;
  if (typeof content === 'string') return content.trim();
  return Array.isArray(content) ? content.filter((part) => part.type === 'text').map((part) => part.text).join(' ').trim() : '';
}

export function searchQueryFor(messages) {
  const text = userText(messages).slice(0, 400);
  if (!text || /^(?:can|could|do) you (?:search|browse)(?: the (?:web|internet))?\??$/i.test(text)) return '';
  const explicit = /\b(?:search|browse|look (?:it |this |that )?up|find .+ online)\b/i;
  const current = /\b(?:latest|today|right now|currently|current|recent|live|this (?:week|month|year)|as of)\b/i;
  const changing = /\b(?:price|cost|how much|weather|forecast|score|schedule|in stock|availability|exchange rate|stock price|news|release date|version|ceo|president|prime minister)\b/i;
  if (!explicit.test(text) && !current.test(text) && !changing.test(text)) return '';
  return text.replace(/^(?:please\s+)?(?:search|browse|look up)(?: the (?:web|internet))?(?: for)?\s*/i, '').trim() || text;
}

function validSource(result) {
  try {
    const url = new URL(result.url);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const content = String(result.markdown || result.description || '').replace(/\s+/g, ' ').trim().slice(0, 1800);
    if (!content) return null;
    return { title: String(result.title || url.hostname).replace(/[\r\n]/g, ' ').slice(0, 120), url: url.href, content };
  } catch { return null; }
}

function containsUsefulPrice(source) {
  return /(?:[$€£]\s*\d[\d.,]*|\b\d[\d.,]*\s*(?:USD|EUR|GBP)\b)/i.test(source.content);
}

function focusedQuery(query, locale) {
  if (/\b(?:price|cost|how much)\b/i.test(query)) {
    const currency = /^es|^fr|^de|^it|^pt|^nl/i.test(locale) ? 'EUR' : /^en-gb/i.test(locale) ? 'GBP' : 'USD';
    return `${query} ${currency} current retailer product listing exact price`.slice(0, 500);
  }
  return query.slice(0, 500);
}

async function scrape(source, apiKey, signal, fetchImpl) {
  try {
    const response = await fetchImpl(SCRAPE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: source.url, formats: ['markdown'], onlyMainContent: true, maxAge: 10 * 60 * 1000 }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000),
    });
    if (!response.ok) return source;
    const payload = await response.json().catch(() => null);
    const hydrated = validSource({ ...source, title: payload?.data?.metadata?.title || source.title, markdown: payload?.data?.markdown });
    return hydrated || source;
  } catch { return source; }
}

export async function findWebSources(query, apiKey, { locale = '', signal, fetchImpl = fetch } = {}) {
  if (!apiKey || !query) return [];
  const focused = focusedQuery(query, locale);
  const key = `${locale}\0${focused.toLowerCase()}`;
  const saved = cache.get(key);
  if (saved?.expires > Date.now()) return saved.sources;
  try {
    const response = await fetchImpl(SEARCH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: focused, limit: 3, sources: [{ type: 'web' }], ignoreInvalidURLs: true, timeout: 3500 }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(4000)]) : AbortSignal.timeout(4000),
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null);
    let sources = (payload?.data?.web || []).map(validSource).filter(Boolean).slice(0, 3);
    const priceQuestion = /\b(?:price|cost|how much)\b/i.test(query);
    if (sources.length && priceQuestion && !sources.some(containsUsefulPrice)) {
      const hydrated = await Promise.all(sources.slice(0, 2).map((source) => scrape(source, apiKey, signal, fetchImpl)));
      sources = [...hydrated, ...sources.slice(2)];
    }
    cache.set(key, { sources, expires: Date.now() + CACHE_TTL });
    return sources;
  } catch { return []; }
}

export function linkSourceCitations(answer, sources) {
  const superscript = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
  return String(answer || '').replace(/\[(\d+)\]|【(\d+)】/g, (citation, square, unicode) => {
    const value = square || unicode;
    const source = sources[Number(value) - 1];
    if (!source || !/^https:\/\//i.test(source.url)) return citation;
    const label = String(value).split('').map((digit) => superscript[Number(digit)]).join('');
    return `[${label}](<${source.url}>)`;
  });
}
