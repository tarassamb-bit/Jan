export const DEFAULT_MODEL = "openai/gpt-oss-20b";
export const ALLOWED_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];
const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 16_000;
const MAX_IMAGE_DATA_URL_LENGTH = 4_200_000;
const MAX_IMAGES_PER_MESSAGE = 3;
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
  const messages = value.map((message) => {
    const role = message?.role;
    if (typeof message?.content === "string") return { role, content: message.content.trim() };
    if (!Array.isArray(message?.content) || role !== "user") return { role, content: "" };
    const textParts = message.content.filter((part) => part?.type === "text" && typeof part.text === "string" && part.text.trim());
    const imageParts = message.content.filter((part) => part?.type === "image_url" && typeof part?.image_url?.url === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(part.image_url.url) && part.image_url.url.length <= MAX_IMAGE_DATA_URL_LENGTH);
    if (!textParts.length || imageParts.length < 1 || imageParts.length > MAX_IMAGES_PER_MESSAGE || textParts.length + imageParts.length !== message.content.length) return { role, content: "" };
    const textLength = textParts.reduce((total, part) => total + part.text.trim().length, 0);
    if (textLength > MAX_CONTENT_LENGTH) return { role, content: "" };
    return { role, content: [...textParts.map((part) => ({ type: "text", text: part.text.trim() })), ...imageParts] };
  });
  if (messages.some((message) => !["user", "assistant"].includes(message.role) || !message.content || (typeof message.content === "string" && message.content.length > MAX_CONTENT_LENGTH))) return null;
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

function createGroqRequest({ messages, model = DEFAULT_MODEL, stream = false }) {
  const request = {
    model,
    messages: [
      { role: "system", content: "You are Jan, a careful and accurate personal AI assistant. Give direct, well-structured answers. Distinguish facts from uncertainty, do not invent sources or file details, and ask a concise clarifying question when essential context is missing." },
      ...messages,
    ],
    temperature: 0.35,
    max_completion_tokens: 1600,
  };
  if (stream) request.stream = true;
  if (model === "openai/gpt-oss-20b" || model === "openai/gpt-oss-120b") request.reasoning_effort = "medium";
  return request;
}

async function fetchGroq({ messages, apiKey, model = DEFAULT_MODEL, stream = false, signal }) {
  const request = createGroqRequest({ messages, model, stream });
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  return response;
}

export async function requestGroq({ messages, apiKey, model = DEFAULT_MODEL }) {
  const response = await fetchGroq({ messages, apiKey, model });

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

export async function requestGroqStream({ messages, apiKey, model = DEFAULT_MODEL, signal }) {
  const response = await fetchGroq({ messages, apiKey, model, stream: true, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error?.message || "The AI provider rejected the request.");
    error.status = response.status;
    throw error;
  }
  if (!response.body) throw new Error("The AI provider returned an empty stream.");
  return response;
}

async function pipeStream({ upstream, req, res }) {
  const reader = upstream.body.getReader();
  let closed = false;
  const cancel = () => {
    if (closed) return;
    closed = true;
    reader.cancel().catch(() => {});
  };
  req.once?.("aborted", cancel);
  res.once?.("close", () => { if (!res.writableEnded) cancel(); });
  try {
    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    req.removeListener?.("aborted", cancel);
    if (!res.writableEnded) res.end();
  }
}

export async function listAvailableModels(apiKey) {
  if (!apiKey) return ALLOWED_MODELS;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    const payload = await response.json();
    if (!response.ok) return ALLOWED_MODELS;
    const available = new Set((payload.data || []).map((model) => model.id));
    const models = ALLOWED_MODELS.filter((model) => available.has(model));
    return models.length ? models : ALLOWED_MODELS;
  } catch {
    return ALLOWED_MODELS;
  }
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const requestId = req.headers["x-vercel-id"] || "local";
  console.log(JSON.stringify({ level: "info", msg: "chat_start", route: "/api/chat", requestId }));

  if (req.method === "GET") {
    const models = await listAvailableModels(process.env.GROQ_API_KEY);
    const preferred = process.env.GROQ_MODEL || DEFAULT_MODEL;
    return json(res, 200, { configured: Boolean(process.env.GROQ_API_KEY), model: models.includes(preferred) ? preferred : models[0], models });
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
  if (!messages) return json(res, 400, { error: "Send between 1 and 20 valid chat messages, up to 16,000 characters each." });

  const requestedModel = req.body?.model;
  const availableModels = await listAvailableModels(process.env.GROQ_API_KEY);
  const configuredModel = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const model = requestedModel && availableModels.includes(requestedModel) ? requestedModel : availableModels.includes(configuredModel) ? configuredModel : availableModels[0];
  const containsImages = messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === "image_url"));
  if (containsImages && model !== "qwen/qwen3.8-27b") return json(res, 400, { error: "Photos require Qwen 3.8 Vision. Select that model and try again." });

  try {
    if (req.body?.stream === true) {
      const controller = new AbortController();
      req.once?.("aborted", () => controller.abort());
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      const upstream = await requestGroqStream({ messages, apiKey: process.env.GROQ_API_KEY, model, signal: controller.signal });
      await pipeStream({ upstream, req, res });
      console.log(JSON.stringify({ level: "info", msg: "chat_stream_done", route: "/api/chat", requestId, ms: Date.now() - startedAt }));
      return;
    }
    const answer = await requestGroq({ messages, apiKey: process.env.GROQ_API_KEY, model });
    console.log(JSON.stringify({ level: "info", msg: "chat_done", route: "/api/chat", requestId, ms: Date.now() - startedAt }));
    return json(res, 200, answer);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "chat_failed", route: "/api/chat", requestId, status: error.status || 500, error: error.message, ms: Date.now() - startedAt }));
    return json(res, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.message || "The AI provider is unavailable." });
  }
}
