import { useEffect } from 'react';
import { restoreAttachments } from './files.js';
import { readDemoMessages } from './storage.js';

export function useConversationMessages({ conversationId, user, client, creatingConversationRef, setMessages, setMessagesLoading, setError }) {
  useEffect(() => {
    if (creatingConversationRef.current === conversationId && conversationId) return;
    let cancelled = false;
    const controller = new AbortController();
    setMessages([]);
    setMessagesLoading(Boolean(conversationId));
    if (!conversationId) return () => controller.abort();
    if (user?.is_demo) {
      setMessages(readDemoMessages(conversationId).map((message) => ({ ...message, attachments: restoreAttachments(message.attachments) })));
      setMessagesLoading(false);
      return () => controller.abort();
    }
    (async () => {
      try {
        const { data, error } = await client.from('messages').select('*').eq('conversation_id', conversationId)
          .order('created_at', { ascending: true }).abortSignal(controller.signal);
        if (cancelled) return;
        if (error) setError('Couldn’t load this conversation. Open it again to retry.');
        else setMessages((data || []).map((message) => ({ ...message, attachments: restoreAttachments(message.attachments) })));
      } catch {
        if (!cancelled) setError('Couldn’t load this conversation. Open it again to retry.');
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [conversationId, user, client, creatingConversationRef, setMessages, setMessagesLoading, setError]);
}
