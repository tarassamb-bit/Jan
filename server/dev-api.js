import { handleChat } from '../api/chat.js';

// Development and Vercel use the same authentication, quota and provider handler.
export function localChatApi(env) {
  return {
    name: 'local-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        res.status = (code) => { res.statusCode = code; return res; };
        res.json = (body) => { res.end(JSON.stringify(body)); return res; };
        try {
          if (req.method === 'POST') {
            let size = 0;
            const chunks = [];
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 4_000_000) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Request is too large.' })); return; }
              chunks.push(chunk);
            }
            try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
            catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Request body must be valid JSON.' })); return; }
          }
          await handleChat(req, res, { env });
        } catch {
          if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          if (!res.writableEnded) res.end(JSON.stringify({ error: 'Chat is temporarily unavailable.' }));
        }
      });
    },
  };
}
