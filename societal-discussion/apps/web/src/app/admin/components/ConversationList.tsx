'use client';

import { useMemo, useState } from 'react';
import type { ConversationListItem } from '../lib/types';
import PartyBadge from './PartyBadge';
import Badge from './Badge';

interface ConversationListProps {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type SortKey = 'date' | 'messages' | 'status';
type SortDir = 'asc' | 'desc';

// Higher value = "more complete" — used to sort the Status column.
function statusRank(conv: ConversationListItem): number {
  if (conv.is_complete) return 2;
  if (conv.ended_at) return 1;
  return 0;
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    const arr = [...conversations];
    arr.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'date') {
        diff = new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      } else if (sortKey === 'messages') {
        diff = a.message_count - b.message_count;
      } else {
        diff = statusRank(a) - statusRank(b);
      }
      return sortDir === 'asc' ? diff : -diff;
    });
    return arr;
  }, [conversations, sortKey, sortDir]);

  function cycleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // Date defaults to desc, others to asc on first click
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  }

  function indicator(key: SortKey) {
    if (sortKey !== key) {
      return <span className="text-slate-300">↕</span>;
    }
    return <span className="text-slate-700">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  }

  if (conversations.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">No conversations.</p>;
  }

  return (
    <div>
      {/* Sortable header row */}
      <div className="sticky top-0 z-10 grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <button
          type="button"
          onClick={() => cycleSort('date')}
          className="flex items-center gap-1 text-left hover:text-slate-800"
        >
          Date {indicator('date')}
        </button>
        <button
          type="button"
          onClick={() => cycleSort('messages')}
          className="flex items-center gap-1 hover:text-slate-800"
        >
          Msgs {indicator('messages')}
        </button>
        <button
          type="button"
          onClick={() => cycleSort('status')}
          className="flex items-center gap-1 hover:text-slate-800"
        >
          Status {indicator('status')}
        </button>
        <span className="w-0" aria-hidden />
      </div>

      <div className="divide-y divide-slate-100">
        {sorted.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors ${
              selectedId === conv.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <PartyBadge party={conv.assigned_party} />
                {conv.is_test_mode && (
                  <Badge variant="test" size="sm">TEST</Badge>
                )}
                {conv.is_flagged && (
                  <Badge variant="flagged" size="sm">Flagged</Badge>
                )}
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {new Date(conv.started_at).toLocaleDateString('en-US')}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {conv.starter_topic || 'Free conversation'}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <span>{conv.message_count} messages</span>
              {conv.is_complete && <span className="text-emerald-500">Complete</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
