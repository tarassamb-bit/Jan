import test from 'node:test';
import assert from 'node:assert/strict';
import { findWebSources, linkSourceCitations, searchQueryFor } from '../server/web-search.js';

test('searches changing facts but not ordinary or capability questions', () => {
  assert.equal(searchQueryFor([{ role: 'user', content: 'Explain photosynthesis' }]), '');
  assert.equal(searchQueryFor([{ role: 'user', content: 'Can you search the web?' }]), '');
  assert.equal(searchQueryFor([{ role: 'user', content: 'What is the price of 512GB DDR5 RAM right now?' }]), 'What is the price of 512GB DDR5 RAM right now?');
});

test('uses one search and skips scraping when snippets already contain a price', async () => {
  const calls = [];
  const sources = await findWebSources('price of a unique 32GB test RAM kit', 'secret', {
    locale: 'en-US',
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ success: true, data: { web: [
        { title: 'Retail listing', url: 'https://example.com/ram', description: '32GB DDR5 kit costs $109.99.' },
      ] } }), { status: 200 });
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.limit, 3);
  assert.match(calls[0].body.query, /USD current retailer/i);
  assert.equal(sources.length, 1);
});

test('scrapes at most two pages and retains snippets when scraping fails', async () => {
  const calls = [];
  const sources = await findWebSources('cost of a unique 512GB test kit', 'secret', {
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.endsWith('/search')) return new Response(JSON.stringify({ success: true, data: { web: [
        { title: 'A', url: 'https://example.com/a', description: 'Product A' },
        { title: 'B', url: 'https://example.com/b', description: 'Product B' },
        { title: 'C', url: 'https://example.com/c', description: 'Product C' },
      ] } }), { status: 200 });
      return new Response('{}', { status: 500 });
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(sources.length, 3);
  assert.equal(sources[0].content, 'Product A');
});

test('search failure is a safe empty result and citations use supplied URLs', async () => {
  assert.deepEqual(await findWebSources('latest unique failure test', 'secret', { fetchImpl: async () => { throw new Error('offline'); } }), []);
  assert.equal(linkSourceCitations('Current result [1].', [{ title: 'Report', url: 'https://example.org/report', content: 'Current result' }]), 'Current result [¹](<https://example.org/report>).');
  assert.equal(linkSourceCitations('Current result 【1】.', [{ title: 'Report', url: 'https://example.org/report', content: 'Current result' }]), 'Current result [¹](<https://example.org/report>).');
});
