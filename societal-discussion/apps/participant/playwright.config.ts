import { defineConfig, devices } from '@playwright/test';

// The app is built with PUBLIC_API_URL pointing at the preview server itself,
// so the tests answer /api/* with page.route handlers (no backend needed) and
// no cross-origin preflight gets in the way.
const ORIGIN = 'http://127.0.0.1:4321';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  use: { baseURL: ORIGIN, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `PUBLIC_API_URL=${ORIGIN} npm run build && HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs`,
    url: `${ORIGIN}/fi/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
