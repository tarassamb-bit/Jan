import { handleChat } from '../api/chat.js';
import { handleConnectors } from '../api/connectors.js';
import { handlePromos } from '../api/promos.js';

// Development and Vercel use the same authentication, quota and provider handler.
export function localChatApi(env) {
  return {
    name: 'local-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/promos', async (req, res) => {
        res.originalUrl = req.originalUrl || `/api/promos${req.url || ''}`;
        if (req.method === 'POST') {
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 16_000) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Request is too large.' })); return; }
            chunks.push(chunk);
          }
          try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
          catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Request body must be valid JSON.' })); return; }
        }
        try { await handlePromos(req, res, { env }); }
        catch {
          if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Promo service is temporarily unavailable.' })); }
        }
      });
      server.middlewares.use('/api/connectors', async (req, res) => {
        res.originalUrl = req.originalUrl || `/api/connectors${req.url || ''}`;
        if (!res.writableEnded && req.method === 'POST') {
          let size = 0;
          const chunks = [];
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 64_000) { res.statusCode = 413; res.end(JSON.stringify({ error: 'Request is too large.' })); return; }
            chunks.push(chunk);
          }
          try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
          catch { res.statusCode = 400; res.end(JSON.stringify({ error: 'Request body must be valid JSON.' })); return; }
        }
        try { await handleConnectors(req, res, { env }); }
        catch {
          if (!res.headersSent) { res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Connector service is temporarily unavailable.' })); }
        }
      });
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
