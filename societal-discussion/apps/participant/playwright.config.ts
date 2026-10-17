import { defineConfig, devices } from '@playwright/test';

// The app is built with PUBLIC_API_URL pointing at the preview server itself,
// so the tests answer /api/* with page.route handlers (no backend needed) and
// no cross-origin preflight gets in the way.
const ORIGIN = 'http://127.0.0.1:4321';
// A second build with PUBLIC_PROVIDER_BLOCK=openai proves the V11a fallback screen.
const OPENAI_ORIGIN = 'http://127.0.0.1:4322';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  // Software WebGL in several browsers at once starves the page scripts; keep the load moderate.
  workers: 3,
  retries: 0,
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    // Fake microphone and software WebGL for the chat page tests.
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', testIgnore: /openai/, use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', testIgnore: /openai/, use: { ...devices['Pixel 7'] } },
    { name: 'openai-block', testMatch: /openai/, use: { ...devices['Pixel 7'], baseURL: OPENAI_ORIGIN } },
  ],
  webServer: [
    {
      command: `PUBLIC_API_URL=${ORIGIN} npm run build && HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs`,
      url: `${ORIGIN}/fi/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `PUBLIC_API_URL=${OPENAI_ORIGIN} PUBLIC_PROVIDER_BLOCK=openai npx astro build --outDir dist-openai && HOST=127.0.0.1 PORT=4322 node dist-openai/server/entry.mjs`,
      url: `${OPENAI_ORIGIN}/fi/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
