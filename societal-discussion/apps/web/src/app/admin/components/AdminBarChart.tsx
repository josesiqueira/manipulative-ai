'use client';

/**
 * AdminBarChart — thin Recharts wrapper used on the dashboard.
 *
 * Renders a single vertical bar chart with per-bar colour control via the
 * `color` field on each data entry.  The component handles its own
 * ResponsiveContainer so callers only need to control the logical height.
 *
 * Design notes:
 * - All axis tick styles use slate-500 (#64748B) — the muted text token.
 * - Grid lines use slate-200 (#E2E8F0) — the border token.
 * - Bars have a 4px top-radius to soften the rectangular silhouette without
 *   straying from the academic-tool aesthetic.
 * - The Tooltip formatter strips Recharts' default label so only the value +
 *   optional unit is shown.
 *
 * Recharts 3.x note: Cell must be imported from 'recharts' directly; it is
 * still the canonical way to assign per-bar fill without a custom shape.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// ---- Types -----------------------------------------------------------------

export interface BarChartData {
  name: string;
  value: number;
  /** Optional hex/css color string.  Defaults to slate-500 if omitted. */
  color?: string;
}

interface AdminBarChartProps {
  data: BarChartData[];
  /** Y-axis label text rotated 90° on the left side. */
  yLabel?: string;
  /** Unit suffix appended to values in the tooltip (e.g. "%" or " chats"). */
  unit?: string;
  /** Height of the chart container in pixels.  Defaults to 300. */
  height?: number;
}

// ---- Component -------------------------------------------------------------

export default function AdminBarChart({
  data,
  yLabel,
  unit = '',
  height = 300,
}: AdminBarChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-6">
        No data to display.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />

        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#64748B' }}
        />

        <YAxis
          tick={{ fontSize: 12, fill: '#64748B' }}
          label={
            yLabel
              ? {
                  value: yLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 12, fill: '#64748B' },
                }
              : undefined
          }
        />

        {/*
         * Tooltip: suppress the default series name (second element of the
         * tuple) by returning an empty string, keeping the display clean.
         */}
        <Tooltip
          formatter={(value) => [`${value ?? ''}${unit}`, '']}
          contentStyle={{
            border: '1px solid #E2E8F0',
            borderRadius: '0.375rem',
            fontSize: 12,
            color: '#334155',
          }}
        />

        {/*
         * radius prop: [topLeft, topRight, bottomRight, bottomLeft]
         * 4px top radius only — flat bottom anchors the bar to the axis.
         */}
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.color ?? '#64748B' /* slate-500 fallback */}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
