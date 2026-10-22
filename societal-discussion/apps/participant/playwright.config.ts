import { defineConfig, devices } from '@playwright/test';

// The app is built with PUBLIC_API_URL pointing at the preview server itself,
// so the tests answer /api/* with page.route handlers (no backend needed) and
// no cross-origin preflight gets in the way.
const ORIGIN = 'http://127.0.0.1:4321';
// REAL_API=1 runs tests/real-flow.spec.ts against servers already running
// (see that file); no build and no fake.
const REAL = process.env.REAL_API === '1';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  // Software WebGL in several browsers at once starves the page scripts; keep the load moderate.
  workers: 3,
  retries: 0,
  use: {
    baseURL: REAL ? (process.env.REAL_APP_URL ?? ORIGIN) : ORIGIN,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['microphone'],
    // Fake microphone and software WebGL for the chat page tests.
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: REAL ? undefined : [
    {
      command: `PUBLIC_API_URL=${ORIGIN} npm run build && HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs`,
      url: `${ORIGIN}/fi/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
