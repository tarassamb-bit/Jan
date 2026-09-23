const SEARCH_URL = "https://api.tavily.com/search";
const MAX_SEARCH_QUERY_LENGTH = 400;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_LIMIT = 100;
const EMPTY_CACHE_TTL_MS = 30 * 1000;
const searchCache = new Map();
const pendingSearches = new Map();

function lastUserText(messages) {
  const content = [...messages].reverse().find((message) => message.role === "user")?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.filter((part) => part.type === "text").map((part) => part.text).join(" ").trim();
  return "";
}

export function webSearchQuery(messages, force = false) {
  const text = lastUserText(messages).split(/\nSource:/i)[0].trim();
  if (!text) return "";
  const query = text.replace(/^(?:please\s+)?(?:search (?:the (?:web|internet)\s+)?(?:for\s+)?|look up\s+|browse (?:the )?(?:web|internet)\s+for\s+|find\s+(?:me\s+)?(?:information\s+)?(?:online\s+)?(?:about\s+)?)/i, "").trim() || text;
  if (force) return query.slice(0, MAX_SEARCH_QUERY_LENGTH);
  // Asking whether Jan can search is a capability question, not a search query.
  if (/^(?:can|could|do|are) you (?:search|browse|look up|access the (?:web|internet))(?: (?:the )?(?:web|internet|online))?\??$/i.test(text)) return "";
  const explicit = /\b(?:search (?:the (?:web|internet) )?(?:for|online)|look (?:it |this |that )?up|browse (?:the )?(?:web|internet)|find (?:it |this |that )?online|google (?:for )?)\b/i;
  const current = /\b(?:latest|today|yesterday|tomorrow|right now|currently|up.to.date|live|this week|this month|recent news|breaking news|newest|current (?:price|weather|president|ceo|version|release|events?))\b/i;
  const liveFacts = /\b(?:weather|forecast|stock price|share price|exchange rate|sports score|game score|election results?|who (?:is|are) (?:the )?(?:current )?(?:ceo|president|prime minister)|what (?:is|are) (?:the )?(?:current )?(?:price|version))\b/i;
  return (explicit.test(text) || current.test(text) || liveFacts.test(text)) ? query.slice(0, MAX_SEARCH_QUERY_LENGTH) : "";
}

function safeSource(result) {
  try {
    const url = new URL(result.url);
    if (url.protocol !== "https:" || url.href.length > 500 || url.username || url.password) return null;
    url.hash = "";
    const content = String(result.content || "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!content) return null;
    const published = result.published_date ? new Date(result.published_date) : null;
    return {
      title: String(result.title || url.hostname).replace(/[\r\n\t]/g, " ").slice(0, 120),
      url: url.href,
      content,
      ...(published && !Number.isNaN(published.getTime()) ? { publishedDate: published.toISOString().slice(0, 10) } : {}),
    };
  } catch { return null; }
}

export async function searchWeb(query, apiKey, { signal, fetchImpl = fetch } = {}) {
  if (!apiKey) throw Object.assign(new Error("Web search is not configured yet. Add TAVILY_API_KEY to the server environment."), { status: 503, code: "WEB_SEARCH_NOT_CONFIGURED" });
  const cleanQuery = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  if (!cleanQuery) return [];
  // This is a small per-process cache: it saves repeat credits, not a durable search history.
  const cacheKey = `${apiKey}\0${cleanQuery.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.sources;
  if (!signal && pendingSearches.has(cacheKey)) return pendingSearches.get(cacheKey);
  const task = fetchSearch(cleanQuery, apiKey, { signal, fetchImpl }).then((sources) => {
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, { sources, expires: Date.now() + (sources.length ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS) });
    if (searchCache.size > CACHE_LIMIT) searchCache.delete(searchCache.keys().next().value);
    return sources;
  }).finally(() => { if (!signal) pendingSearches.delete(cacheKey); });
  if (!signal) pendingSearches.set(cacheKey, task);
  return task;
}

async function fetchSearch(query, apiKey, { signal, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(SEARCH_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, topic: /\b(?:news|headlines|breaking)\b/i.test(query) ? "news" : "general", search_depth: "basic", max_results: 5, include_published_date: true, include_answer: false, include_raw_content: false }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Object.assign(new Error("Web search is temporarily unavailable. Please try again."), { status: 502, code: "WEB_SEARCH_UNAVAILABLE" });
  }
  if (!response.ok) {
    const limited = [429, 432, 433].includes(response.status);
    throw Object.assign(new Error(limited ? "Tavily’s search limit has been reached. Try again later or check your Tavily usage." : "Web search failed. Check your Tavily key or try again later."), { status: limited ? 429 : 502, code: limited ? "WEB_SEARCH_LIMIT" : "WEB_SEARCH_UNAVAILABLE" });
  }
  const payload = await response.json().catch(() => { throw Object.assign(new Error("Web search returned an invalid response. Please try again."), { status: 502, code: "WEB_SEARCH_INVALID_RESPONSE" }); });
  if (!Array.isArray(payload.results)) throw Object.assign(new Error("Web search returned an invalid response. Please try again."), { status: 502, code: "WEB_SEARCH_INVALID_RESPONSE" });
  const seen = new Set();
  return payload.results.map(safeSource).filter((source) => {
    if (!source) return false;
    const canonical = source.url.replace(/\/$/, "").toLowerCase();
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  }).slice(0, 5);
}
