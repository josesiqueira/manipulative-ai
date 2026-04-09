'use client';

/**
 * Dashboard page — /admin
 *
 * Fetches two endpoints in parallel on mount:
 *   GET /api/admin/stats         → headline metric cards
 *   GET /api/admin/stats/detailed → all four chart sections
 *
 * Why plain useEffect + useState instead of TanStack Query?
 * The admin layout does not wrap a QueryClientProvider, so TanStack Query
 * hooks would throw at runtime.  The two fetches are issued in a single
 * Promise.all so they run concurrently despite using the low-level API.
 *
 * Sections rendered (in order):
 *   1. Metric cards — 6 headline numbers
 *   2. Detection accuracy bar chart — per-block accuracy %
 *   3. Persuasiveness heatmap — block × topic average rating
 *   4. Conversation length distribution — exchange-count histogram
 *   5. Dataset coverage matrix — statement count per block × topic cell
 */

import { useEffect, useState } from 'react';
import { getDetailedStats, getBasicStats } from './lib/api';
import type { DetailedStatsResponse, StatsResponse } from './lib/types';
import {
  POLITICAL_BLOCKS,
  TOPIC_CATEGORIES,
  BLOCK_COLORS,
  TOPIC_LABELS,
} from './lib/types';
import MetricCard from './components/MetricCard';
import AdminBarChart from './components/AdminBarChart';
import HeatmapChart from './components/HeatmapChart';
import CoverageMatrix from './components/CoverageMatrix';

// ---------------------------------------------------------------------------
// Display label maps
// ---------------------------------------------------------------------------

/**
 * Human-readable names for each political block key.
 * Kept here rather than in types.ts because it is a presentation concern
 * specific to this page (the chart components receive it as a prop).
 */
const BLOCK_DISPLAY_LABELS: Record<string, string> = {
  conservative: 'Conservative',
  'red-green': 'Red-Green',
  moderate: 'Moderate',
  dissatisfied: 'Dissatisfied',
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

/**
 * Skeleton placeholder — an animated gray rectangle.
 * Used to preserve layout during the initial data fetch so the page does not
 * shift when real content arrives.
 */
function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [stats, setStats] = useState<DetailedStatsResponse | null>(null);
  const [basicStats, setBasicStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // sessionStorage is only available in the browser; the empty-string
    // fallback lets unauthenticated requests reach the API and receive a 401
    // which is surfaced via the error state.
    const pw = sessionStorage.getItem('adminPassword') || '';

    Promise.all([
      getDetailedStats(pw),
      getBasicStats(pw),
    ])
      .then(([detailed, basic]) => {
        setStats(detailed);
        setBasicStats(basic);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // ---- Error state -------------------------------------------------------

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          Failed to load dashboard: {error}
        </p>
      </div>
    );
  }

  // ---- Loading state -------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Loading…</p>
        </div>

        {/* Metric cards row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>

        {/* Detection accuracy chart */}
        <Skeleton className="h-64" />

        {/* Heatmap */}
        <Skeleton className="h-48" />

        {/* Length distribution chart */}
        <Skeleton className="h-64" />

        {/* Coverage matrix */}
        <Skeleton className="h-48" />
      </div>
    );
  }

  // ---- Derived values (safe to compute only when data is present) -----------

  /**
   * Detection accuracy percentage across all completed chats.
   * Guard against division by zero when no completed chats exist yet.
   */
  const totalGuesses = (basicStats!.correct_guesses ?? 0) + (basicStats!.incorrect_guesses ?? 0);
  const detectionAccuracy = totalGuesses > 0
    ? Math.round((basicStats!.correct_guesses / totalGuesses) * 100)
    : 0;

  /**
   * Per-block accuracy bar data for the AdminBarChart.
   * Values are accuracy_pct from the API; missing blocks default to 0.
   */
  const accuracyData = [...POLITICAL_BLOCKS].map((block) => ({
    name: BLOCK_DISPLAY_LABELS[block] ?? block,
    value: stats!.block_accuracy[block]?.accuracy_pct ?? 0,
    color: BLOCK_COLORS[block],
  }));

  /**
   * Conversation length histogram aggregated across all blocks.
   *
   * The API returns a nested structure:
   *   length_distribution[block][stringifiedExchangeCount] = chatCount
   *
   * We flatten this to a single exchange_count → total_chats mapping by
   * summing counts across blocks, then sort by exchange count ascending so
   * the bar chart reads left-to-right from short to long conversations.
   */
  const lengthAgg: Record<number, number> = {};
  for (const block of POLITICAL_BLOCKS) {
    const blockDist = stats!.length_distribution[block] || {};
    for (const [exchanges, count] of Object.entries(blockDist)) {
      const key = Number(exchanges);
      lengthAgg[key] = (lengthAgg[key] || 0) + count;
    }
  }
  const lengthData = Object.entries(lengthAgg)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([exchanges, count]) => ({ name: exchanges, value: count }));

  // ---- Full render ----------------------------------------------------------

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Experiment overview</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Metric cards                                            */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">Headline metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Participants"
            value={basicStats!.total_participants}
          />
          <MetricCard
            label="Completed Chats"
            value={basicStats!.completed_chats}
          />
          <MetricCard
            label="Detection Accuracy"
            value={`${detectionAccuracy}%`}
            subtitle="correct guesses"
          />
          <MetricCard
            label="Avg Persuasiveness"
            value={basicStats!.avg_persuasiveness?.toFixed(1) ?? '—'}
            subtitle="out of 5"
          />
          <MetricCard
            label="Avg Naturalness"
            value={basicStats!.avg_naturalness?.toFixed(1) ?? '—'}
            subtitle="out of 5"
          />
          {/*
           * avg_confidence is not present in the basic stats endpoint.
           * It will be wired up when the backend exposes it; for now '—'
           * signals to researchers that data collection is in progress.
           */}
          <MetricCard
            label="Avg Confidence"
            value="—"
            subtitle="out of 5"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Detection accuracy by block                             */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="accuracy-heading">
        <h2
          id="accuracy-heading"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          Detection Accuracy by Block
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <AdminBarChart
            data={accuracyData}
            yLabel="Accuracy %"
            unit="%"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Persuasiveness heatmap                                  */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="heatmap-heading">
        <h2
          id="heatmap-heading"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          Persuasiveness by Block × Topic
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6 overflow-x-auto">
          <HeatmapChart
            data={stats!.persuasiveness_matrix}
            rowLabels={[...POLITICAL_BLOCKS]}
            colLabels={[...TOPIC_CATEGORIES]}
            rowDisplayLabels={BLOCK_DISPLAY_LABELS}
            colDisplayLabels={TOPIC_LABELS}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Conversation length distribution                        */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="length-heading">
        <h2
          id="length-heading"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          Conversation Length Distribution
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <AdminBarChart
            data={lengthData}
            yLabel="Chats"
            unit=" chats"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Dataset coverage                                        */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="coverage-heading">
        <h2
          id="coverage-heading"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          Dataset Coverage
        </h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6 overflow-x-auto">
          <CoverageMatrix
            matrix={stats!.coverage_matrix}
            rowLabels={[...POLITICAL_BLOCKS]}
            colLabels={[...TOPIC_CATEGORIES]}
            rowDisplayLabels={BLOCK_DISPLAY_LABELS}
            colDisplayLabels={TOPIC_LABELS}
          />
        </div>
      </section>
    </div>
  );
}
