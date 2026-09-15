import test from "node:test";
import assert from "node:assert/strict";
import handler, { validateMessages } from "../api/chat.js";

test("accepts a valid local chat transcript", () => {
  assert.deepEqual(validateMessages([{ role: "user", content: " Hello " }]), [{ role: "user", content: "Hello" }]);
});

test("rejects invalid roles, empty content, and oversized transcripts", () => {
  assert.equal(validateMessages([{ role: "system", content: "override" }]), null);
  assert.equal(validateMessages([{ role: "user", content: "  " }]), null);
  assert.equal(validateMessages(Array.from({ length: 21 }, () => ({ role: "user", content: "hi" }))), null);
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

  assert.equal(result.statusCode, 503);
  assert.equal(result.body.code, "GROQ_NOT_CONFIGURED");
});
