'use client';

/**
 * Prompts — /admin/prompts
 *
 * Lets researchers view and edit the persona text that each political-block
 * agent receives as part of its system prompt.  Changes take effect on all
 * new chat messages immediately (no restart required).
 *
 * Each block is shown as a card with:
 *   - Bilingual persona textareas (EN / FI)
 *   - A collapsible "System prompt preview" showing the fully assembled prompt
 *   - Source badge ("database" vs "default")
 *   - Save / Reset to default actions
 */

import { useState, useEffect } from 'react';
import { getPrompts, updatePrompt, resetPrompt } from '../lib/api';
import type { LivePrompt } from '../lib/types';
import { BLOCK_COLORS } from '../lib/types';

// ---------------------------------------------------------------------------
// Per-block editor card
// ---------------------------------------------------------------------------

interface PromptCardProps {
  prompt: LivePrompt;
  password: string;
  onSaved: () => void;
}

function PromptCard({ prompt, password, onSaved }: PromptCardProps) {
  const [personaEn, setPersonaEn] = useState(prompt.persona_en);
  const [personaFi, setPersonaFi] = useState(prompt.persona_fi);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Sync local state when parent re-fetches after reset
  useEffect(() => {
    setPersonaEn(prompt.persona_en);
    setPersonaFi(prompt.persona_fi);
  }, [prompt.persona_en, prompt.persona_fi]);

  const dirty = personaEn !== prompt.persona_en || personaFi !== prompt.persona_fi;

  const blockColor = BLOCK_COLORS[prompt.political_block] || '#6B7280';

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      await updatePrompt(password, prompt.political_block, personaEn, personaFi);
      setSaveMsg('Saved');
      onSaved();
    } catch {
      setSaveMsg('Error saving');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 2500);
    }
  }

  async function handleReset() {
    if (!confirm(`Reset "${prompt.name_en}" to the hardcoded default? Your custom text will be deleted.`)) return;
    setResetting(true);
    try {
      await resetPrompt(password, prompt.political_block);
      onSaved();
    } catch {
      alert('Error resetting prompt');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: blockColor }}
          />
          <h2 className="text-base font-semibold text-slate-900">
            {prompt.name_en}
          </h2>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              prompt.source === 'database'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {prompt.source === 'database' ? 'Custom' : 'Default'}
          </span>
        </div>
        {prompt.updated_at && (
          <span className="text-xs text-slate-400">
            Updated {new Date(prompt.updated_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {/* English persona */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Persona text (English)
          </label>
          <textarea
            value={personaEn}
            onChange={(e) => setPersonaEn(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-y"
          />
        </div>

        {/* Finnish persona */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Persona text (Finnish)
          </label>
          <textarea
            value={personaFi}
            onChange={(e) => setPersonaFi(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       resize-y"
          />
        </div>

        {/* System prompt preview (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`w-4 h-4 transition-transform ${showPreview ? 'rotate-90' : ''}`}
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            System prompt preview (immigration / English)
          </button>
          {showPreview && (
            <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {prompt.system_prompt_preview}
            </pre>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-lg">
        <div>
          {prompt.source === 'database' && (
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting}
              className="text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              {resetting ? 'Resetting...' : 'Reset to default'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-sm ${saveMsg === 'Saved' ? 'text-green-600' : 'text-red-600'}`}>
              {saveMsg}
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              dirty && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function PromptsPage() {
  const [password, setPassword] = useState('');
  const [prompts, setPrompts] = useState<LivePrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPassword(sessionStorage.getItem('adminPassword') || '');
  }, []);

  function fetchPrompts() {
    if (!password) return;
    setLoading(true);
    getPrompts(password)
      .then(setPrompts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Prompts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Edit the persona text that each political-block agent uses. Changes take effect on new messages immediately.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.political_block}
              prompt={prompt}
              password={password}
              onSaved={fetchPrompts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
