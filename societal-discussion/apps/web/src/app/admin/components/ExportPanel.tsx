'use client';

import { useState } from 'react';
import { getConversationList } from '../lib/api';
import { PARTIES, PARTY_DISPLAY_NAMES } from '../lib/types';
import type { ConversationFilters } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ExportFilters extends ConversationFilters {
  date_from?: string;
  date_to?: string;
}

interface ExportPanelProps {
  password: string;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const SELECT_CLS =
  'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

export default function ExportPanel({ password }: ExportPanelProps) {
  const [filters, setFilters] = useState<ExportFilters>({});
  const [format, setFormat] = useState<'csv' | 'json' | 'text'>('csv');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setFilter<K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    setPreviewCount(null);
  }

  async function handlePreview() {
    if (!password) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await getConversationList(password, filters, 1, 1);
      setPreviewCount(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleExport() {
    if (!password) return;
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('format', format);

      if (filters.assigned_party) params.set('assigned_party', filters.assigned_party);
      if (filters.date_from)      params.set('date_from',       filters.date_from);
      if (filters.date_to)        params.set('date_to',          filters.date_to);

      const res = await fetch(`${API_BASE}/api/admin/export?${params.toString()}`, {
        headers: { 'X-Admin-Password': password },
      });

      if (!res.ok) {
        throw new Error(`Export failed: ${res.status} ${res.statusText}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;

      const ext = format === 'text' ? 'zip' : format;
      anchor.download = `export-${Date.now()}.${ext}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Party */}
        <Field label="Puolue">
          <select
            value={filters.assigned_party ?? ''}
            onChange={(e) => setFilter('assigned_party', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Kaikki puolueet</option>
            {PARTIES.map((p) => (
              <option key={p} value={p}>
                {PARTY_DISPLAY_NAMES[p]}
              </option>
            ))}
          </select>
        </Field>

        {/* Date from */}
        <Field label="Alkaen">
          <input
            type="date"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilter('date_from', e.target.value)}
            className={SELECT_CLS}
          />
        </Field>

        {/* Date to */}
        <Field label="Asti">
          <input
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilter('date_to', e.target.value)}
            className={SELECT_CLS}
          />
        </Field>
      </div>

      {/* Format selector */}
      <Field label="Formaatti">
        <div className="flex gap-4">
          {(['csv', 'json', 'text'] as const).map((f) => (
            <label key={f} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="export-format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                className="accent-blue-600"
              />
              <span className="text-sm text-slate-700">
                {f === 'csv' ? 'CSV' : f === 'json' ? 'JSON' : 'Teksti (ZIP)'}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {/* Error message */}
      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing || !password}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white
                     text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          {previewing ? 'Lasketaan...' : 'Esikatsele maara'}
        </button>

        {previewCount !== null && (
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{previewCount}</span>
            {' '}keskustelua vastaa suodattimia
          </span>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !password}
          className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white font-medium
                     hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                     transition-colors"
        >
          {exporting ? 'Ladataan...' : 'Lataa'}
        </button>
      </div>
    </div>
  );
}
