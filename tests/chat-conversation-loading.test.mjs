import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useConversationMessages } from '../src/features/chat/useConversationMessages.js';

test('switching conversations ignores an older response and restores attachment content', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost:5174/chat' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const pending = new Map();
  const signals = new Map();
  const client = { from: () => ({ select: () => ({ eq: (_key, id) => ({ order: () => ({ abortSignal: (signal) => {
    signals.set(id, signal);
    return new Promise((resolve) => pending.set(id, resolve));
  } }) }) }) }) };
  const user = { id: 'account-1' };
  function Harness({ id }) {
    const [messages, setMessages] = useState([]);
    const [loading, setMessagesLoading] = useState(false);
    const [error, setError] = useState('');
    const creatingConversationRef = useRef(null);
    useConversationMessages({ conversationId: id, user, client, creatingConversationRef, setMessages, setMessagesLoading, setError });
    return React.createElement('div', null, JSON.stringify({ messages, loading, error }));
  }
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(Harness, { id: 'first' })));
    await act(async () => root.render(React.createElement(Harness, { id: 'second' })));
    assert.equal(signals.get('first').aborted, true);
    assert.match(document.body.textContent, /"messages":\[\]/);
    await act(async () => pending.get('second')({ data: [{ id: 'new', role: 'user', content: 'second chat', attachments: [{ name: 'notes.txt', content: 'source text' }] }], error: null }));
    await act(async () => pending.get('first')({ data: [{ id: 'old', role: 'user', content: 'first chat' }], error: null }));
    assert.match(document.body.textContent, /second chat/);
    assert.match(document.body.textContent, /source text/);
    assert.doesNotMatch(document.body.textContent, /first chat/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
