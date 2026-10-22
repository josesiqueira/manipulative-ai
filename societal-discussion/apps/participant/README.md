# Participant app (Astro)

The public side of Vaalikeskustelu for the Metso demo. The Next.js app in `../web` keeps the admin panel.

Pages, each under `/fi/` and `/en/`: landing, `consent`, `declined`, `chat`, `info/privacy-notice`, `info/research-notification`. `/` sends the visitor to the stored language.

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

The model provider is chosen at run time, not at build time: the consent page, both notices and the thank-you page carry the texts of all three providers (`openai`, `anthropic`, `gptlab`), and the page asks `GET /api/provider` which one answers now. The consent page keeps Start disabled until it knows, shows the transfer checkbox only for a provider outside the EU (OpenAI, Anthropic), and stores the provider with the consent as `consent_version` `<version>+<provider>`. The thank-you page shows one technical note per provider listed in the debrief's `models`.

## Content

- `src/lib/studyConfig.ts`: facts that the DPO or ethics committee may still change.
- `src/lib/providerNotice.ts`: every provider-specific sentence, three blocks; `src/lib/provider.ts` shows the block of the provider that answers and fills the model name.
- `src/content/notices/*.md`: the full privacy notice and research notification from the consent package, with `{{RETENTION_END}}` filled at build time and the provider fences filled with all three blocks, one shown at run time. Square-bracket items are open decisions of the research team.
- `public/tampere/`: Tampere University logo files, unchanged; rules in `../../../tampere/README.md`.

## Chat page

`src/pages/[lang]/chat.astro` with the logic in `src/scripts/chat.ts`: consent guard, a typed turn (text box) or a spoken turn (hold the microphone button; the recording goes to `POST /api/speech/transcribe` and the text is sent as an ordinary message with `input_mode: spoken`), the reply shown as text and spoken sentence by sentence (`POST /api/speech/synthesize` per sentence, played through the avatar). The avatar is TalkingHead (`src/vendor/talkinghead`, MIT) with the head in `public/avatar/man.glb`; if WebGL or the file fails, the still image `man-still.png` is shown and the voice still plays (`data-avatar-mode` on the stage says which). One AudioContext is unlocked on the first tap release; the microphone is open only while the button is held.

## Phone test from a laptop

The microphone needs HTTPS, so a phone cannot test against `http://<laptop-ip>`. With the API running on port 8000 and `PUBLIC_API_URL=` (empty) the dev server proxies `/api` to it, and one HTTPS tunnel is enough:

```
cd societal-discussion/apps/api && uv run uvicorn src.main:app --port 8000   # SPEECH_MODELS_DIR must hold the voices
cd societal-discussion/apps/participant && PUBLIC_API_URL= npm run dev
cloudflared tunnel --url http://localhost:4321   # prints an https://...trycloudflare.com address for the phone
```

Add the tunnel origin to the API's `CORS_ORIGINS` only if the API is called directly; through the proxy it is same-origin.
