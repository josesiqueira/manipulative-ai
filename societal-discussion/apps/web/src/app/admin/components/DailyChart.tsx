'use client';

/**
 * DailyChart — HTML/Tailwind stacked-bar chart of the last 7 days of
 * conversation counts, split per party.
 *
 * Intentionally no charting library: every "bar" is a vertical flex column
 * of coloured <div>s whose heights are proportional to the party's share of
 * that day's total, and the day's total share of the maximum-day total.
 *
 * The component is purely presentational — fetching and shape normalisation
 * happen upstream.  A sparse `by_party` map (parties with 0 omitted) is fine;
 * we iterate the canonical PARTIES list for stable ordering and colour.
 */

import type { DailyStatsResponse } from '../lib/types';
import { PARTIES, PARTY_COLORS, PARTY_DISPLAY_NAMES } from '../lib/types';

interface DailyChartProps {
  data: DailyStatsResponse;
}

function formatDayLabel(iso: string): string {
  // iso is YYYY-MM-DD; render as DD/MM without any locale dependency.
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

export default function DailyChart({ data }: DailyChartProps) {
  const days = data.days ?? [];

  if (days.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        No data to display.
      </p>
    );
  }

  // Max total across the visible window controls the bar-height scale so the
  // tallest day always reaches ~100% and the rest are proportional.
  const maxTotal = Math.max(1, ...days.map((d) => d.total));

  // Parties that actually appear on any day, in canonical order — used for
  // the legend so we don't show colours that never appear.
  const activeParties = PARTIES.filter((p) =>
    days.some((d) => (d.by_party?.[p] ?? 0) > 0),
  );

  return (
    <div>
      {/* Bars row */}
      <div
        className="flex items-end gap-3 h-56"
        role="img"
        aria-label="Conversations per day for the last 7 days, stacked by party"
      >
        {days.map((day) => {
          const heightPct = (day.total / maxTotal) * 100;
          const safeHeight = Math.max(heightPct, day.total > 0 ? 4 : 1);

          return (
            <div
              key={day.date}
              className="flex-1 min-w-0 flex flex-col items-center"
            >
              {/* Total label above bar */}
              <div className="text-[10px] font-mono tabular-nums text-slate-600 mb-1 h-4">
                {day.total > 0 ? day.total : ''}
              </div>

              {/* Bar container — fixed height; inner stack grows from bottom */}
              <div className="w-full flex-1 flex flex-col justify-end">
                <div
                  className="w-full rounded-t overflow-hidden flex flex-col-reverse bg-slate-50 border border-slate-200"
                  style={{ height: `${safeHeight}%` }}
                  title={`${formatDayLabel(day.date)} — ${day.total} conversations`}
                >
                  {day.total > 0 &&
                    PARTIES.map((party) => {
                      const count = day.by_party?.[party] ?? 0;
                      if (count <= 0) return null;
                      const segPct = (count / day.total) * 100;
                      return (
                        <div
                          key={party}
                          style={{
                            height: `${segPct}%`,
                            backgroundColor: PARTY_COLORS[party] ?? '#64748B',
                          }}
                          title={`${PARTY_DISPLAY_NAMES[party] ?? party}: ${count}`}
                        />
                      );
                    })}
                </div>
              </div>

              {/* Date label */}
              <div className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
                {formatDayLabel(day.date)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {activeParties.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {activeParties.map((party) => (
            <li key={party} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: PARTY_COLORS[party] ?? '#64748B' }}
              />
              <span>{PARTY_DISPLAY_NAMES[party] ?? party}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
