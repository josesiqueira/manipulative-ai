'use client';

/**
 * MetricCard — single headline stat on the dashboard top row.
 *
 * Layout matches COMPONENTS.md exactly:
 *   - label:    uppercase, tracking-wide, small-caps aesthetic (no font change)
 *   - value:    font-mono tabular-nums — data values are never sans-serif
 *   - subtitle: optional secondary line (e.g. "excluding test mode")
 *
 * Optional `tooltip` prop: when present, a small "?" indicator is shown next
 * to the label and a CSS-only `group-hover` tooltip explains the metric.  The
 * prop is fully backwards-compatible — call sites that omit it render exactly
 * as before.
 *
 * Optional `accent` prop: one of 'red' | 'default'.  Red accent is used for
 * "Flagged" so it visually pops without changing the card shell.
 *
 * Loading state (when value is undefined/null in Phase 4): the caller should
 * pass a skeleton element; this component renders whatever value it receives.
 *
 * Width: fills its grid column; the parent grid applies
 * `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4`.
 */

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  accent?: 'default' | 'red';
}

export default function MetricCard({
  label,
  value,
  subtitle,
  tooltip,
  accent = 'default',
}: MetricCardProps) {
  const valueColor = accent === 'red' ? 'text-red-600' : 'text-slate-900';

  return (
    <article className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm relative">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        {tooltip && (
          <span className="group relative inline-flex">
            <span
              aria-label={tooltip}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-400 cursor-help leading-none"
            >
              ?
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-56 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1.5 text-[11px] font-normal normal-case tracking-normal leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <p className={`mt-2 text-3xl font-semibold font-mono tabular-nums ${valueColor}`}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      )}
    </article>
  );
}
