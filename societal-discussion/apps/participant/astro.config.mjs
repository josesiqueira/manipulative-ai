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
  vite: { plugins: [tailwindcss()] },
});
