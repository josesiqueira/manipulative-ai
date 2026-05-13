/**
 * Badge — small inline label used throughout the admin UI to mark parties,
 * conversation status, test data, flagged conversations, etc.
 *
 * Variants:
 *   - party    Light-tinted background with `color` prop (hex) for text and
 *              border.  Falls back to slate if no color is supplied.
 *   - status   Emerald — used for "Complete" / positive states.
 *   - test     Amber with diagonal stripes — visually loud so researchers
 *              never mistake test data for real conversations.
 *   - flagged  Red with a small ⚑ glyph.
 *   - neutral  Slate — default for unstyled labels.
 *
 * The component is purely additive: existing callers that build inline badge
 * markup are intentionally left alone.  New code should prefer this component.
 */

import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'party' | 'status' | 'test' | 'flagged' | 'neutral';
  size?: 'sm' | 'md';
  /**
   * Optional hex colour.  When provided, the badge uses this colour for text
   * and a soft tint of it for the background — overrides the variant palette.
   * Most useful with variant='party' but accepted for any variant.
   */
  color?: string;
}

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  party: 'bg-slate-100 text-slate-700 border border-slate-200',
  status: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  // Diagonal stripes via repeating-linear-gradient so test data is hard to miss.
  test:
    'text-amber-900 border border-amber-300 [background:repeating-linear-gradient(45deg,#fef3c7_0,#fef3c7_6px,#fde68a_6px,#fde68a_12px)]',
  flagged: 'bg-red-50 text-red-700 border border-red-200',
  neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  color,
}: BadgeProps) {
  // When a custom colour is provided, override background + text + border via
  // inline style.  We use a 20% alpha tint for the background (hex + "33").
  const customStyle = color
    ? {
        backgroundColor: `${color}1A`, // ~10% opacity tint
        color,
        borderColor: `${color}40`, // ~25% opacity border
      }
    : undefined;

  const baseClasses =
    'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap';

  // If a custom colour is supplied we drop the variant's bg/text/border so the
  // inline style wins cleanly.  Keep stripes for `test` though — stripes are
  // the whole point of the variant.
  const useVariantClasses = !color || variant === 'test';

  return (
    <span
      className={[
        baseClasses,
        sizeClasses[size],
        useVariantClasses ? variantClasses[variant] : 'border',
      ].join(' ')}
      style={customStyle}
    >
      {variant === 'flagged' && <span aria-hidden>⚑</span>}
      {children}
    </span>
  );
}
