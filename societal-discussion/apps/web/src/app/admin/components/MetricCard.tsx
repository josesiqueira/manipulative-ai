'use client';

/**
 * MetricCard — single headline stat on the dashboard top row.
 *
 * Layout matches COMPONENTS.md exactly:
 *   - label:    uppercase, tracking-wide, small-caps aesthetic (no font change)
 *   - value:    font-mono tabular-nums — data values are never sans-serif
 *   - subtitle: optional secondary line (e.g. "excluding test mode")
 *
 * Loading state (when value is undefined/null in Phase 4): the caller should
 * pass a skeleton element; this component renders whatever value it receives.
 * A separate loading prop is out of scope for Phase 3 stubs.
 *
 * Width: fills its grid column; the parent grid applies
 * `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`.
 */

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export default function MetricCard({ label, value, subtitle }: MetricCardProps) {
  return (
    <article className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 font-mono tabular-nums">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      )}
    </article>
  );
}
