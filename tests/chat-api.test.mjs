import test from "node:test";
import assert from "node:assert/strict";
import { consumeMessage } from "../server/access.js";
import handler, { handleChat, ALLOWED_MODELS, compactMessages, connectedToolkitsFor, createGroqRequest, driveDocumentEditFor, driveDocumentFollowUpFor, MAX_COMPLETION_TOKENS, MAX_CONTEXT_CHARACTERS, requestGroqStream, requestGroqWithComposio, requestsDriveFileCreation, validateMessages, webSourceMetadata } from "../api/chat.js";

test("accepts a valid local chat transcript", () => {
  assert.deepEqual(validateMessages([{ role: "user", content: " Hello " }]), [{ role: "user", content: "Hello" }]);
});
test("includes the supported Groq chat model choices", () => {
  assert.deepEqual(ALLOWED_MODELS, ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b", "qwen/qwen3.8-27b"]);
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

test("routes every app named in the latest user turn, not older chat history", () => {
  assert.deepEqual(connectedToolkitsFor([{ role: "user", content: "Check my Gmail, Google Drive and GitHub" }]), ["gmail", "googledrive", "github"]);
  assert.deepEqual(connectedToolkitsFor([{ role: "user", content: "Check my Gmail" }, { role: "assistant", content: "Okay" }, { role: "user", content: "What is 2 + 2?" }]), []);
});

test("Drive creation requires an explicit request in the latest message", () => {
  assert.equal(requestsDriveFileCreation([{ role: "user", content: "In Google Drive create a file with an essay about Leonardo da Vinci" }]), true);
  assert.equal(requestsDriveFileCreation([{ role: "user", content: "In google drice pls create a new file call it an essey: leonardo davinchi" }]), true);
  assert.deepEqual(connectedToolkitsFor([{ role: "user", content: "In google drice create a file" }]), ["googledrive"]);
  assert.equal(requestsDriveFileCreation([{ role: "user", content: "Show my Google Drive files" }]), false);
  assert.equal(requestsDriveFileCreation([{ role: "user", content: "Create a file in Google Drive" }, { role: "assistant", content: "Okay" }, { role: "user", content: "Show my files" }]), false);
});

test("an 18,000-word follow-up remembers the last created Drive document", () => {
  const history = [
    { role: "user", content: "Create an OpenAI essay in Google Drive" },
    { role: "assistant", content: "Created [OpenAI](https://drive.google.com/open?id=1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY) in your Google Drive." },
    { role: "user", content: "It must be 18,000 words" },
  ];
  assert.deepEqual(connectedToolkitsFor(history), ["googledrive"]);
  assert.equal(driveDocumentFollowUpFor(history)?.targetWords, 18_000);
  assert.equal(driveDocumentEditFor(history)?.targetWords, 18_000);
  assert.equal(requestsDriveFileCreation(history), false);
  assert.deepEqual(connectedToolkitsFor([{ role: "user", content: "It must be 18,000 words" }]), []);
  const linkedEdit = [{ role: "user", content: "Edit https://docs.google.com/document/d/1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY/edit to fix the grammar" }];
  assert.deepEqual(connectedToolkitsFor(linkedEdit), ["googledrive"]);
  assert.equal(driveDocumentEditFor(linkedEdit)?.mode, "rewrite");
});

test("a named document from a Drive listing stays selected through 'ok do it'", () => {
  const messages = [
    { role: "assistant", content: "| 1 | *What is happening right now* | [Open](https://docs.google.com/document/d/15B5-i10G7VZsFTkPMpkfxsaEivK5FSgvQfeDTgVmBoI/edit) |\n| 2 | *OpenAI* | [Open](https://docs.google.com/document/d/1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY/edit) |" },
    { role: "user", content: "edit this to 18,000 words What is happening right now" },
    { role: "assistant", content: "Here is a plan you can follow yourself." },
    { role: "user", content: "ok do it" },
  ];
  assert.deepEqual(connectedToolkitsFor(messages), ["googledrive"]);
  assert.deepEqual(driveDocumentEditFor(messages), {
    id: "15B5-i10G7VZsFTkPMpkfxsaEivK5FSgvQfeDTgVmBoI", title: "What is happening right now",
    instruction: "edit this to 18,000 words What is happening right now", targetWords: 18_000, mode: "append",
  });
  const continued = [
    { role: "assistant", content: "I edited [What is happening right now](https://drive.google.com/open?id=15B5-i10G7VZsFTkPMpkfxsaEivK5FSgvQfeDTgVmBoI). It is not yet at the 18,000-word target. Reply continue." },
    { role: "user", content: "continue" },
  ];
  assert.deepEqual(connectedToolkitsFor(continued), ["googledrive"]);
  assert.equal(driveDocumentEditFor(continued)?.targetWords, 18_000);
});

test("a long requested edit starts a verified section and reports progress", async () => {
  const docId = "15B5-i10G7VZsFTkPMpkfxsaEivK5FSgvQfeDTgVmBoI";
  let inserted = false;
  const messages = [
    { role: "assistant", content: `| 1 | *What is happening right now* | [Open](https://docs.google.com/document/d/${docId}/edit) |` },
    { role: "user", content: "edit this to 18,000 words What is happening right now" },
    { role: "assistant", content: "Here is how to do that." },
    { role: "user", content: "ok do it" },
  ];
  const result = await requestGroqWithComposio({
    messages, apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({
      connectedAccounts: { list: async () => ({ items: [{ status: "ACTIVE", toolkit: { slug: "googledocs" } }] }) },
      create: async (_userId, options) => options.toolkits[0] === "googledrive"
        ? { execute: async (_slug, args) => {
          assert.equal(args.document_id, docId);
          return { data: { title: "What is happening right now", body: { content: [{ paragraph: { elements: [{ textRun: { content: inserted ? "Starting text.\n\nA new verified section." : "Starting text." } }] } }] } } };
        } }
        : { execute: async (_slug, args) => { assert.equal(args.document_id, docId); inserted = true; return { successful: true, logId: "log-long-edit" }; } },
    }),
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "A new verified section." } }] }), { status: 200 }),
  });
  assert.equal(inserted, true);
  assert.match(result.content, /not yet at the 18,000-word target/i);
  assert.match(result.content, /continue/i);
  assert.doesNotMatch(result.content, /18,000 words (?:complete|done)/i);
});

test("Drive edit follow-ups ask for the separate Google Docs permission", async () => {
  const history = [
    { role: "assistant", content: "Created [OpenAI](https://drive.google.com/open?id=1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY) in your Google Drive." },
    { role: "user", content: "It must be 18,000 words" },
  ];
  const composioClientFactory = () => ({ connectedAccounts: { list: async () => ({ items: [] }) }, create: async (userId, options) => {
    assert.equal(userId, "alice");
    assert.deepEqual(options.tools, { googledrive: { enable: ["GOOGLEDRIVE_GET_DOCUMENT"] } });
    return { execute: async (slug, args) => {
      assert.equal(slug, "GOOGLEDRIVE_GET_DOCUMENT");
      assert.deepEqual(args, { document_id: "1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY" });
      return { data: { title: "OpenAI", body: { content: [{ paragraph: { elements: [{ textRun: { content: "A short real essay." } }] } }] } }, logId: "log-verified" };
    } };
  } });
  const request = { apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" }, composioClientFactory, fetchImpl: async () => { throw Error("The model must not guess about a verified file"); } };
  const countAnswer = await requestGroqWithComposio({ ...request, messages: history });
  assert.match(countAnswer.content, /editing needs a separate Google Docs connection/i);
  assert.match(countAnswer.content, /\/plugin\/alice\/googledocs/);
  assert.match(countAnswer.content, /haven't changed it/i);
  const correctionAnswer = await requestGroqWithComposio({ ...request, messages: [...history, { role: "assistant", content: "Those links were placeholders." }, { role: "user", content: "Em you just did" }] });
  assert.match(correctionAnswer.content, /statement that the links were placeholders was wrong/i);
});

test("connected Google Docs can append text and verifies the edit", async () => {
  const docId = "1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY";
  let inserted = false;
  const result = await requestGroqWithComposio({
    messages: [
      { role: "assistant", content: `Created [OpenAI](https://drive.google.com/open?id=${docId}) in your Google Drive.` },
      { role: "user", content: "Add a paragraph about the early history" },
    ],
    apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({
      connectedAccounts: { list: async ({ toolkitSlugs }) => {
        assert.deepEqual(toolkitSlugs, ["googledocs"]);
        return { items: [{ status: "ACTIVE", toolkit: { slug: "googledocs" } }] };
      } },
      create: async (_userId, options) => {
        if (options.toolkits[0] === "googledrive") return { execute: async () => ({ data: { title: "OpenAI", body: { content: [{ paragraph: { elements: [{ textRun: { content: inserted ? "Existing text.\n\nThis is the new paragraph about early history." : "Existing text." } }] } }] } } }) };
        assert.deepEqual(options.tools, { googledocs: { enable: ["GOOGLEDOCS_INSERT_TEXT_ACTION"] } });
        return { execute: async (slug, args) => {
          assert.equal(slug, "GOOGLEDOCS_INSERT_TEXT_ACTION");
          assert.equal(args.document_id, docId);
          assert.equal(args.append_to_end, true);
          assert.match(args.text_to_insert, /new paragraph about early history/);
          inserted = true;
          return { successful: true, logId: "log-edit" };
        } };
      },
    }),
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "This is the new paragraph about early history." } }] }), { status: 200 }),
  });
  assert.equal(inserted, true);
  assert.match(result.content, /edited.*verified the update/i);
});

test("a specific edit rewrites a connected Google Doc and verifies it", async () => {
  const docId = "1CCVARE1hJnr4Ved_o-y6E6kD5wobJjzz7heWZ45cPqY";
  let updated = false;
  const history = [
    { role: "assistant", content: `Created [OpenAI](https://drive.google.com/open?id=${docId}) in your Google Drive.` },
    { role: "user", content: "Edit the essay to fix the grammar" },
  ];
  assert.equal(driveDocumentEditFor(history)?.mode, "rewrite");
  const result = await requestGroqWithComposio({
    messages: history, apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({
      connectedAccounts: { list: async () => ({ items: [{ status: "ACTIVE", toolkit: { slug: "googledocs" } }] }) },
      create: async (_userId, options) => options.toolkits[0] === "googledrive"
        ? { execute: async () => ({ data: { title: "OpenAI", body: { content: [{ paragraph: { elements: [{ textRun: { content: updated ? "A revised essay about OpenAI." : "An essay about OpenAI." } }] } }] } } }) }
        : { execute: async (slug, args) => {
          assert.equal(slug, "GOOGLEDOCS_UPDATE_DOCUMENT_MARKDOWN");
          assert.deepEqual(args, { id: docId, markdown: "A revised essay about OpenAI." });
          updated = true;
          return { successful: true, logId: "log-rewrite" };
        } },
    }),
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "A revised essay about OpenAI." } }] }), { status: 200 }),
  });
  assert.equal(updated, true);
  assert.match(result.content, /edited.*verified the update/i);
});

test("creates only the requested Drive document and reports its verified link", async () => {
  const fileId = "1AbCdEfGhIjKlMnOpQrStUv";
  let executed = 0;
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "In Google Drive create a file: an essay about Leonardo da Vinci" }],
    apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async (userId, options) => {
      assert.equal(userId, "alice");
      assert.deepEqual(options.toolkits, ["googledrive"]);
      assert.deepEqual(options.tools, { googledrive: { enable: ["GOOGLEDRIVE_CREATE_FILE_FROM_TEXT"] } });
      assert.deepEqual(options.preload.tools, ["GOOGLEDRIVE_CREATE_FILE_FROM_TEXT"]);
      assert.equal(options.manageConnections, false);
      return {
        tools: async () => [{ type: "function", function: { name: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", parameters: { type: "object" } } }],
        execute: async (name, args) => {
          executed += 1;
          assert.equal(name, "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT");
          assert.deepEqual(args, { file_name: "Essay: Leonardo da Vinci", text_content: "Leonardo da Vinci was an artist and inventor. ".repeat(8).trim(), mime_type: "application/vnd.google-apps.document" });
          return { data: { id: fileId, name: args.file_name }, logId: "log-create" };
        },
      };
    } }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.tool_choice, { type: "function", function: { name: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT" } });
      assert.doesNotMatch(body.messages[0].content, /Only read-only app tools are enabled/);
      return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", arguments: JSON.stringify({ file_name: "Essay: Leonardo da Vinci", text_content: "Leonardo da Vinci was an artist and inventor. ".repeat(8).trim(), parent_id: "not-allowed" }) } }] } }] }), { status: 200 });
    },
  });
  assert.equal(executed, 1);
  assert.match(result.content, new RegExp(fileId));
});

test("does not claim Drive creation when the provider returns no file ID", async () => {
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "Create a Google Drive essay file" }],
    apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async () => ({
      tools: async () => [{ type: "function", function: { name: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT" } }],
      execute: async () => ({ data: { name: "Essay" }, logId: "log-no-id" }),
    }) }),
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: "GOOGLEDRIVE_CREATE_FILE_FROM_TEXT", arguments: JSON.stringify({ file_name: "Essay", text_content: "A".repeat(150) }) } }] } }] }), { status: 200 }),
  });
  assert.match(result.content, /can't confirm/i);
  assert.doesNotMatch(result.content, /^Created /i);
});

test("runs connected-app tool calls and returns the model's grounded answer", async () => {
  const requests = [];
  let executed = 0;
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "Check my emails" }],
    apiKey: "test-key",
    userId: "alice",
    env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async (userId, options) => {
      assert.equal(userId, "alice");
      assert.deepEqual(options.toolkits, ["gmail"]);
      assert.deepEqual(options.tags, ["readOnlyHint"]);
      return {
        search: async ({ query, toolkits }) => {
          assert.match(query, /Check my emails/);
          assert.deepEqual(toolkits, ["gmail"]);
          return { results: [{ primaryToolSlugs: ["GMAIL_FETCH_EMAILS"], relatedToolSlugs: [] }], toolkitConnectionStatuses: [{ toolkit: "gmail", hasActiveConnection: true }] };
        },
        update: async (config) => assert.deepEqual(config, { preload: { tools: ["GMAIL_FETCH_EMAILS"] } }),
        tools: async () => [{ type: "function", function: { name: "GMAIL_FETCH_EMAILS", parameters: { type: "object" } } }],
        execute: async (name, args) => {
          executed += 1;
          assert.equal(name, "GMAIL_FETCH_EMAILS");
          assert.deepEqual(args, { query: "in:inbox newer_than:2d" });
          return { data: { messages: [{ subject: "Test inbox result" }] }, logId: "log-test" };
        },
      };
    } }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (requests.length === 1) {
        assert.equal(body.tools.length, 1);
        assert.equal(body.max_completion_tokens, 450);
        assert.deepEqual(body.tool_choice, { type: "function", function: { name: "GMAIL_FETCH_EMAILS" } });
        return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "GMAIL_FETCH_EMAILS", arguments: JSON.stringify({ query: "in:inbox newer_than:2d" }) } }] } }] }), { status: 200 });
      }
      assert.equal(body.tools, undefined);
      assert.match(body.messages.at(-1).content, /Test inbox result/);
      return new Response(JSON.stringify({ choices: [{ message: { content: "I found your inbox results." } }] }), { status: 200 });
    },
  });
  assert.equal(executed, 1);
  assert.equal(requests.length, 2);
  assert.equal(result.content, "I found your inbox results.");
});

test("checks Gmail, Drive, and GitHub instead of answering before a tool call", async () => {
  const names = { gmail: "GMAIL_READ", googledrive: "GOOGLEDRIVE_FIND_FILE", github: "GITHUB_LIST" };
  const executed = [];
  const requests = [];
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "Check my Gmail Google Drive and GitHub; tell me what you see" }],
    apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async (userId, options) => {
      assert.equal(userId, "alice");
      const toolkit = options.toolkits[0];
      return {
        search: async ({ toolkits }) => ({ results: [{ primaryToolSlugs: [names[toolkit]], relatedToolSlugs: [] }], toolkitConnectionStatuses: [{ toolkit, hasActiveConnection: true }] }),
        update: async ({ preload }) => assert.deepEqual(preload.tools, [names[toolkit]]),
        tools: async () => [{ type: "function", function: { name: names[toolkit], parameters: { type: "object" } } }],
        execute: async (name, args) => {
          executed.push(name);
          if (toolkit === "googledrive") {
            assert.deepEqual(args, { q: "trashed = false", page_size: 10 });
            return { data: { files: [{ name: "OpenAI", mimeType: "application/vnd.google-apps.document" }] }, logId: "log-googledrive" };
          }
          return { data: { items: [`${toolkit}-item`] }, logId: `log-${toolkit}` };
        },
      };
    } }),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      if (body.tools) {
        const name = body.tools[0].function.name;
        assert.deepEqual(body.tool_choice, { type: "function", function: { name } });
        return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: "{}" } }] } }] }), { status: 200 });
      }
      assert.match(body.messages.at(-1).content, /gmail-item/);
      assert.match(body.messages.at(-1).content, /OpenAI/);
      assert.match(body.messages.at(-1).content, /github-item/);
      return new Response(JSON.stringify({ choices: [{ message: { content: "I checked all three apps." } }] }), { status: 200 });
    },
  });
  assert.deepEqual(executed, ["GMAIL_READ", "GOOGLEDRIVE_FIND_FILE", "GITHUB_LIST"]);
  assert.equal(requests.length, 3);
  assert.equal(result.content, "I checked all three apps.");
});

test("does not present a model refusal as a connected-app result", async () => {
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "Check my Gmail" }], apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async () => ({
      search: async () => ({ results: [{ primaryToolSlugs: ["GMAIL_READ"], relatedToolSlugs: [] }], toolkitConnectionStatuses: [{ toolkit: "gmail", hasActiveConnection: true }] }),
      update: async () => {}, tools: async () => [{ type: "function", function: { name: "GMAIL_READ" } }],
      execute: async () => { throw new Error("Must not execute without a model tool call"); },
    }) }),
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "I don't have access." } }] }), { status: 200 }),
  });
  assert.match(result.content, /did not call the connected-app tool/i);
  assert.doesNotMatch(result.content, /don't have access/i);
});

test("connection-only checks confirm success without exposing provider item details", async () => {
  let calls = 0;
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "Gmail connection test: only report whether it works" }], apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async () => ({
      search: async () => ({ results: [{ primaryToolSlugs: ["GMAIL_READ"], relatedToolSlugs: [] }], toolkitConnectionStatuses: [{ toolkit: "gmail", hasActiveConnection: true }] }),
      update: async () => {}, tools: async () => [{ type: "function", function: { name: "GMAIL_READ" } }],
      execute: async () => ({ data: { secretSubject: "Do not expose this" }, logId: "log-test" }),
    }) }),
    fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ id: "call-1", type: "function", function: { name: "GMAIL_READ", arguments: "{}" } }] } }] }), { status: 200 }); },
  });
  assert.equal(calls, 1);
  assert.match(result.content, /Gmail: Read-only lookup succeeded/);
  assert.doesNotMatch(result.content, /secretSubject|Do not expose/);
});

test("does not repeat an access denial after a verified tool result", async () => {
  let calls = 0;
  const result = await requestGroqWithComposio({
    messages: [{ role: "user", content: "Check my Gmail inbox" }], apiKey: "test-key", userId: "alice", env: { COMPOSIO_API_KEY: "test-composio-key" },
    composioClientFactory: () => ({ create: async () => ({
      search: async () => ({ results: [{ primaryToolSlugs: ["GMAIL_READ"], relatedToolSlugs: [] }], toolkitConnectionStatuses: [{ toolkit: "gmail", hasActiveConnection: true }] }),
      update: async () => {}, tools: async () => [{ type: "function", function: { name: "GMAIL_READ" } }],
      execute: async () => ({ data: { messages: ["test"] }, logId: "log-test" }),
    }) }),
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ message: calls === 1
        ? { tool_calls: [{ id: "call-1", type: "function", function: { name: "GMAIL_READ", arguments: "{}" } }] }
        : { content: "I don't have access to your Gmail account." } }] }), { status: 200 });
    },
  });
  assert.equal(calls, 2);
  assert.match(result.content, /received read-only results from gmail/i);
  assert.doesNotMatch(result.content, /don't have access/i);
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
  assert.equal(request.reasoning_effort, "low");
  assert.equal(createGroqRequest({ messages: [{ role: "user", content: "Check GitHub" }], tools: [{ type: "function", function: { name: "READ_REPO" } }] }).reasoning_effort, "medium");
});

test("keeps search results available even when the model omits citation markers", () => {
  const sources = [{ title: "Retail listing", url: "https://example.com/ram", content: "A listed price." }];
  assert.deepEqual(webSourceMetadata("Prices vary.", sources), [{ title: "Retail listing", url: "https://example.com/ram", excerpt: "A listed price.", cited: false }]);
  assert.equal(webSourceMetadata("The listing is $100 [1].", sources)[0].cited, true);
  assert.equal(webSourceMetadata("The listing is $100 【1】.", sources)[0].cited, true);
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

test("turns provider tool conflicts into a useful model recovery message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Tool choice is none, but model called a tool" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(
      requestGroqStream({ messages: [{ role: "user", content: "Hello" }], apiKey: "test-key" }),
      (error) => error.code === "MODEL_TOOL_CONFLICT" && /GPT-OSS 20B/.test(error.message),
    );
  } finally { globalThis.fetch = originalFetch; }
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
