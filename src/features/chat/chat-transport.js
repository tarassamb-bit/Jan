export function chatRequestError(payload, fallback = 'Jan could not respond. Please try again.') {
  return Object.assign(new Error(payload?.error || fallback), { code: payload?.code });
}

export async function requestChat({ client, user, messages, model, preferences, memories, signal, onDelta = () => {}, onUsage = () => {}, fetchImpl = fetch }) {
  if (user?.is_demo) throw chatRequestError({ code: 'AUTH_REQUIRED', error: 'Sign in to send messages. Live AI is unavailable in the local demo.' });
  const { data, error } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw chatRequestError({ code: 'AUTH_REQUIRED', error: 'Please sign in again to send messages.' });
  const response = await fetchImpl('/api/chat', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages, model, stream: preferences?.response_streaming !== false, preferences, memories }),
  });
  const usage = response.headers.get('X-Jan-Usage');
  if (usage) { try { onUsage(JSON.parse(usage)); } catch { /* A malformed optional header must not discard the response. */ } }
  if (!response.ok) throw chatRequestError(await response.json().catch(() => ({})));
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    const payload = await response.json();
    if (!payload.content?.trim()) throw new Error('Jan returned an empty response. Please try again.');
    onDelta(payload.content);
    return payload.content;
  }
  if (!response.body) throw new Error('Jan could not start a response stream.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', content = '', finished = false;
  const event = (block) => {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
    if (!data) return;
    if (data === '[DONE]') { finished = true; return; }
    const payload = JSON.parse(data);
    if (payload.error) throw chatRequestError({ error: payload.error.message || 'The response was interrupted.' });
    const delta = payload.choices?.[0]?.delta?.content;
    if (delta) { content += delta; onDelta(content); }
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      blocks.forEach(event);
      if (done) break;
    }
    if (buffer.trim()) event(buffer);
    if (!finished) throw new Error('The response was interrupted. Your partial answer has been kept.');
    if (!content.trim()) throw new Error('Jan returned an empty response. Please try again.');
    return content;
  } finally { reader.releaseLock(); }
}

// Keep the question before bounded source excerpts so compaction preserves it.
export function buildMessageContent(message, extraAttachments = []) {
  if (message.role === 'assistant') return message.content;
  const attachments = [...(message.attachments || []), ...extraAttachments];
  const question = message.content || 'Please analyze the attached files.';
  const imageCandidates = attachments.filter((file) => file.vision && file.dataUrl);
  const images = [...imageCandidates].sort((left, right) => Number(question.toLowerCase().includes(right.name.toLowerCase())) - Number(question.toLowerCase().includes(left.name.toLowerCase()))).slice(0, 3);
  const omittedImages = imageCandidates.filter((file) => !images.includes(file));
  const sources = attachments.filter((file) => !file.vision || !file.dataUrl);
  const perFile = Math.max(0, Math.floor((8000 - question.length) / Math.max(1, sources.length)) - 120);
  const text = [question, ...sources.map((file) => `\nSource: ${file.name}\n${(file.content || '[Contents unavailable. Ask the user to attach this file again.]').slice(0, perFile)}`), ...(omittedImages.length ? [`\nOther project images were omitted because this model accepts three images per message: ${omittedImages.map((file) => file.name).join(', ')}.`] : [])].join('\n');
  return images.length ? [{ type: 'text', text }, ...images.map((file) => ({ type: 'image_url', image_url: { url: file.dataUrl } }))] : text;
}

export function buildChatMessages(messages, sources = []) {
  return messages.slice(-20).map((message, index, all) => ({ role: message.role, content: buildMessageContent(message, index === all.length - 1 ? sources : []) }));
}
