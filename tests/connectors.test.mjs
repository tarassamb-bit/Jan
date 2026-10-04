import test from "node:test";
import assert from "node:assert/strict";
import { handleConnectors } from "../api/connectors.js";

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); },
  };
}

test("connected-apps endpoint returns unique active apps without credentials", async () => {
  const requested = [];
  const composio = {
    connectedAccounts: {
      async list(query) {
        requested.push(query);
        return { items: [
          { status: "ACTIVE", isDisabled: false, toolkit: { slug: "gmail" }, id: "private-1" },
          { status: "ACTIVE", isDisabled: false, toolkit: { slug: "GMAIL" }, id: "private-2" },
          { status: "ACTIVE", isDisabled: true, toolkit: { slug: "github" }, id: "disabled" },
          { status: "INACTIVE", isDisabled: false, toolkit: { slug: "vercel" }, id: "inactive" },
        ] };
      },
    },
    toolkits: {
      async getMany() { throw new Error("Connected-app loading should not make a metadata request."); },
    },
  };
  const response = makeResponse();
  await handleConnectors({ method: "GET", url: "/api/connectors?action=connected&userId=user-1", headers: { host: "localhost" } }, response, {
    authenticate: async () => ({ user: { id: "user-1" } }),
    clientProvider: () => composio,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(requested, [{ userIds: ["user-1"], statuses: ["ACTIVE"], limit: 100 }]);
  assert.deepEqual(response.body.items, [{ slug: "gmail", name: "Gmail", description: "Search your mailbox and read messages you choose. You approve Google access in its secure sign-in window.", logo: null, available: true, connected: true }]);
  assert.equal(JSON.stringify(response.body).includes("private-1"), false);
});

test("catalog returns a small deduplicated first page and reuses its warm snapshot", async () => {
  let listCalls = 0;
  const composio = { toolkits: { client: { toolkits: { async list(query) {
    listCalls += 1;
    assert.equal(query.limit, 32);
    return { items: [
      { slug: "GMAIL", name: "Gmail", meta: { description: "Read mail", logo: "https://example.test/gmail.svg" } },
      { slug: "gmail", name: "Duplicate Gmail", meta: {} },
    ], next_cursor: "next-page" };
  } } } } };
  const createRequest = () => ({ method: "GET", url: "/api/connectors?action=catalog&userId=user-1", headers: { host: "localhost" } });
  const options = { authenticate: async () => ({ user: { id: "user-1" } }), clientProvider: () => composio };
  const first = makeResponse();
  await handleConnectors(createRequest(), first, options);
  const second = makeResponse();
  await handleConnectors(createRequest(), second, options);
  const refreshed = makeResponse();
  await handleConnectors({ ...createRequest(), url: "/api/connectors?action=catalog&userId=user-1&refresh=1" }, refreshed, options);

  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.body, second.body);
  assert.equal(listCalls, 2);
  assert.deepEqual(first.body.items, [{ slug: "gmail", name: "Gmail", description: "Read mail", logo: "https://example.test/gmail.svg", available: true }]);
  assert.equal(first.body.nextCursor, "next-page");
  assert.equal(refreshed.statusCode, 200);
});

test("connector status checks active accounts directly without creating a Composio session", async () => {
  let accountQuery;
  const response = makeResponse();
  const composio = {
    connectedAccounts: { async list(query) { accountQuery = query; return { items: [{ status: "ACTIVE", isDisabled: false, toolkit: { slug: "VERCEL" } }] }; } },
    toolkits: { async get(slug) { return { slug, name: "Vercel", meta: { description: "Deploy apps" } }; } },
    create() { throw new Error("Status checks must not create a session."); },
  };
  await handleConnectors({ method: "GET", url: "/api/connectors?action=status&toolkit=vercel&userId=user-1", headers: { host: "localhost" } }, response, {
    authenticate: async () => ({ user: { id: "user-1" } }),
    clientProvider: () => composio,
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(accountQuery, { userIds: ["user-1"], toolkitSlugs: ["vercel"], statuses: ["ACTIVE"], limit: 100 });
  assert.deepEqual(response.body, { connector: { slug: "vercel", name: "Vercel", description: "Deploy apps", available: true }, connected: true });
});

test("connected-apps endpoint enforces the authenticated account", async () => {
  const response = makeResponse();
  let providerCalled = false;
  await handleConnectors({ method: "GET", url: "/api/connectors?action=connected&userId=other", headers: { host: "localhost" } }, response, {
    authenticate: async () => ({ user: { id: "user-1" } }),
    clientProvider: () => { providerCalled = true; return {}; },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(providerCalled, false);
});
