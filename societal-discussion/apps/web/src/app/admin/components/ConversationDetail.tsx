'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConversationDetailResponse } from '../lib/types';
import { PARTY_DISPLAY_NAMES } from '../lib/types';
import PartyBadge from './PartyBadge';
import Badge from './Badge';

interface ConversationDetailProps {
  conversation: ConversationDetailResponse;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatClock(ts: string): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildTranscript(conv: ConversationDetailResponse): string {
  const partyName = PARTY_DISPLAY_NAMES[conv.assigned_party] || conv.assigned_party;
  const lines: string[] = [];
  lines.push(`Conversation: ${conv.id}`);
  lines.push(`Started: ${conv.started_at}`);
  lines.push(`Ended: ${conv.ended_at ?? 'still active'}`);
  lines.push(`Party: ${partyName}`);
  lines.push(`Language: ${conv.language}`);
  lines.push(`Topic: ${conv.starter_topic || 'Free conversation'}`);
  lines.push(`Flagged: ${conv.is_flagged ? 'yes' : 'no'}`);
  lines.push(`Flag notes: ${conv.flag_notes || ''}`);
  lines.push('');
  for (const msg of conv.messages) {
    const who = msg.role === 'user' ? 'User' : 'Chatbot';
    lines.push(`[${formatClock(msg.created_at)}] ${who}: ${msg.content}`);
  }
  return lines.join('\n');
}

export default function ConversationDetail({ conversation }: ConversationDetailProps) {
  // Local mirror of flag state so the panel feels instant.  Reset whenever the
  // parent passes a fresh conversation.
  const [isFlagged, setIsFlagged] = useState<boolean>(conversation.is_flagged);
  const [flagNotes, setFlagNotes] = useState<string>(conversation.flag_notes ?? '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationId = conversation.id;

  // Reset local state when navigating to a different conversation.
  useEffect(() => {
    setIsFlagged(conversation.is_flagged);
    setFlagNotes(conversation.flag_notes ?? '');
    setSaveStatus('idle');
  }, [conversation.id, conversation.is_flagged, conversation.flag_notes]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  async function saveFlag(nextFlagged: boolean, nextNotes: string) {
    const password = sessionStorage.getItem('adminPassword') || '';
    setSaveStatus('saving');
    try {
      const body: { is_flagged: boolean; flag_notes?: string } = {
        is_flagged: nextFlagged,
      };
      if (nextFlagged) body.flag_notes = nextNotes;
      const res = await fetch(
        `${API_BASE}/api/admin/conversations/${encodeURIComponent(conversationId)}/flag`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Password': password,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setSaveStatus('saved');
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save flag', err);
      setSaveStatus('error');
    }
  }

  function scheduleSave(nextFlagged: boolean, nextNotes: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveFlag(nextFlagged, nextNotes);
    }, 500);
  }

  function onToggleFlag(checked: boolean) {
    setIsFlagged(checked);
    // Toggle saves immediately — no debounce delay for a binary action.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    void saveFlag(checked, checked ? flagNotes : '');
  }

  function onChangeNotes(value: string) {
    setFlagNotes(value);
    scheduleSave(isFlagged, value);
  }

  function downloadTranscript() {
    const text = {
      ...conversation,
      is_flagged: isFlagged,
      flag_notes: isFlagged ? flagNotes : '',
    };
    const transcript = buildTranscript(text);
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conversation.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a tick so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <PartyBadge party={conversation.assigned_party} />
            {conversation.is_test_mode && (
              <Badge variant="test" size="sm">TEST</Badge>
            )}
            {isFlagged && (
              <Badge variant="flagged" size="sm">Flagged</Badge>
            )}
            <span className="text-xs text-slate-400 truncate">
              {conversation.id.slice(0, 8)}
            </span>
          </div>
          <button
            type="button"
            onClick={downloadTranscript}
            className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Download .txt
          </button>
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
          <div>
            <span className="font-medium">Language:</span> {conversation.language}
          </div>
        </div>
      </div>

      {/* Flag panel */}
      <div className="bg-white rounded-lg border border-slate-200 p-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isFlagged}
            onChange={(e) => onToggleFlag(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <span className="font-medium">Flag this conversation for review</span>
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-600 ml-1">Saved</span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-xs text-slate-400 ml-1">Saving…</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-600 ml-1">Failed to save flag</span>
          )}
        </label>
        {isFlagged && (
          <div className="mt-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={flagNotes}
              onChange={(e) => onChangeNotes(e.target.value)}
              rows={2}
              placeholder="What stood out about this conversation?"
              className="w-full px-2 py-1.5 rounded border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          </div>
        )}
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
