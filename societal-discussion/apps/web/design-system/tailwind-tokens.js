/**
 * tailwind-tokens.js — SYNTHETICA Admin Panel
 *
 * Maps design-system tokens to Tailwind's theme config. Import this into
 * tailwind.config.ts to keep both systems in sync.
 *
 * Usage in tailwind.config.ts:
 *   import tokens from './design-system/tailwind-tokens.js';
 *   export default { theme: { extend: tokens } };
 *
 * These values mirror tokens.css exactly. If you change a value here,
 * change it in tokens.css too (and vice versa).
 */

/** @type {import('tailwindcss').Config['theme']} */
const tokens = {
  colors: {
    // Political block colors — the only "strong" colors in the system
    block: {
      conservative:        '#2563EB', // blue-600
      'conservative-light':'#DBEAFE', // blue-100
      'conservative-text': '#1E40AF', // blue-800
      'red-green':         '#059669', // emerald-600
      'red-green-light':   '#D1FAE5', // emerald-100
      'red-green-text':    '#065F46', // emerald-800
      moderate:            '#D97706', // amber-600
      'moderate-light':    '#FEF3C7', // amber-100
      'moderate-text':     '#92400E', // amber-800
      dissatisfied:        '#E11D48', // rose-600
      'dissatisfied-light':'#FFE4E6', // rose-100
      'dissatisfied-text': '#9F1239', // rose-800
    },

    // Heatmap scale (persuasiveness 1–5)
    heatmap: {
      0: '#FFFFFF',
      1: '#DBEAFE', // blue-100
      2: '#BFDBFE', // blue-200
      3: '#93C5FD', // blue-300
      4: '#60A5FA', // blue-400
      5: '#2563EB', // blue-600
    },

    // Chat bubbles
    bubble: {
      user:    '#0F172A', // slate-900
      bot:     '#F1F5F9', // slate-100
    },
  },

  // Spacing additions (Tailwind defaults already cover most of this;
  // listed here for explicitness — no overrides, only additions)
  spacing: {
    // Tailwind's default scale is already correct.
    // Named layout values for admin-specific constants:
    'sidebar':   '240px',
    'sidebar-sm':'64px',
  },

  maxWidth: {
    'content': '1400px',
    'bubble':  '72%',
  },

  width: {
    'sidebar': '240px',
    'panel-left':  '40%',
    'panel-right': '60%',
  },

  borderRadius: {
    // Tailwind defaults are fine; documenting the mapping:
    // sm  = 4px  (rounded-sm)
    // md  = 6px  (rounded-md)
    // lg  = 8px  (rounded-lg)  ← card radius
    // xl  = 12px (rounded-xl)
    // full= 9999px (rounded-full) ← badges only
  },

  boxShadow: {
    // Override Tailwind's shadow-sm to match the very subtle academic aesthetic
    xs:  '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
    sm:  '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)',
    md:  '0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
    // shadow-lg and above: DO NOT USE in admin panel (see AESTHETIC.md)
  },

  transitionDuration: {
    fast:  '100ms',
    base:  '150ms',
    slow:  '250ms',
  },

  fontFamily: {
    // System font stack — no web fonts
    sans: [
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Helvetica',
      'Arial',
      'sans-serif',
    ],
    mono: [
      'ui-monospace',
      '"SFMono-Regular"',
      '"SF Mono"',
      'Menlo',
      'Consolas',
      '"Liberation Mono"',
      'monospace',
    ],
  },

  fontSize: {
    // Explicit mapping to rem values matching tokens.css
    xs:   ['0.75rem',   { lineHeight: '1rem' }],
    sm:   ['0.875rem',  { lineHeight: '1.25rem' }],
    base: ['1rem',      { lineHeight: '1.5rem' }],
    lg:   ['1.125rem',  { lineHeight: '1.75rem' }],
    xl:   ['1.25rem',   { lineHeight: '1.75rem' }],
    '2xl':['1.5rem',    { lineHeight: '2rem' }],
    '3xl':['1.875rem',  { lineHeight: '2.25rem' }],
  },

  zIndex: {
    sidebar:  '10',
    dropdown: '20',
    modal:    '30',
    toast:    '40',
  },
};

module.exports = tokens;
