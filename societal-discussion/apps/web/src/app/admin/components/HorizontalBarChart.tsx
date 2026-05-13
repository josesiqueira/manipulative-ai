// HorizontalBarChart — for comparing many categories at a glance.
//
// We picked horizontal bars over a vertical chart or donut/pie deliberately:
//   - 9 party labels don't fit under vertical bars without rotation.
//   - Pie/donut becomes unreadable past ~4 segments; current best practice for
//     small-multi-category distributions is sorted horizontal bars.
//   - Sorting by count puts the most-active party at the top, so the eye
//     immediately registers sampling balance.

interface HorizontalBarChartDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface HorizontalBarChartProps {
  data: HorizontalBarChartDatum[];
  /** When empty, render a small empty-state row instead of nothing. */
  emptyLabel?: string;
}

export default function HorizontalBarChart({ data, emptyLabel }: HorizontalBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-6 text-center">
        {emptyLabel || 'No data yet'}
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(1, ...sorted.map((d) => d.value));

  return (
    <div className="space-y-2">
      {sorted.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const widthPct = (d.value / max) * 100;
        return (
          <div
            key={d.key}
            className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3"
          >
            <span className="text-sm text-slate-700 truncate" title={d.label}>
              {d.label}
            </span>
            <div className="h-6 bg-slate-100 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: d.value > 0 ? `${Math.max(2, widthPct)}%` : '0%',
                  backgroundColor: d.color,
                }}
              />
            </div>
            <span className="text-sm tabular-nums text-slate-700 text-right">
              {d.value}
              <span className="text-slate-400 text-xs ml-1">({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
