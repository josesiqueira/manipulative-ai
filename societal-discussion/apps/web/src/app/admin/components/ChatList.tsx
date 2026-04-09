'use client';

/**
 * ChatList — scrollable, paginated list of conversation rows.
 *
 * Design reference: COMPONENTS.md § FilterBar (list row conventions)
 *
 * Each row shows: formatted date, TopicBadge, BlockBadge, exchange count, and
 * a detection-result icon (green check / red X / gray dash).  The selected row
 * receives a blue left border accent.
 *
 * Pagination is self-contained: the component emits `onPageChange(n)` and the
 * parent is responsible for fetching the new page.  This keeps the component
 * stateless with respect to data — it only manages visual selection state via
 * the `selectedId` prop.
 *
 * Date formatting uses `Intl.DateTimeFormat` with numeric month/day/year plus
 * short time so the output is locale-aware without adding a library dependency.
 */

import { ChatListItem } from '../lib/types';
import BlockBadge from './BlockBadge';
import TopicBadge from './TopicBadge';

interface ChatListProps {
  chats: ChatListItem[];
  total: number;
  page: number;
  perPage: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPageChange: (page: number) => void;
}

/**
 * Formats an ISO timestamp string to "MM/DD/YYYY, HH:MM" using the browser's
 * Intl API.  This is locale-aware and avoids manual string slicing.
 */
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/**
 * DetectionIcon — small inline indicator for correct_guess.
 * true  → green checkmark
 * false → red X
 * null  → gray dash (survey not yet submitted)
 */
function DetectionIcon({ value }: { value: boolean | null }) {
  if (value === true) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700"
        title="Correct guess"
        aria-label="Correct guess"
      >
        {/* Unicode heavy check mark */}
        ✓
      </span>
    );
  }
  if (value === false) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-100 text-rose-700"
        title="Incorrect guess"
        aria-label="Incorrect guess"
      >
        ✕
      </span>
    );
  }
  // null — pending survey
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-400"
      title="Pending"
      aria-label="Pending"
    >
      —
    </span>
  );
}

export default function ChatList({
  chats,
  total,
  page,
  perPage,
  selectedId,
  onSelect,
  onPageChange,
}: ChatListProps) {
  // Derive 1-based display range for "Showing X–Y of Z" label.
  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable chat rows — flex-1 lets it fill remaining height */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          // Empty state per COMPONENTS.md: centered plain text, never hidden
          <p className="text-sm text-slate-500 text-center py-12">
            No conversations match the selected filters
          </p>
        ) : (
          <ul role="listbox" aria-label="Conversation list">
            {chats.map((chat) => {
              const isSelected = chat.id === selectedId;
              // exchanges = floor(message_count / 2) — each exchange is one user + one assistant turn
              const exchanges = Math.floor(chat.message_count / 2);

              return (
                <li
                  key={chat.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(chat.id)}
                  className={[
                    'px-3 py-3 cursor-pointer border-b border-slate-100 transition-colors',
                    isSelected
                      ? 'bg-blue-50 border-l-4 border-l-blue-600'
                      : 'border-l-4 border-l-transparent hover:bg-slate-50',
                  ].join(' ')}
                >
                  {/* Row top line: date + detection icon */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-slate-500">
                      {formatDate(chat.created_at)}
                    </span>
                    <DetectionIcon value={chat.correct_guess} />
                  </div>

                  {/* Row middle: topic badge + block badge */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <TopicBadge topic={chat.topic_category} />
                    <BlockBadge block={chat.political_block} />
                  </div>

                  {/* Row bottom: exchange count */}
                  <span className="text-xs text-slate-400">
                    {exchanges} {exchanges === 1 ? 'exchange' : 'exchanges'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination footer — always rendered so layout doesn't shift */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 bg-white shrink-0">
        <span className="text-xs text-slate-500">
          {total === 0
            ? 'No results'
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
