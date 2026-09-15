# Jan website recreation

A responsive, self-contained React recreation of the Jan website. The homepage follows the captured Jan design, while Docs, Research, Tokamak, Company, and related routes use local mock content.

## Local development

```bash
npm install
npm run dev
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
```

Run [`supabase-schema.sql`](./supabase-schema.sql) in the Supabase SQL Editor after pulling these changes. It safely adds the `attachments` column used to retain file metadata alongside chat messages.

Never prefix the Groq key with `VITE_`; doing so would expose it in the browser bundle. Real accounts use Supabase Auth; the visible demo option stores only a local browser session and is intended for trying the UI without signing up.

## Tests

```bash
npm run test:chat
npm run test:sites
```
