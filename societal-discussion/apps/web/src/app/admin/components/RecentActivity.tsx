// RecentActivity — a chronological list of the most recent conversations.
//
// Pattern: tight info-dense rows, one per conversation. Researcher can scan it
// quickly to see what's been happening without leaving the dashboard.

import Link from 'next/link';
import type { ConversationListItem } from '../lib/types';
import { PARTY_DISPLAY_NAMES, PARTY_COLORS } from '../lib/types';

interface RecentActivityProps {
  conversations: ConversationListItem[];
  /** Defaults to 10. */
  limit?: number;
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 30) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function RecentActivity({ conversations, limit = 10 }: RecentActivityProps) {
  if (conversations.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-6 text-center">
        No conversations yet
      </div>
    );
  }

  const sorted = [...conversations]
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )
    .slice(0, limit);

  return (
    <ul className="divide-y divide-slate-100">
      {sorted.map((c) => {
        const color = PARTY_COLORS[c.assigned_party] || '#6B7280';
        const partyName = PARTY_DISPLAY_NAMES[c.assigned_party] || c.assigned_party;
        const topic = c.starter_topic || 'Free conversation';
        return (
          <li key={c.id} className="py-2 flex items-center gap-3 text-sm min-w-0">
            <span className="text-xs text-slate-400 w-16 flex-shrink-0 tabular-nums">
              {relativeTime(c.started_at)}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {partyName}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded flex-shrink-0">
              {c.language}
            </span>
            <Link
              href={`/admin/conversations?id=${c.id}`}
              className="text-slate-600 truncate flex-1 hover:text-slate-900 hover:underline"
              title={topic}
            >
              {topic}
            </Link>
            <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">
              {c.message_count} msgs
            </span>
            {c.is_flagged && (
              <span className="text-red-500 flex-shrink-0" title="Flagged for review">
                ⚑
              </span>
            )}
            {c.is_test_mode && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex-shrink-0">
                TEST
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
