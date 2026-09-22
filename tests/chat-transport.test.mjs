import test from 'node:test';
import assert from 'node:assert/strict';
import { requestChat, buildChatMessages } from '../src/features/chat/chat-transport.js';
import { serializeAttachments, restoreAttachments, loadProjectSources } from '../src/features/chat/chat-file-storage.js';

const client = { auth: { getSession: async () => ({ data: { session: { access_token: 'session-token' } } }) } };
const user = { id: 'alice' };
const input = [{ role: 'user', content: 'Explain this' }];

test('restored text attachments contribute their contents on later turns', () => {
  const saved = serializeAttachments([{ name: 'brief.txt', type: 'text/plain', size: 12, content: 'The launch is Tuesday.', preview: 'blob:stale' }]);
  assert.equal(saved[0].preview, undefined);
  const transcript = buildChatMessages([{ role: 'user', content: 'Summarize', attachments: restoreAttachments(saved) }, { role: 'assistant', content: 'Sure' }, { role: 'user', content: 'When is the launch?' }]);
  assert.match(transcript[0].content, /launch is Tuesday/);
  assert.equal(transcript[2].content, 'When is the launch?');
});

test('loads a compressed project source and includes its text', async () => {
  const file = new File(['The answer is 42.'], 'answer.txt', { type: 'text/plain' });
  const compressed = await new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const storage = { from: () => ({ download: async () => ({ data: compressed, error: null }) }) };
  const sources = await loadProjectSources({ files: [{ name: 'answer.txt', path: 'alice/p/answer.gz', type: 'text/plain', compression: 'gzip' }] }, { storage }, false);
  assert.match(buildChatMessages(input, sources)[0].content, /answer is 42/);
});

test('prioritizes a named project image within the three image model limit', () => {
  const images = ['one', 'two', 'three', 'four'].map((name) => ({ name: `${name}.webp`, vision: true, dataUrl: 'data:image/webp;base64,AA==' }));
  const content = buildChatMessages([{ role: 'user', content: 'What is in four.webp?' }], images)[0].content;
  assert.equal(content.filter((part) => part.type === 'image_url').length, 3);
  assert.match(content[0].text, /three.webp/);
});

test('sends bearer token and follows the streaming preference', async () => {
  for (const streaming of [false, true]) {
    let options;
    const response = streaming
      ? new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream', 'X-Jan-Usage': '{"messages":1,"uploads":0}' } })
      : new Response(JSON.stringify({ content: 'Hi' }), { headers: { 'content-type': 'application/json' } });
    let usage;
    const content = await requestChat({ client, user, messages: input, preferences: { response_streaming: streaming }, onUsage: (value) => { usage = value; }, fetchImpl: async (_, request) => { options = request; return response; } });
    assert.equal(content, 'Hi');
    assert.equal(options.headers.Authorization, 'Bearer session-token');
    assert.equal(JSON.parse(options.body).stream, streaming);
    if (streaming) assert.equal(usage.messages, 1);
  }
});

test('denies demo and unsigned sessions before network requests', async () => {
  await assert.rejects(requestChat({ client, user: { is_demo: true }, messages: input, fetchImpl: () => { throw Error('network'); } }), /Sign in/);
  await assert.rejects(requestChat({ client: { auth: { getSession: async () => ({ data: {} }) } }, user, messages: input, fetchImpl: () => { throw Error('network'); } }), /sign in/i);
});

test('reports an interrupted stream while keeping the partial text for the caller', async () => {
  let partial = '';
  await assert.rejects(requestChat({ client, user, messages: input, preferences: { response_streaming: true }, onDelta: (text) => { partial = text; }, fetchImpl: async () => new Response('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n', { headers: { 'content-type': 'text/event-stream' } }) }), /interrupted/);
  assert.equal(partial, 'Partial');
});
