'use client';

import type { ConversationDetailResponse } from '../lib/types';
import PartyBadge from './PartyBadge';

interface ConversationDetailProps {
  conversation: ConversationDetailResponse;
}

export default function ConversationDetail({ conversation }: ConversationDetailProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-2">
          <PartyBadge party={conversation.assigned_party} />
          <span className="text-xs text-slate-400">{conversation.id.slice(0, 8)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
          <div>
            <span className="font-medium">Started:</span>{' '}
            {new Date(conversation.started_at).toLocaleString('en-US')}
          </div>
          {conversation.ended_at && (
            <div>
              <span className="font-medium">Ended:</span>{' '}
              {new Date(conversation.ended_at).toLocaleString('en-US')}
            </div>
          )}
          <div>
            <span className="font-medium">Topic:</span>{' '}
            {conversation.starter_topic || 'Free conversation'}
          </div>
          <div>
            <span className="font-medium">Messages:</span>{' '}
            {conversation.messages.length}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={`rounded-lg p-3 ${
              msg.role === 'user'
                ? 'bg-slate-100 ml-8'
                : 'bg-blue-50 mr-8'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">
                {msg.role === 'user' ? 'User' : 'Chatbot'}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(msg.created_at).toLocaleTimeString('en-US')}
                {msg.token_count ? ` · ${msg.token_count} tokens` : ''}
              </span>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
