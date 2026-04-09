'use client';

/**
 * StatementDrawer — right-side overlay panel showing statements for a
 * selected block × topic cell drilled into from the CoverageMatrix.
 *
 * Design decisions:
 * - Fixed overlay (not a modal) so the matrix remains visible for context.
 * - Width is 480 px on desktop, full-width on mobile (max-w-full).
 * - The panel is rendered conditionally by the parent; when unmounted no
 *   resources are held.  Closing is handled by the parent state setter.
 * - Skeleton loading cards maintain the same height as real cards to avoid
 *   layout shift when data arrives.
 */

import BlockBadge from './BlockBadge';
import TopicBadge from './TopicBadge';
import type { StatementItem } from '../lib/types';

// ---- Props ------------------------------------------------------------------

interface StatementDrawerProps {
  statements: StatementItem[];
  isLoading: boolean;
  block: string;
  topic: string;
  onClose: () => void;
}

// ---- Skeleton card ----------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 space-y-2 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      <div className="h-3 bg-slate-200 rounded w-full" />
      <div className="h-3 bg-slate-200 rounded w-5/6" />
      <div className="h-3 bg-slate-200 rounded w-1/4 mt-1" />
    </div>
  );
}

// ---- Statement card ---------------------------------------------------------

function StatementCard({ statement }: { statement: StatementItem }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
      {/* Main text */}
      <p className="text-sm text-slate-800 leading-relaxed">
        {statement.final_output_en}
      </p>

      {/* Intention in italic */}
      {statement.intention_of_statement && (
        <p className="text-xs text-slate-500 italic">
          {statement.intention_of_statement}
        </p>
      )}

      {/* External ID badge */}
      <div className="flex items-center gap-2 pt-1">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono
                          bg-slate-100 text-slate-500 border border-slate-200">
          #{statement.external_id}
        </span>
        {statement.topic_detailed && (
          <span className="text-xs text-slate-400 truncate">
            {statement.topic_detailed}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Component --------------------------------------------------------------

export default function StatementDrawer({
  statements,
  isLoading,
  block,
  topic,
  onClose,
}: StatementDrawerProps) {
  return (
    <>
      {/* Semi-transparent backdrop — click to close */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        className="fixed top-0 right-0 h-full w-[480px] max-w-full bg-white shadow-2xl
                   z-50 flex flex-col"
        role="complementary"
        aria-label={`Statements for ${block} × ${topic}`}
      >
        {/* ---- Header ------------------------------------------------------- */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-700">Statements:</span>
            <BlockBadge block={block} />
            <span className="text-xs text-slate-400">×</span>
            <TopicBadge topic={topic} />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close statement drawer"
            className="ml-3 shrink-0 rounded-md p-1.5 text-slate-400 hover:text-slate-600
                       hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500
                       transition-colors"
          >
            {/* X icon via inline SVG — no icon library dependency */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* ---- Statement list ----------------------------------------------- */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            // Six skeleton cards while data is in flight
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : statements.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              No statements for this combination.
            </p>
          ) : (
            statements.map((s) => <StatementCard key={s.id} statement={s} />)
          )}
        </div>

        {/* ---- Footer with count ------------------------------------------- */}
        {!isLoading && statements.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-200 shrink-0">
            <p className="text-xs text-slate-400">
              {statements.length} statement{statements.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
