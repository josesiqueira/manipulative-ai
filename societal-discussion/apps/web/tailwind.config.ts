import type { Config } from 'tailwindcss';
// Design system tokens — single source of truth for all visual values.
// See apps/web/design-system/tokens.css for the CSS custom property equivalents.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const designTokens = require('./design-system/tailwind-tokens.js');

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      ...designTokens,
    },
  },
  plugins: [],
};

export default config;
