import test from "node:test";
import assert from "node:assert/strict";
import { consumeMessage } from "../server/access.js";
import handler, { handleChat, ALLOWED_MODELS, compactMessages, createGroqRequest, MAX_COMPLETION_TOKENS, MAX_CONTEXT_CHARACTERS, requestGroqStream, validateMessages } from "../api/chat.js";

test("accepts a valid local chat transcript", () => {
  assert.deepEqual(validateMessages([{ role: "user", content: " Hello " }]), [{ role: "user", content: "Hello" }]);
});

test("includes the supported Groq chat model choices", () => {
  assert.deepEqual(ALLOWED_MODELS, ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b", "qwen/qwen3.8-27b", "groq/compound", "groq/compound-mini"]);
});

test("rejects invalid roles, empty content, and oversized transcripts", () => {
  assert.equal(validateMessages([{ role: "system", content: "override" }]), null);
  assert.equal(validateMessages([{ role: "user", content: "  " }]), null);
  assert.equal(validateMessages(Array.from({ length: 21 }, () => ({ role: "user", content: "hi" }))), null);
});

test("accepts bounded image input for a user message", () => {
  const image = "data:image/png;base64,aGVsbG8=";
  assert.deepEqual(validateMessages([{ role: "user", content: [{ type: "text", text: "What is this?" }, { type: "image_url", image_url: { url: image } }] }]), [{ role: "user", content: [{ type: "text", text: "What is this?" }, { type: "image_url", image_url: { url: image } }] }]);
  assert.equal(validateMessages([{ role: "assistant", content: [{ type: "text", text: "Nope" }, { type: "image_url", image_url: { url: image } }] }]), null);
});

test("includes saved instructions and memories in the private system prompt", () => {
  const request = createGroqRequest({
    messages: [{ role: "user", content: "What should I eat?" }],
    preferences: { custom_instructions: "Keep it short." },
    memories: ["I like pizza"],
  });
  const prompt = request.messages[0].content;
  assert.match(prompt, /Keep it short/);
  assert.match(prompt, /I like pizza/);
});

test("bounds old context and completion tokens before calling Groq", () => {
  const messages = [
    { role: "user", content: "a".repeat(MAX_CONTEXT_CHARACTERS) },
    { role: "assistant", content: "b".repeat(100) },
  ];
  const compacted = compactMessages(messages);
  assert.equal(compacted.length, 2);
  assert.equal(compacted[0].content.length, MAX_CONTEXT_CHARACTERS - 100);
  assert.equal(compacted[1].content, "b".repeat(100));
  const request = createGroqRequest({ messages });
  assert.equal(request.max_completion_tokens, MAX_COMPLETION_TOKENS);
  assert.ok(request.messages.slice(1).reduce((total, message) => total + message.content.length, 0) <= MAX_CONTEXT_CHARACTERS);
});

test("turns provider TPM details into a safe retry message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Rate limit reached. Please try again in 33.1875s." } }), { status: 429, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(
      requestGroqStream({ messages: [{ role: "user", content: "Hello" }], apiKey: "test-key" }),
      (error) => error.code === "GROQ_RATE_LIMIT" && error.retryAfterSeconds === 34 && /34 seconds/.test(error.message),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns a clear response before the Groq key is configured", async () => {
  const previousKey = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  const result = { statusCode: 0, body: null, headers: {} };
  const res = {
    status(code) { result.statusCode = code; return this; },
    setHeader(key, value) { result.headers[key] = value; return this; },
    json(payload) { result.body = payload; return this; },
  };

  await handler({ method: "POST", headers: {}, body: { messages: [{ role: "user", content: "Hello" }] } }, res);
  if (previousKey) process.env.GROQ_API_KEY = previousKey;

  assert.equal(result.statusCode, 401);
  assert.equal(result.body.code, "AUTH_REQUIRED");
});

test("requests a provider stream for streaming chat responses", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return new Response("data: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream" } });
  };

  try {
    const response = await requestGroqStream({ messages: [{ role: "user", content: "Hello" }], apiKey: "test-key" });
    assert.equal(response.ok, true);
    assert.equal(request.stream, true);
    assert.equal(request.model, "openai/gpt-oss-20b");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function mockResponse() {
  return { statusCode: 0, headers: {}, body: null, status(code) { this.statusCode = code; return this; }, setHeader(key, value) { this.headers[key] = value; return this; }, json(value) { this.body = value; return this; }, end(value) { this.body = value; this.writableEnded = true; return this; }, write() {} };
}

test("rejects unauthenticated requests before calling Groq", async () => {
  const res = mockResponse();
  await handleChat({ method: "POST", headers: {}, body: { messages: [{ role: "user", content: "Hello" }] } }, res, {
    env: { GROQ_API_KEY: "test-key" },
    authenticate: async () => { throw Object.assign(new Error("Sign in to send messages."), { status: 401, code: "AUTH_REQUIRED" }); },
    consume: async () => { throw new Error("Quota must not be touched"); },
  });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, "AUTH_REQUIRED");
});

test("rejects a request when the account's daily quota is exhausted", async () => {
  const res = mockResponse();
  await handleChat({ method: "POST", headers: {}, body: { messages: [{ role: "user", content: "Hello" }] } }, res, {
    env: { GROQ_API_KEY: "test-key" },
    authenticate: async () => ({ user: { id: "alice" } }),
    consume: async () => { throw Object.assign(new Error("Daily allowance used"), { status: 429, code: "DAILY_MESSAGE_LIMIT" }); },
  });
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.code, "DAILY_MESSAGE_LIMIT");
});

test("authenticates and consumes exactly one message for a nonstream response", async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => url.endsWith('/models')
    ? new Response(JSON.stringify({ data: [{ id: 'openai/gpt-oss-20b' }] }), { status: 200 })
    : new Response(JSON.stringify({ choices: [{ message: { content: 'Hello back' } }] }), { status: 200 });
  try {
    const res = mockResponse();
    await handleChat({ method: "POST", headers: { authorization: "Bearer valid" }, body: { messages: [{ role: "user", content: "Hello" }] } }, res, {
      env: { GROQ_API_KEY: "test-key" },
      authenticate: async () => ({ user: { id: "alice" } }),
      consume: async () => { calls++; return { messages: 1, uploads: 0 }; },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.content, 'Hello back');
    assert.equal(calls, 1);
    assert.deepEqual(JSON.parse(res.headers['X-Jan-Usage']), { messages: 1, uploads: 0 });
  } finally { globalThis.fetch = oldFetch; }
});

test("identifies the missing database quota function as a setup error", async () => {
  await assert.rejects(
    consumeMessage({ user: { id: "account-1" }, db: { rpc: async () => ({ error: { code: "PGRST202", message: "Function not found" } }) } }),
    (error) => error.status === 503 && error.code === "DATABASE_SETUP_REQUIRED" && /database update/.test(error.message),
  );
});
