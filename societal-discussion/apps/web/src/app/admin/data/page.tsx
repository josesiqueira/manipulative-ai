'use client';

/**
 * Data & Export — /admin/data
 *
 * Three sections:
 *
 *   1. Dataset Health — interactive CoverageMatrix with StatementDrawer drill-down.
 *      Clicking a non-zero cell fetches all matching statements (up to 200) and
 *      slides the drawer open.
 *
 *   2. Export — ExportPanel with filters, date range, format selector, and
 *      authenticated blob download.
 *
 *   3. Data Validation — checklist of automated sanity checks run against the
 *      current dataset state: statement counts, block/topic coverage, and LLM
 *      provider configuration.
 *
 * State management uses plain useState + useEffect (no TanStack Query) to stay
 * consistent with the other admin pages in this codebase.
 *
 * The admin password is read from sessionStorage inside a useEffect because
 * sessionStorage is not available during Next.js server-side rendering.
 */

import { useState, useEffect } from 'react';
import CoverageMatrix from '../components/CoverageMatrix';
import ExportPanel from '../components/ExportPanel';
import StatementDrawer from '../components/StatementDrawer';
import {
  getDetailedStats,
  getBasicStats,
  getStatements,
} from '../lib/api';
import type {
  DetailedStatsResponse,
  StatsResponse,
  StatementItem,
} from '../lib/types';
import { POLITICAL_BLOCKS, TOPIC_CATEGORIES, TOPIC_LABELS } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ---- Section wrapper --------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

// ---- Validation checklist item ----------------------------------------------

function CheckItem({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      {/* Status icon */}
      <span
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold
          ${ok === null ? 'bg-slate-300' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`}
        aria-hidden="true"
      >
        {ok === null ? '?' : ok ? '✓' : '✗'}
      </span>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

// ---- LLM config type (mirrors backend LLMConfigResponse) --------------------

interface LlmConfigItem {
  id: string;
  provider: string;
  display_name: string;
  has_key: boolean;
  selected_model: string | null;
  is_active: boolean;
  api_key_preview: string | null;
  updated_at: string;
}

// ---- Component --------------------------------------------------------------

export default function DataPage() {
  // --------------------------------------------------------------------------
  // Auth
  // --------------------------------------------------------------------------

  /** Admin password read from sessionStorage — empty until the effect fires. */
  const [password, setPassword] = useState('');

  useEffect(() => {
    setPassword(sessionStorage.getItem('admin_password') ?? '');
  }, []);

  // --------------------------------------------------------------------------
  // Section 1: Dataset Health — coverage matrix + statement drawer
  // --------------------------------------------------------------------------

  const [detailedStats, setDetailedStats] = useState<DetailedStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  /** Currently selected matrix cell (null = drawer closed). */
  const [selectedCell, setSelectedCell] = useState<{ block: string; topic: string } | null>(null);

  /** Statements for the open drawer cell. */
  const [drawerStatements, setDrawerStatements] = useState<StatementItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Fetch detailed stats on mount (once password is available).
  useEffect(() => {
    if (!password) return;
    let cancelled = false;

    async function fetchStats() {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await getDetailedStats(password);
        if (!cancelled) setDetailedStats(data);
      } catch (err) {
        if (!cancelled) setStatsError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, [password]);

  /**
   * Handle a matrix cell click: open the drawer and fetch matching statements.
   * We request up to 200 rows — more than any single cell should have — so no
   * pagination is needed inside the drawer.
   */
  async function handleCellClick(block: string, topic: string) {
    setSelectedCell({ block, topic });
    setDrawerStatements([]);
    setDrawerLoading(true);
    try {
      const res = await getStatements(password, { political_block: block, topic_category: topic }, 1, 200);
      setDrawerStatements(res.statements);
    } catch {
      // Drawer will show empty state on error; the matrix itself remains usable.
      setDrawerStatements([]);
    } finally {
      setDrawerLoading(false);
    }
  }

  function closeDrawer() {
    setSelectedCell(null);
    setDrawerStatements([]);
  }

  // --------------------------------------------------------------------------
  // Section 3: Data Validation — basic stats + LLM config
  // --------------------------------------------------------------------------

  const [basicStats, setBasicStats] = useState<StatsResponse | null>(null);
  const [llmConfigs, setLlmConfigs] = useState<LlmConfigItem[] | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;

    async function fetchValidationData() {
      setValidationLoading(true);
      try {
        // Both fetches are independent — run in parallel.
        const [stats, configs] = await Promise.allSettled([
          getBasicStats(password),
          fetch(`${API_BASE}/api/admin/llm/configs`, {
            headers: { 'X-Admin-Password': password },
          }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))),
        ]);

        if (!cancelled) {
          setBasicStats(stats.status === 'fulfilled' ? stats.value : null);
          setLlmConfigs(configs.status === 'fulfilled' ? configs.value : null);
        }
      } finally {
        if (!cancelled) setValidationLoading(false);
      }
    }

    fetchValidationData();
    return () => { cancelled = true; };
  }, [password]);

  // --------------------------------------------------------------------------
  // Derived validation checks
  // --------------------------------------------------------------------------

  /**
   * Compute the number of unique blocks with at least one statement in the
   * coverage matrix returned by detailed stats.
   */
  const coverageMatrix = detailedStats?.coverage_matrix ?? null;

  const blocksPresentCount = coverageMatrix
    ? Object.values(coverageMatrix).filter((topicMap) =>
        Object.values(topicMap).some((count) => count > 0),
      ).length
    : null;

  const topicsPresentCount = coverageMatrix
    ? (() => {
        const seen = new Set<string>();
        for (const topicMap of Object.values(coverageMatrix)) {
          for (const [topic, count] of Object.entries(topicMap)) {
            if (count > 0) seen.add(topic);
          }
        }
        return seen.size;
      })()
    : null;

  /**
   * Total statement count comes from basicStats. We need the statements
   * endpoint total; however, getBasicStats does not expose it directly.
   * The detailed stats coverage_matrix gives us statement counts per cell —
   * sum them all to derive the total seeded.
   *
   * This avoids an extra API call just for the total.
   */
  const totalStatements = coverageMatrix
    ? Object.values(coverageMatrix).reduce(
        (sum, topicMap) =>
          sum + Object.values(topicMap).reduce((s, c) => s + c, 0),
        0,
      )
    : null;

  const activeLlm = llmConfigs?.find((c) => c.is_active && c.has_key) ?? null;

  // --------------------------------------------------------------------------
  // Display labels for the matrix
  // --------------------------------------------------------------------------

  const blockLabels = [...POLITICAL_BLOCKS];
  const topicLabels = [...TOPIC_CATEGORIES];
  const topicDisplayLabels = Object.fromEntries(
    topicLabels.map((t) => [t, TOPIC_LABELS[t] ?? t]),
  );

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Data &amp; Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Inspect statement coverage, export conversation data, and validate dataset integrity.
        </p>
      </div>

      {/* ================================================================== */}
      {/* Section 1: Dataset Health                                           */}
      {/* ================================================================== */}
      <Section
        title="Dataset Health"
        description="Statement count per block × topic cell. Click any non-zero cell to inspect individual statements."
      >
        {statsLoading && (
          <div className="h-48 flex items-center justify-center">
            <span className="text-sm text-slate-400 animate-pulse">Loading coverage data…</span>
          </div>
        )}

        {statsError && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-md px-3 py-2">
            {statsError}
          </p>
        )}

        {!statsLoading && !statsError && detailedStats && (
          <CoverageMatrix
            matrix={detailedStats.coverage_matrix}
            rowLabels={blockLabels}
            colLabels={topicLabels}
            colDisplayLabels={topicDisplayLabels}
            onCellClick={handleCellClick}
          />
        )}
      </Section>

      {/* ================================================================== */}
      {/* Section 2: Export                                                   */}
      {/* ================================================================== */}
      <Section
        title="Export"
        description="Download conversation data with optional filters. CSV includes all survey fields; ZIP contains plain-text transcripts."
      >
        <ExportPanel password={password} />
      </Section>

      {/* ================================================================== */}
      {/* Section 3: Data Validation                                          */}
      {/* ================================================================== */}
      <Section
        title="Data Validation"
        description="Automated checks against the current dataset. All items should be green before running an experiment session."
      >
        {validationLoading || statsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-5 h-5 rounded-full bg-slate-200 flex-shrink-0" />
                <div className="h-4 bg-slate-200 rounded w-48" />
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Check 1: total statement count */}
            <CheckItem
              ok={totalStatements === null ? null : totalStatements >= 261}
              label="Political statements seeded"
              detail={
                totalStatements === null
                  ? 'Could not load coverage data'
                  : `${totalStatements} statement${totalStatements !== 1 ? 's' : ''} found (261 required)`
              }
            />

            {/* Check 2: all 4 political blocks present */}
            <CheckItem
              ok={blocksPresentCount === null ? null : blocksPresentCount >= 4}
              label="All 4 blocks present"
              detail={
                blocksPresentCount === null
                  ? 'Could not load coverage data'
                  : `${blocksPresentCount} of 4 blocks have at least one statement`
              }
            />

            {/* Check 3: all 9 topic categories present */}
            <CheckItem
              ok={topicsPresentCount === null ? null : topicsPresentCount >= 9}
              label="All 9 topics present"
              detail={
                topicsPresentCount === null
                  ? 'Could not load coverage data'
                  : `${topicsPresentCount} of 9 topics have at least one statement`
              }
            />

            {/* Check 4: LLM provider configured and active */}
            <CheckItem
              ok={llmConfigs === null ? null : activeLlm !== null}
              label="LLM provider configured"
              detail={
                llmConfigs === null
                  ? 'Could not load LLM configuration'
                  : activeLlm
                  ? `${activeLlm.display_name}${activeLlm.selected_model ? ` — ${activeLlm.selected_model}` : ''} (active)`
                  : 'No active LLM provider with a configured API key'
              }
            />
          </div>
        )}
      </Section>

      {/* ================================================================== */}
      {/* Statement Drawer (portal-like overlay)                              */}
      {/* Conditionally rendered so it is fully unmounted when closed.        */}
      {/* ================================================================== */}
      {selectedCell && (
        <StatementDrawer
          statements={drawerStatements}
          isLoading={drawerLoading}
          block={selectedCell.block}
          topic={selectedCell.topic}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
