const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 20;
const rateBuckets = new Map();

function json(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.json(payload);
}

export function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return null;
  const messages = value.map((message) => ({
    role: message?.role,
    content: typeof message?.content === "string" ? message.content.trim() : "",
  }));
  if (messages.some((message) => !["user", "assistant"].includes(message.role) || !message.content || message.content.length > MAX_CONTENT_LENGTH)) return null;
  return messages;
}

function isRateLimited(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const key = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]) || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (rateBuckets.get(key) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(key, recent);
  return recent.length > RATE_LIMIT_REQUESTS;
}

export async function requestGroq({ messages, apiKey, model = DEFAULT_MODEL }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are Jan, a thoughtful, concise personal AI assistant. Be practical, clear, and friendly." },
        ...messages,
      ],
      temperature: 0.7,
      max_completion_tokens: 1200,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || "The AI provider rejected the request.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return {
    content: payload?.choices?.[0]?.message?.content?.trim() || "I couldn't produce a response this time.",
    model: payload?.model || model,
  };
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const requestId = req.headers["x-vercel-id"] || "local";
  console.log(JSON.stringify({ level: "info", msg: "chat_start", route: "/api/chat", requestId }));

  if (req.method === "GET") {
    return json(res, 200, { configured: Boolean(process.env.GROQ_API_KEY), model: process.env.GROQ_MODEL || DEFAULT_MODEL });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed." });
  }

  if (!process.env.GROQ_API_KEY) {
    console.warn(JSON.stringify({ level: "warn", msg: "groq_not_configured", route: "/api/chat", requestId }));
    return json(res, 503, { code: "GROQ_NOT_CONFIGURED", error: "Groq is not connected yet." });
  }

  if (isRateLimited(req)) return json(res, 429, { error: "Too many messages. Please wait a minute and try again." });

  const messages = validateMessages(req.body?.messages);
  if (!messages) return json(res, 400, { error: "Send between 1 and 20 valid chat messages." });

  try {
    const answer = await requestGroq({ messages, apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL });
    console.log(JSON.stringify({ level: "info", msg: "chat_done", route: "/api/chat", requestId, ms: Date.now() - startedAt }));
    return json(res, 200, answer);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "chat_failed", route: "/api/chat", requestId, status: error.status || 500, error: error.message, ms: Date.now() - startedAt }));
    return json(res, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.message || "The AI provider is unavailable." });
  }
}
