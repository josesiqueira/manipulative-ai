'use client';

/**
 * BlockBadge — colored pill identifying a political block.
 *
 * Used in chat list rows, chat detail headers, chart legends, and heatmap row
 * labels. Colors come from the design token table in COMPONENTS.md; text shades
 * are -800 variants for WCAG AA contrast on their respective -100 backgrounds.
 *
 * Unknown/null blocks fall back to neutral slate so the badge is always
 * rendered — never null — which simplifies consuming components.
 */

interface BlockBadgeProps {
  block: string;
}

/**
 * Tailwind class pairs per block key, keyed by the raw database value.
 * Uses exact Tailwind utility names; no arbitrary hex values (per design rules).
 */
const BLOCK_STYLES: Record<string, string> = {
  conservative: 'bg-blue-100 text-blue-800',
  'red-green':  'bg-emerald-100 text-emerald-800',
  moderate:     'bg-amber-100 text-amber-800',
  dissatisfied: 'bg-rose-100 text-rose-800',
};

/** Title-cased display labels for raw block keys. */
const BLOCK_LABELS: Record<string, string> = {
  conservative: 'Conservative',
  'red-green':  'Red-Green',
  moderate:     'Moderate',
  dissatisfied: 'Dissatisfied',
};

export default function BlockBadge({ block }: BlockBadgeProps) {
  const style = BLOCK_STYLES[block] ?? 'bg-slate-100 text-slate-500';
  const label = BLOCK_LABELS[block] ?? block;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
