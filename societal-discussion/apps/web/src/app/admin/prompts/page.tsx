'use client';

import { useState, useEffect } from 'react';
import { PARTY_COLORS } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PromptConfig {
  party: string;
  party_display_name: string;
  system_instruction: string;
  source: 'database' | 'default';
  prompt_preview: string;
  updated_at: string | null;
}

export default function PromptsPage() {
  const [password, setPassword] = useState('');
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingParty, setEditingParty] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setPassword(sessionStorage.getItem('adminPassword') || '');
  }, []);

  const fetchPrompts = async () => {
    if (!password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/prompts`, {
        headers: { 'X-Admin-Password': password },
      });
      if (res.ok) {
        setPrompts(await res.json());
      }
    } catch (err) {
      console.error('Failed to load prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [password]);

  const startEditing = (prompt: PromptConfig) => {
    setEditingParty(prompt.party);
    setEditText(prompt.system_instruction);
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingParty(null);
    setEditText('');
    setMessage(null);
  };

  const savePrompt = async (party: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/prompts/${party}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ system_instruction: editText }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Saved!' });
        setEditingParty(null);
        await fetchPrompts();
      } else {
        setMessage({ type: 'error', text: 'Save failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error.' });
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = async (party: string) => {
    if (!confirm('Restore the default prompt? The custom text will be deleted.')) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/prompts/${party}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Restored to default.' });
        setEditingParty(null);
        await fetchPrompts();
      }
    } catch {
      setMessage({ type: 'error', text: 'Restore failed.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-400 animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Prompts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Edit the chatbot&apos;s behavior instructions for each party. The party program text is
          automatically appended after these instructions.
        </p>
      </div>

      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {prompts.map((prompt) => {
          const isEditing = editingParty === prompt.party;
          const color = PARTY_COLORS[prompt.party] || '#6B7280';

          return (
            <div
              key={prompt.party}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: color }}
                  >
                    {prompt.party_display_name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {prompt.source === 'database' ? (
                      <>Custom · {prompt.updated_at ? new Date(prompt.updated_at).toLocaleDateString('en-US') : ''}</>
                    ) : (
                      'Default'
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => startEditing(prompt)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => resetPrompt(prompt.party)}
                        disabled={saving || prompt.source === 'default'}
                        className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                      >
                        Restore default
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => savePrompt(prompt.party)}
                        disabled={saving}
                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4">
                {isEditing ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                    placeholder="Enter the system instruction..."
                  />
                ) : (
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {prompt.system_instruction}
                  </pre>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  The party program text is automatically appended after this instruction.
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
