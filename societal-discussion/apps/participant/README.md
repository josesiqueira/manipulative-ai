# Participant app (Astro)

The public side of Vaalikeskustelu for the Metso demo (spec: `docs/superpowers/specs/2026-10-16-metso-v3-design.md`). The Next.js app in `../web` keeps the admin panel.

Pages, each under `/fi/` and `/en/`: landing, `consent`, `declined`, `chat` (placeholder until card M7), `info/privacy-notice`, `info/research-notification`. `/` sends the visitor to the stored language.

## Commands

The app is a workspace of `societal-discussion/package.json`; `npm install` at that root installs it, and the lock file is the root one.

```
npm install
npm run dev          # http://localhost:4321, API at PUBLIC_API_URL (default http://localhost:8000)
npm run check        # astro check (types)
npm run build        # dist/, served by: node dist/server/entry.mjs
npm test             # Playwright, builds the app with a same-origin API URL and mocks /api/*
```

Browser tests need Playwright's Chromium once: `npx playwright install chromium`.

## Build-time values

- `PUBLIC_API_URL`: the FastAPI origin the browser calls. Inlined by `astro build`, so a change means a rebuild (the Dockerfile takes it as a build argument).
- `PUBLIC_PROVIDER_BLOCK`: `finnish` (default; the model runs on Tampere University servers, two consent checkboxes) or `openai` (three checkboxes and the OpenAI texts in the notices). Also inlined at build time; this is the V11a switch and it is applied per image build.

## Content

- `src/lib/studyConfig.ts`: facts that the DPO or ethics committee may still change (card M10).
- `src/lib/providerNotice.ts`: every provider-specific sentence, both blocks.
- `src/content/notices/*.md`: the full privacy notice and research notification from the consent package, with `{{RETENTION_END}}` and the provider fences filled at build time. Square-bracket items are open human decisions (M10).
- `public/tampere/`: Tampere University logo files, unchanged; rules in `../../../tampere/README.md`.
