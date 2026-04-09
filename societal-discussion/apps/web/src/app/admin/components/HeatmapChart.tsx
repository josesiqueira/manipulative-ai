'use client';

/**
 * HeatmapChart — block × topic persuasiveness heatmap.
 *
 * Renders an HTML table where each cell contains the average persuasiveness
 * rating (1-5) for a particular political-block / topic combination.  Cell
 * backgrounds are linearly interpolated between the five steps defined in
 * tokens.css (--heatmap-1 through --heatmap-5), which maps the blue-100 →
 * blue-600 ramp.  Text switches to white when the background is dark enough
 * to lose contrast (avg >= 4).
 *
 * Empty cells (no conversations for that cell) are displayed as "—" on a
 * white background per the Heatmap cell spec in COMPONENTS.md.
 *
 * Column headers are rotated 45° so wide topic names don't blow out the layout
 * when 9 columns are present.
 */

import BlockBadge from './BlockBadge';

// ---- Types ----------------------------------------------------------------

interface HeatmapChartProps {
  data: Record<string, Record<string, { avg: number; count: number } | null>>;
  rowLabels: string[];  // block keys, in display order
  colLabels: string[];  // topic keys, in display order
  rowDisplayLabels?: Record<string, string>;  // block key → human name
  colDisplayLabels?: Record<string, string>;  // topic key → human name
}

// ---- Color helpers ---------------------------------------------------------

/**
 * The five heatmap stop colours from tokens.css, indexed 1-5.
 * Stop 0 (white, no data) is handled separately — it never needs interpolation.
 */
const HEAT_STOPS: [number, number, number][] = [
  [219, 234, 254], // blue-100  (#DBEAFE)  avg = 1
  [191, 219, 254], // blue-200  (#BFDBFE)  avg = 2
  [147, 197, 253], // blue-300  (#93C5FD)  avg = 3
  [ 96, 165, 250], // blue-400  (#60A5FA)  avg = 4
  [ 37,  99, 235], // blue-600  (#2563EB)  avg = 5
];

/**
 * Map avg (1–5) to an interpolated RGB string using the design-token stops.
 *
 * Linear interpolation between adjacent stops:
 *   - avg 1 → HEAT_STOPS[0]
 *   - avg 2 → HEAT_STOPS[1]  …etc.
 *   - values between steps are blended proportionally.
 *
 * Returns a CSS `rgb(r, g, b)` string.
 */
function getHeatColor(avg: number): string {
  // Clamp to valid range before interpolating.
  const clamped = Math.max(1, Math.min(5, avg));

  // Determine which pair of stops to interpolate between.
  // Stops are at integer positions 1, 2, 3, 4, 5 → indices 0, 1, 2, 3, 4.
  const lowerIndex = Math.min(Math.floor(clamped) - 1, 3); // 0–3
  const upperIndex = lowerIndex + 1;                        // 1–4

  // Fractional position within the [lower, upper] interval (0..1).
  const t = clamped - Math.floor(clamped);

  const [r1, g1, b1] = HEAT_STOPS[lowerIndex];
  const [r2, g2, b2] = HEAT_STOPS[upperIndex];

  const r = Math.round(r1 + t * (r2 - r1));
  const g = Math.round(g1 + t * (g2 - g1));
  const b = Math.round(b1 + t * (b2 - b1));

  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * At avg >= 4 the background is blue-400 or darker; white text is needed
 * to maintain WCAG AA contrast against that background.
 */
function needsWhiteText(avg: number): boolean {
  return avg >= 4;
}

// ---- Component -------------------------------------------------------------

export default function HeatmapChart({
  data,
  rowLabels,
  colLabels,
  rowDisplayLabels = {},
  colDisplayLabels = {},
}: HeatmapChartProps) {
  if (rowLabels.length === 0 || colLabels.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        No data available for the heatmap.
      </p>
    );
  }

  return (
    // Horizontal scroll so narrow viewports don't compress the grid.
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr>
            {/* Empty corner cell — aligns with row-header column. */}
            <th className="border border-slate-200 bg-slate-50 px-3 py-2" />
            {colLabels.map((col) => {
              const label = colDisplayLabels[col] ?? col;
              return (
                <th
                  key={col}
                  className="border border-slate-200 bg-slate-50 px-3 py-2
                             text-slate-500 font-medium whitespace-nowrap"
                  title={label}
                >
                  {/*
                   * Rotate column headers so long topic names remain legible
                   * without expanding the column width significantly.
                   */}
                  <span
                    className="block text-left"
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      minHeight: '5rem',
                    }}
                  >
                    {label}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row) => {
            const rowData = data[row] ?? {};
            return (
              <tr key={row}>
                {/* Row header — contains a BlockBadge for visual encoding. */}
                <th
                  className="border border-slate-200 bg-slate-50 px-3 py-2
                             text-left font-medium text-slate-700 whitespace-nowrap"
                >
                  <BlockBadge block={row} />
                </th>

                {colLabels.map((col) => {
                  const cell = rowData[col] ?? null;

                  if (cell === null || cell.count === 0) {
                    // Empty cell: em-dash on white background.
                    return (
                      <td
                        key={col}
                        className="border border-slate-200 px-3 py-2 text-center
                                   text-slate-400 font-mono tabular-nums
                                   transition-colors"
                        title={`${row} × ${col}: no data`}
                      >
                        —
                      </td>
                    );
                  }

                  const bgColor = getHeatColor(cell.avg);
                  const textColor = needsWhiteText(cell.avg)
                    ? 'white'
                    : 'inherit';
                  const subColor = needsWhiteText(cell.avg)
                    ? 'rgba(255,255,255,0.7)'
                    : '#64748B'; // slate-500

                  return (
                    <td
                      key={col}
                      className="border border-slate-200 px-3 py-2 text-center
                                 font-mono tabular-nums transition-colors"
                      style={{ backgroundColor: bgColor, color: textColor }}
                      title={`${row} × ${col}: avg ${cell.avg.toFixed(1)}, n=${cell.count}`}
                    >
                      <span className="block font-semibold leading-tight">
                        {cell.avg.toFixed(1)}
                      </span>
                      <span
                        className="block text-[10px] leading-tight"
                        style={{ color: subColor }}
                      >
                        (n={cell.count})
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
