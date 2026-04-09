'use client';

/**
 * CoverageMatrix — statement count grid for the dataset health panel.
 *
 * Renders a block × topic table where each cell shows how many
 * PoliticalStatement rows exist for that combination.  Cells are colour-coded
 * by the three coverage thresholds defined in tokens.css:
 *
 *   > 10   → emerald-100 / emerald-800  (good coverage)
 *   5–10   → amber-100  / amber-800     (marginal)
 *   1–4    → rose-100   / rose-800      (low coverage)
 *   0      → slate-100  / slate-400     (empty)
 *
 * When an `onCellClick` handler is provided, non-zero cells become interactive
 * buttons so researchers can drill into the statements for any cell.
 *
 * Column headers are rotated vertically (matching HeatmapChart) so topic names
 * don't require wide columns.
 */

import BlockBadge from './BlockBadge';

// ---- Types -----------------------------------------------------------------

interface CoverageMatrixProps {
  matrix: Record<string, Record<string, number>>;
  rowLabels: string[];   // block keys, in display order
  colLabels: string[];   // topic keys, in display order
  rowDisplayLabels?: Record<string, string>;
  colDisplayLabels?: Record<string, string>;
  onCellClick?: (block: string, topic: string) => void;
}

// ---- Coverage threshold helpers --------------------------------------------

/**
 * Returns Tailwind bg + text class pair for the given statement count.
 * Thresholds are hard-coded per the design spec in COMPONENTS.md.
 */
function getCoverageClasses(count: number): string {
  if (count > 10) return 'bg-emerald-100 text-emerald-800';
  if (count >= 5)  return 'bg-amber-100   text-amber-800';
  if (count > 0)   return 'bg-rose-100    text-rose-800';
  return 'bg-slate-100 text-slate-400';
}

// ---- Component -------------------------------------------------------------

export default function CoverageMatrix({
  matrix,
  rowLabels,
  colLabels,
  rowDisplayLabels = {},
  colDisplayLabels = {},
  onCellClick,
}: CoverageMatrixProps) {
  if (rowLabels.length === 0 || colLabels.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        No coverage data available.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr>
            {/* Corner cell aligns with the row-header column. */}
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
            const rowData = matrix[row] ?? {};
            return (
              <tr key={row}>
                {/* Row header */}
                <th
                  className="border border-slate-200 bg-slate-50 px-3 py-2
                             text-left font-medium text-slate-700 whitespace-nowrap"
                >
                  <BlockBadge block={row} />
                </th>

                {colLabels.map((col) => {
                  const count = rowData[col] ?? 0;
                  const colorClasses = getCoverageClasses(count);
                  const isClickable = onCellClick !== undefined && count > 0;

                  // Cells with a click handler and count > 0 become interactive
                  // buttons so keyboard users can also drill in.
                  if (isClickable) {
                    return (
                      <td
                        key={col}
                        className={`border border-slate-200 p-0 text-center
                                    font-mono tabular-nums`}
                      >
                        <button
                          type="button"
                          onClick={() => onCellClick!(row, col)}
                          className={`w-full h-full px-3 py-2 ${colorClasses}
                                      font-mono tabular-nums text-sm
                                      hover:ring-2 hover:ring-inset hover:ring-slate-400
                                      focus-visible:outline-none
                                      focus-visible:ring-2 focus-visible:ring-inset
                                      focus-visible:ring-blue-600
                                      transition-shadow`}
                          title={`${row} × ${col}: ${count} statements — click to view`}
                        >
                          {count}
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col}
                      className={`border border-slate-200 px-3 py-2 text-center
                                  text-sm font-mono tabular-nums ${colorClasses}`}
                      title={`${row} × ${col}: ${count} statements`}
                    >
                      {count}
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
