# Jan website recreation

A responsive, self-contained React recreation of the Jan website. The homepage follows the captured Jan design, while Docs, Research, Tokamak, Company, and related routes use local mock content.

## Local development

```bash
npm install
npm run dev
```

## Project layout

The code is grouped by responsibility so folder and file names describe their contents:

```text
src/
  components/       shared UI components
    settings/       account and workspace settings UI
  features/chat/    chat page, storage, files, and API transport
  features/docs/    documentation content and routes
  styles/           global and feature-specific styles
  lib/              shared service clients
api/                deployed API functions
server/             local development server helpers
worker/             sites/worker deployment code
scripts/            build and deployment scripts
tests/              automated tests
public/assets/      static images, icons, and fonts
supabase/           database schema migrations
```

## Production build

```bash
npm run build
```

The deployable frontend output is written to `dist/client`. The Groq proxy is deployed from `api/chat.js` as a Vercel Function.

## Vercel

The project includes `vercel.json` with the build command, output directory, and SPA rewrites. Vercel Web Analytics and Speed Insights are mounted through their React integrations and begin collecting data after deployment and a site visit.

Add these environment variables in Vercel before using live chat:

```text
GROQ_API_KEY=your_server_side_key
GROQ_MODEL=openai/gpt-oss-20b
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_server_side_service_role_key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_public_anon_key
```

Run [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL Editor for a new database. For an existing database, apply [`20260917_chat_reliability.sql`](./supabase/migrations/20260917_chat_reliability.sql) before using live chat. The migration makes daily limits authoritative and adds saved project chat attachments. Chat requests require a Supabase access token, and the server consumes one message per request. Uploaded normal chat files and project files each consume one of the three daily uploads when their database record is saved. Project images are resized and stored as WebP; text-like files are stored as gzip; PDFs and other already-compressed formats are retained unchanged.

Never prefix the Groq key with `VITE_`; doing so would expose it in the browser bundle. Real accounts use Supabase Auth; the visible demo option stores only a local browser session and is intended for trying the UI without signing up.

## Tests

```bash
npm run test:chat
npm run test:sites
```
