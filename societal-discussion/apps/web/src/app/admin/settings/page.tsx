'use client';

/**
 * Settings page — /admin/settings
 *
 * Two vertical sections, each independently fetching its current values on
 * mount and saving via PUT.  Sections are:
 *   1. Experiment Config  — metadata and operational limits
 *   2. LLM Provider       — API keys, model selection, active provider
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

// ---------------------------------------------------------------------------
// Shared form element classes
// ---------------------------------------------------------------------------

const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
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

  if (loading) return <p className="text-sm text-slate-400">Ladataan...</p>;
  if (!config) return <p className="text-sm text-red-500">{error ?? 'Failed to load'}</p>;

  return (
    <div className="space-y-4">
      {/* Bilingual names */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Kokeilun nimi (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={config.experiment_name_en}
            onChange={(e) => update('experiment_name_en', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Kokeilun nimi (FI)</label>
          <input
            type="text"
            className={inputClass}
            value={config.experiment_name_fi}
            onChange={(e) => update('experiment_name_fi', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Instituutio (EN)</label>
          <input
            type="text"
            className={inputClass}
            value={config.institution_name_en ?? ''}
            onChange={(e) => update('institution_name_en', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Instituutio (FI)</label>
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
          <label className={labelClass}>Vastuullinen tutkija</label>
          <input
            type="text"
            className={inputClass}
            value={config.principal_investigator_name ?? ''}
            onChange={(e) => update('principal_investigator_name', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Tutkijan sähköposti</label>
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
          <label className={labelClass}>Eettinen toimikunta</label>
          <input
            type="text"
            className={inputClass}
            value={config.ethics_board_name ?? ''}
            onChange={(e) => update('ethics_board_name', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Eettisen arvion viitenumero</label>
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
          <label className={labelClass}>Alkamispäivä</label>
          <input
            type="date"
            className={inputClass}
            value={config.start_date ?? ''}
            onChange={(e) => update('start_date', e.target.value || null)}
          />
        </div>
        <div>
          <label className={labelClass}>Päättymispäivä</label>
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
          <label className={labelClass}>Vähimmäisviestit ennen kyselyä</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={config.min_exchanges_before_survey}
            onChange={(e) => update('min_exchanges_before_survey', parseInt(e.target.value, 10))}
          />
        </div>
        <div>
          <label className={labelClass}>Enimmäisviestit per keskustelu</label>
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
          <label className={labelClass}>Aikakatkaisu (minuuttia)</label>
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
        <span className="text-sm font-medium text-slate-700">Kokeilu aktiivinen</span>
      </label>

      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Tallennettu</span>}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: LLM Provider
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
          api_key: apiKey === '' ? null : apiKey,
          selected_model: selectedModel || null,
        }),
      });
      setSuccess(true);
      setApiKey('');
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="active_provider"
            checked={config.is_active}
            onChange={() => onSetActive(config.provider)}
            className="w-4 h-4 border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">Aktiivinen</span>
        </label>
      </div>

      {/* Model selector */}
      {providerModels.length > 0 && (
        <div>
          <label className={labelClass}>Malli</label>
          <select
            className={inputClass}
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <option value="">— valitse malli —</option>
            {providerModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* API key input */}
      <div>
        <label className={labelClass}>
          API-avain{' '}
          {config.has_key && (
            <span className="font-mono text-xs text-slate-400">
              (nykyinen: {config.api_key_preview})
            </span>
          )}
        </label>
        <input
          type="password"
          className={inputClass}
          placeholder={config.has_key ? 'Jätä tyhjäksi säilyttääksesi nykyisen' : 'Syötä API-avain'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="flex items-center gap-3">
        <SaveButton isLoading={saving} onClick={save} />
        {success && <span className="text-sm text-green-600">Tallennettu</span>}
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
      setConfigs((prev) => prev.map((c) => ({ ...c, is_active: c.provider === provider })));
    } catch (e: unknown) {
      console.error('Failed to set active provider:', e);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Ladataan...</p>;
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
// Page root
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-900">Asetukset</h1>
      <p className="text-sm text-slate-500 mt-1 mb-8">
        Kokeilun asetukset ja LLM-palvelimen konfigurointi.
      </p>

      {/* Section 1 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">Kokeilun asetukset</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Metatiedot, toiminnalliset rajat ja kokeilun aktiivisuus.
        </p>
        <ExperimentSection />
      </section>

      <hr className="my-8 border-slate-200" />

      {/* Section 2 */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900">LLM-palvelin</h2>
        <p className="text-sm text-slate-500 mt-0.5 mb-4">
          Aseta API-avaimet, valitse mallit ja valitse aktiivinen palveluntarjoaja.
          Vain yksi palveluntarjoaja voi olla aktiivinen kerrallaan.
        </p>
        <LLMSection />
      </section>

      {/* Bottom padding */}
      <div className="h-16" />
    </div>
  );
}
