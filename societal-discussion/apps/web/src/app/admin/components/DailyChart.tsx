'use client';

/**
 * DailyChart — horizontal-row layout for the daily breakdown of conversations.
 *
 * Why horizontal rows instead of vertical stacked bars?
 *   - Research data is sparse: most days will be empty for the first weeks.
 *     Vertical stacked bars look "broken" when 6 of 7 days are zero.
 *   - Horizontal rows give each day its own clearly labelled line, even when
 *     empty. The eye sees days-of-week down the left, totals down the right.
 *   - Party segments inside the bar get the horizontal width axis (more space)
 *     rather than being squashed into tiny vertical slices.
 *   - Empty days are obvious because the row still exists (with a 0 on the
 *     right and a faint dashed track) rather than being invisible.
 *
 * Summary stats at the top tell the researcher at a glance what they need:
 *   total over the window, average per day, active days, and the busiest day.
 */

import type { DailyStatsResponse } from '../lib/types';
import { PARTIES, PARTY_COLORS, PARTY_DISPLAY_NAMES } from '../lib/types';

interface DailyChartProps {
  data: DailyStatsResponse;
}

function formatRowLabel(iso: string, todayIso: string, yesterdayIso: string): string {
  if (iso === todayIso) return 'Today';
  if (iso === yesterdayIso) return 'Yesterday';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  // Render as "Mon 12/5" — short weekday + date.
  const date = new Date(`${iso}T12:00:00`);
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${parts[2]}/${parts[1]}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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

  // Summary stats
  const total = days.reduce((sum, d) => sum + d.total, 0);
  const activeDays = days.filter((d) => d.total > 0).length;
  const avg = days.length > 0 ? total / days.length : 0;
  const busiest = days.reduce(
    (best, d) => (d.total > best.total ? d : best),
    days[0],
  );

  const maxTotal = Math.max(1, ...days.map((d) => d.total));

  // "Today" and "Yesterday" labels based on the user's local time so they
  // match the API's Helsinki definition closely enough for a tablet view.
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayIso = isoDate(today);
  const yesterdayIso = isoDate(yesterday);

  const activeParties = PARTIES.filter((p) =>
    days.some((d) => (d.by_party?.[p] ?? 0) > 0),
  );

  return (
    <div>
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            Total in window
          </p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {total}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            Average / day
          </p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {avg.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            Active days
          </p>
          <p className="text-xl font-semibold text-slate-900 tabular-nums">
            {activeDays}
            <span className="text-slate-400 text-sm font-normal ml-1">
              of {days.length}
            </span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
            Busiest day
          </p>
          <p className="text-sm font-medium text-slate-900 tabular-nums truncate">
            {busiest.total > 0
              ? `${formatRowLabel(busiest.date, todayIso, yesterdayIso)} (${busiest.total})`
              : 'none yet'}
          </p>
        </div>
      </div>

      {/* Day rows */}
      <div className="space-y-1.5">
        {days.map((day) => {
          const widthPct = (day.total / maxTotal) * 100;
          const isToday = day.date === todayIso;
          const rowLabel = formatRowLabel(day.date, todayIso, yesterdayIso);
          return (
            <div
              key={day.date}
              className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3"
            >
              <span
                className={`text-sm tabular-nums truncate ${
                  isToday
                    ? 'text-slate-900 font-medium'
                    : day.total > 0
                    ? 'text-slate-700'
                    : 'text-slate-400'
                }`}
              >
                {rowLabel}
              </span>

              {/* Bar */}
              <div className="relative h-6">
                {/* Faint background track so empty rows have a baseline */}
                <div className="absolute inset-0 rounded border border-dashed border-slate-200 bg-slate-50/40" />
                {day.total > 0 && (
                  <div
                    className="relative h-full rounded overflow-hidden flex"
                    style={{ width: `${Math.max(2, widthPct)}%` }}
                  >
                    {PARTIES.map((party) => {
                      const count = day.by_party?.[party] ?? 0;
                      if (count <= 0) return null;
                      const segPct = (count / day.total) * 100;
                      return (
                        <div
                          key={party}
                          style={{
                            width: `${segPct}%`,
                            backgroundColor: PARTY_COLORS[party] ?? '#64748B',
                          }}
                          title={`${PARTY_DISPLAY_NAMES[party] ?? party}: ${count}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              <span
                className={`text-sm text-right tabular-nums ${
                  day.total > 0 ? 'text-slate-900 font-medium' : 'text-slate-300'
                }`}
              >
                {day.total}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {activeParties.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
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
