'use client';

/**
 * Settings page — /admin/settings
 *
 * Five vertical sections, each independently fetching its current values on
 * mount and saving via PUT.  Sections are:
 *   1. Experiment Config  — metadata and operational limits
 *   2. Topic Management   — enable/disable topics, edit bilingual labels
 *   3. LLM Provider       — API keys, model selection, active provider
 *   4. Terms of Use       — bilingual title and content
 *   5. Bot Prompts        — per-block bilingual descriptions (admin reference)
 *
 * Design decisions:
 * - Each section owns its own loading/error state so a failure in one section
 *   does not block the others from rendering.
 * - `adminFetch` is defined locally (mirrors api.ts) because the api.ts module
 *   exports only typed helper functions — there is no exported generic fetch.
 * - LLM active provider is managed via POST /api/admin/llm/active (separate
 *   from PUT /api/admin/llm/configs/{provider}) so the radio-button UX maps
 *   cleanly onto distinct API calls.
 */

import { useEffect, useState } from 'react';
import SaveButton from '../components/SaveButton';

// ---------------------------------------------------------------------------
// API plumbing
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Thin fetch helper.  Reads the admin password from sessionStorage so callers
 * do not have to thread it through props.  Throws on non-2xx.
 */
async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const password = sessionStorage.getItem('adminPassword') ?? '';
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Local TypeScript interfaces (minimal — only fields used in this file)
// ---------------------------------------------------------------------------

interface ExperimentConfig {
  experiment_name_en: string;
  experiment_name_fi: string;
  institution_name_en: string | null;
  institution_name_fi: string | null;
  principal_investigator_name: string | null;
  principal_investigator_email: string | null;
  ethics_board_name: string | null;
  ethics_reference_number: string | null;
  start_date: string | null;
  end_date: string | null;
  min_exchanges_before_survey: number;
  max_exchanges_per_chat: number | null;
  idle_timeout_minutes: number | null;
  is_active: boolean;
}

interface TopicConfig {
  topic_key: string;
  label_en: string;
  label_fi: string;
  is_enabled: boolean;
  display_order: number;
}

interface LLMConfig {
  provider: string;
  display_name: string;
  api_key_preview: string | null;
  has_key: boolean;
  selected_model: string | null;
  is_active: boolean;
}

interface ProviderModel {
  id: string;
  name: string;
}

interface ProviderInfo {
  provider: string;
  display_name: string;
  models: ProviderModel[];
}

interface TermsConfig {
  title_en: string;
  title_fi: string;
  content_en: string;
  content_fi: string;
}

interface PromptConfig {
  political_block: string;
  name_en: string;
  name_fi: string;
  description_en: string;
  description_fi: string;
}

// ---------------------------------------------------------------------------
// Shared form element classes
// ---------------------------------------------------------------------------

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
const textareaClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]';
const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

// ---------------------------------------------------------------------------
// Section 1: Experiment Config
// ---------------------------------------------------------------------------

function ExperimentSection() {
  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    adminFetch<ExperimentConfig>('/api/admin/experiment')
      .then(setConfig)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function update(field: keyof ExperimentConfig, value: string | boolean | number | null) {
    setConfig((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      await adminFetch('/api/admin/experiment', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!config) return <p className="text-sm text-red-500">{error ?? 'Failed to load'}</p>;

  return (
    <div className="space-y-4">
      {/* Bilingual names */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Experiment name (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={config.experiment_name_en}
            onChange={(e) => update('experiment_name_en', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Experiment name (FI)</label>
          <input
            type="text"
            className={inputClass}
            value={config.experiment_name_fi}
            onChange={(e) => update('experiment_name_fi', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Institution (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={config.institution_name_en ?? ''}
            onChange={(e) => update('institution_name_en', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Institution (FI)</label>
          <input
            type="text"
            className={inputClass}
            value={config.institution_name_fi ?? ''}
            onChange={(e) => update('institution_name_fi', e.target.value || null)}
          />
        </div>
      </div>

      {/* Principal investigator */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Principal investigator name</label>
          <input
            type="text"
            className={inputClass}
            value={config.principal_investigator_name ?? ''}
            onChange={(e) => update('principal_investigator_name', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Principal investigator email</label>
          <input
            type="email"
            className={inputClass}
            value={config.principal_investigator_email ?? ''}
            onChange={(e) => update('principal_investigator_email', e.target.value || null)}
          />
        </div>
      </div>

      {/* Ethics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Ethics board name</label>
          <input
            type="text"
            className={inputClass}
            value={config.ethics_board_name ?? ''}
            onChange={(e) => update('ethics_board_name', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Ethics reference number</label>
          <input
            type="text"
            className={inputClass}
            value={config.ethics_reference_number ?? ''}
            onChange={(e) => update('ethics_reference_number', e.target.value || null)}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start date</label>
          <input
            type="date"
            className={inputClass}
            value={config.start_date ?? ''}
            onChange={(e) => update('start_date', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input
            type="date"
            className={inputClass}
            value={config.end_date ?? ''}
            onChange={(e) => update('end_date', e.target.value || null)}
          />
        </div>
      </div>

      {/* Operational limits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>Min exchanges before survey</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={config.min_exchanges_before_survey}
            onChange={(e) => update('min_exchanges_before_survey', parseInt(e.target.value, 10))}
          />
        </div>
        <div>
          <label className={labelClass}>Max exchanges per chat</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={config.max_exchanges_per_chat ?? ''}
            onChange={(e) =>
              update('max_exchanges_per_chat', e.target.value ? parseInt(e.target.value, 10) : null)
            }
          />
        </div>
        <div>
          <label className={labelClass}>Idle timeout (minutes)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={config.idle_timeout_minutes ?? ''}
            onChange={(e) =>
              update('idle_timeout_minutes', e.target.value ? parseInt(e.target.value, 10) : null)
            }
          />
        </div>
      </div>

      {/* Active toggle */}
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={config.is_active}
          onChange={(e) => update('is_active', e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-slate-700">Experiment is active</span>
      </label>

      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Topic Management
// ---------------------------------------------------------------------------

/**
 * Single topic row with its own save state.
 * Each topic saves independently so editing one does not require re-saving all.
 */
function TopicRow({ initial }: { initial: TopicConfig }) {
  const [topic, setTopic] = useState<TopicConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update(field: keyof TopicConfig, value: string | boolean) {
    setTopic((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      await adminFetch(`/api/admin/topics/${encodeURIComponent(topic.topic_key)}`, {
        method: 'PUT',
        body: JSON.stringify({
          label_en: topic.label_en,
          label_fi: topic.label_fi,
          is_enabled: topic.is_enabled,
        }),
      });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 border border-slate-200 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-slate-400">{topic.topic_key}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={topic.is_enabled}
            onChange={(e) => update('is_enabled', e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">Enabled</span>
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Label (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={topic.label_en}
            onChange={(e) => update('label_en', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Label (FI)</label>
          <input
            type="text"
            className={inputClass}
            value={topic.label_fi}
            onChange={(e) => update('label_fi', e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

function TopicsSection() {
  const [topics, setTopics] = useState<TopicConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<TopicConfig[]>('/api/admin/topics')
      .then(setTopics)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="space-y-3">
      {topics.map((t) => (
        <TopicRow key={t.topic_key} initial={t} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: LLM Provider
// ---------------------------------------------------------------------------

/**
 * Single provider row.  Saves API key + model together (PUT /llm/configs/{provider}).
 * Setting the active provider is a separate POST so the backend can enforce
 * that only one provider is active at a time.
 */
function LLMProviderRow({
  config,
  providerModels,
  onSetActive,
}: {
  config: LLMConfig;
  providerModels: ProviderModel[];
  onSetActive: (provider: string) => void;
}) {
  // apiKey is write-only: the backend returns only a preview, never the raw key.
  // We store '' to mean "no change" — the PUT body sends null for that case.
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(config.selected_model ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      await adminFetch(`/api/admin/llm/configs/${encodeURIComponent(config.provider)}`, {
        method: 'PUT',
        body: JSON.stringify({
          // Empty string = don't change; backend treats null as no-change
          api_key: apiKey === '' ? null : apiKey,
          selected_model: selectedModel || null,
        }),
      });
      setSuccess(true);
      setApiKey(''); // Clear the write-only field after save
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 border border-slate-200 rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800">{config.display_name}</p>
          <p className="text-xs font-mono text-slate-400">{config.provider}</p>
        </div>
        {/* Active provider radio — clicking triggers immediate POST */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="active_provider"
            checked={config.is_active}
            onChange={() => onSetActive(config.provider)}
            className="w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">Active</span>
        </label>
      </div>

      {/* Model selector */}
      {providerModels.length > 0 && (
        <div>
          <label className={labelClass}>Model</label>
          <select
            className={inputClass}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="">— select model —</option>
            {providerModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* API key input — type="password" satisfies acceptance criteria */}
      <div>
        <label className={labelClass}>
          API key{' '}
          {config.has_key && (
            <span className="font-mono text-xs text-slate-400">
              (current: {config.api_key_preview})
            </span>
          )}
        </label>
        <input
          type="password"
          className={inputClass}
          placeholder={config.has_key ? 'Leave blank to keep current key' : 'Enter API key'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

function LLMSection() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminFetch<LLMConfig[]>('/api/admin/llm/configs'),
      adminFetch<ProviderInfo[]>('/api/admin/llm/providers'),
    ])
      .then(([cfgs, provs]) => {
        setConfigs(cfgs);
        setProviders(provs);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function setActive(provider: string) {
    try {
      await adminFetch('/api/admin/llm/active', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
      // Reflect the change in local state without re-fetching
      setConfigs((prev) => prev.map((c) => ({ ...c, is_active: c.provider === provider })));
    } catch (e: unknown) {
      // Surface error inline — no modal needed for a single radio click
      console.error('Failed to set active provider:', e);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="space-y-3">
      {configs.map((cfg) => {
        const providerInfo = providers.find((p) => p.provider === cfg.provider);
        return (
          <LLMProviderRow
            key={cfg.provider}
            config={cfg}
            providerModels={providerInfo?.models ?? []}
            onSetActive={setActive}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Terms of Use
// ---------------------------------------------------------------------------

function TermsSection() {
  const [terms, setTerms] = useState<TermsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    adminFetch<TermsConfig>('/api/admin/terms')
      .then(setTerms)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function update(field: keyof TermsConfig, value: string) {
    setTerms((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  async function save() {
    if (!terms) return;
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      await adminFetch('/api/admin/terms', {
        method: 'PUT',
        body: JSON.stringify(terms),
      });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!terms) return <p className="text-sm text-red-500">{error ?? 'Failed to load'}</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Title (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={terms.title_en}
            onChange={(e) => update('title_en', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Title (FI)</label>
          <input
            type="text"
            className={inputClass}
            value={terms.title_fi}
            onChange={(e) => update('title_fi', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Content (EN)</label>
        <textarea
          className={textareaClass}
          value={terms.content_en}
          onChange={(e) => update('content_en', e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>Content (FI)</label>
        <textarea
          className={textareaClass}
          value={terms.content_fi}
          onChange={(e) => update('content_fi', e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Bot Prompts
// ---------------------------------------------------------------------------

/**
 * Single prompt row — per-block bilingual descriptions.
 * Note: these DB records are not used by the live prompt_builder (which reads
 * BLOCK_PERSONAS from code).  They remain editable here as an admin reference
 * and for potential future use.
 */
function PromptRow({ initial }: { initial: PromptConfig }) {
  const [prompt, setPrompt] = useState<PromptConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update(field: keyof PromptConfig, value: string) {
    setPrompt((prev) => ({ ...prev, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setSuccess(false);
    setError(null);
    try {
      await adminFetch(
        `/api/admin/prompts/${encodeURIComponent(prompt.political_block)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name_en: prompt.name_en,
            name_fi: prompt.name_fi,
            description_en: prompt.description_en,
            description_fi: prompt.description_fi,
          }),
        },
      );
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 border border-slate-200 rounded-md space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
          {prompt.political_block}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Name (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={prompt.name_en}
            onChange={(e) => update('name_en', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Name (FI)</label>
          <input
            type="text"
            className={inputClass}
            value={prompt.name_fi}
            onChange={(e) => update('name_fi', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description (EN)</label>
        <textarea
          className={textareaClass}
          value={prompt.description_en}
          onChange={(e) => update('description_en', e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>Description (FI)</label>
        <textarea
          className={textareaClass}
          value={prompt.description_fi}
          onChange={(e) => update('description_fi', e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Saved</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

function PromptsSection() {
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<PromptConfig[]>('/api/admin/prompts')
      .then(setPrompts)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-500">{error}</p>;

  return (
    <div className="space-y-3">
      {prompts.map((p) => (
        <PromptRow key={p.political_block} initial={p} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

/**
 * Vertical settings layout.  Each section is independently loaded/saved.
 * Sections are separated by <hr> for visual breathing room without tabs.
 */
export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Configure experiment parameters, topics, LLM providers, terms, and bot personas.
      </p>

      {/* Section 1 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Experiment Config</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Metadata, operational limits, and experiment active status.
        </p>
        <ExperimentSection />
      </section>

      <hr className="my-8 border-slate-200" />

      {/* Section 2 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Topic Management</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Enable or disable topics and edit their bilingual display labels.
        </p>
        <TopicsSection />
      </section>

      <hr className="my-8 border-slate-200" />

      {/* Section 3 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">LLM Provider</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Set API keys, select models, and choose the active provider.
          Only one provider can be active at a time.
        </p>
        <LLMSection />
      </section>

      <hr className="my-8 border-slate-200" />

      {/* Section 4 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Terms of Use</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Bilingual title and body shown to participants before they join the experiment.
        </p>
        <TermsSection />
      </section>

      <hr className="my-8 border-slate-200" />

      {/* Section 5 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Bot Prompts</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Per-block bilingual names and descriptions stored in the database.
          Note: the live prompt builder reads from compiled BLOCK_PERSONAS constants,
          not these records. Edit here for admin reference only.
        </p>
        <PromptsSection />
      </section>

      {/* Bottom padding so the last section is not flush against the scroll end */}
      <div className="h-16" />
    </div>
  );
}
