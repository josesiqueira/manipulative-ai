// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// Every page is prerendered (output 'static'); the Node adapter only serves
// the built files in one container and keeps the door open for server
// endpoints in the chat page.
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    // With PUBLIC_API_URL empty the page calls /api on its own origin and the
    // dev server forwards it to the API, so one HTTPS tunnel serves a phone test.
    server: {
      proxy: { '/api': { target: process.env.DEV_API_URL ?? 'http://localhost:8000', changeOrigin: true } },
      // A temporary HTTPS tunnel (cloudflared) for phone tests of the dev server.
      allowedHosts: ['.trycloudflare.com'],
    },
  },
});
