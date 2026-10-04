# Chat feature

All chat behavior lives here:

- `ChatPage.jsx` — chat screen and UI orchestration
- `chat-storage.js` — browser persistence and demo-account state
- `chat-file-storage.js` — attachment parsing, compression, and project files
- `chat-transport.js` — chat API requests and message formatting
- `useConversationMessages.js` — conversation message loading hook

Jan uses Groq for chat responses. Current-information questions can use a
bounded Firecrawl search: one search request and, only when price snippets are
insufficient, up to two concurrent page scrapes. Search failures fall back to a
normal answer instead of blocking the chat.
