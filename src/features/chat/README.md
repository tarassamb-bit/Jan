# Chat feature

All chat behavior lives here:

- `ChatPage.jsx` — chat screen and UI orchestration
- `chat-storage.js` — browser persistence and demo-account state
- `chat-file-storage.js` — attachment parsing, compression, and project files
- `chat-transport.js` — chat API requests and message formatting
- `useConversationMessages.js` — conversation message loading hook

Live web search is handled server-side in `server/web-search.js` using `TAVILY_API_KEY`.
Jan searches automatically for explicit or time-sensitive requests; the composer’s
Web button forces one search for the next message. Results are passed to Groq as
untrusted context. The answer includes a separate list of links found by search;
those links are not a guarantee that every answer claim is supported. If no usable
excerpts are returned, Jan says so without asking Groq to guess. Repeated queries
are cached briefly in each server process to conserve credits. A basic Tavily search
normally uses one credit when it reaches Tavily. Add the key to your deployment’s server environment
as well as local `.env`; never expose it with a `VITE_` prefix.
