'use client';

import type { ConversationListItem } from '../lib/types';
import PartyBadge from './PartyBadge';

interface ConversationListProps {
  conversations: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Ei keskusteluja.</p>;
  }

  return (
    <div className="divide-y divide-slate-100">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
            selectedId === conv.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <PartyBadge party={conv.assigned_party} />
            <span className="text-xs text-slate-400">
              {new Date(conv.started_at).toLocaleDateString('fi-FI')}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">
            {conv.starter_topic || 'Vapaa keskustelu'}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{conv.message_count} viestia</span>
            {conv.is_complete && <span className="text-emerald-500">Valmis</span>}
            {conv.is_test_mode && <span className="text-amber-500">Testi</span>}
          </div>
        </button>
      ))}
    </div>
  );
}
