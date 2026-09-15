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

The deployable static output is written to `dist/client`.

## Vercel

The project includes `vercel.json` with the build command, output directory, and SPA rewrites. Vercel Web Analytics and Speed Insights are mounted through their React integrations and begin collecting data after deployment and a site visit.
