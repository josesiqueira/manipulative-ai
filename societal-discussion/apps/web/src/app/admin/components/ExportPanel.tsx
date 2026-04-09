'use client';

/**
 * ExportPanel — filtered export controls for the Data & Export page.
 *
 * Renders four filter dropdowns (block, topic, detection result, language),
 * a date-range pair, a format selector (CSV vs. text/ZIP), a preview-count
 * button, and the download button.
 *
 * Why blob download instead of window.location.href?
 * The backend requires an X-Admin-Password *header*; browser-initiated GET
 * redirects cannot set custom headers.  We fetch the export as a Blob, create
 * a temporary object URL, and click a synthetic <a> element — this is the
 * standard pattern for authenticated file downloads in the browser.
 *
 * Preview count reuses getChatList(password, filters, 1, 1) and reads
 * response.total — it piggybacks on the existing filtered chat list endpoint
 * rather than needing a separate count endpoint.
 */

import { useState } from 'react';
import { getChatList } from '../lib/api';
import { POLITICAL_BLOCKS, TOPIC_CATEGORIES, TOPIC_LABELS } from '../lib/types';
import type { ConversationFilters } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ---- Extended filter shape (adds date range fields not in ConversationFilters) --

interface ExportFilters extends ConversationFilters {
  date_from?: string;
  date_to?: string;
}

// ---- Component props ---------------------------------------------------------

interface ExportPanelProps {
  /** Admin password from sessionStorage — required for the authenticated download. */
  password: string;
}

// ---- Sub-component: labelled form row ----------------------------------------

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

// ---- Shared select style constant --------------------------------------------

const SELECT_CLS =
  'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

// ---- Component ---------------------------------------------------------------

export default function ExportPanel({ password }: ExportPanelProps) {
  const [filters, setFilters] = useState<ExportFilters>({});
  const [format, setFormat] = useState<'csv' | 'text'>('csv');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Patch a single filter key without touching the rest. */
  function setFilter<K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
    // Invalidate the cached count whenever filters change.
    setPreviewCount(null);
  }

  // --------------------------------------------------------------------------
  // Preview count — fetches page 1 of 1 to read the total field.
  // --------------------------------------------------------------------------

  async function handlePreview() {
    if (!password) return;
    setPreviewing(true);
    setError(null);
    try {
      const res = await getChatList(password, filters, 1, 1);
      setPreviewCount(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  }

  // --------------------------------------------------------------------------
  // Blob download — authenticated export.
  // --------------------------------------------------------------------------

  async function handleExport() {
    if (!password) return;
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('format', format);

      if (filters.political_block) params.set('political_block', filters.political_block);
      if (filters.topic_category)  params.set('topic_category',  filters.topic_category);
      if (filters.detection_result) params.set('detection_result', filters.detection_result);
      if (filters.language)        params.set('language',         filters.language);
      if (filters.date_from)       params.set('date_from',        filters.date_from);
      if (filters.date_to)         params.set('date_to',          filters.date_to);

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
      anchor.download =
        format === 'text'
          ? `export-${Date.now()}.zip`
          : `export-${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* ---- Filter row ---------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Block */}
        <Field label="Block">
          <select
            value={filters.political_block ?? ''}
            onChange={(e) => setFilter('political_block', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All blocks</option>
            {POLITICAL_BLOCKS.map((b) => (
              <option key={b} value={b}>
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        {/* Topic */}
        <Field label="Topic">
          <select
            value={filters.topic_category ?? ''}
            onChange={(e) => setFilter('topic_category', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All topics</option>
            {TOPIC_CATEGORIES.map((t) => (
              <option key={t} value={t}>
                {TOPIC_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </Field>

        {/* Detection */}
        <Field label="Detection">
          <select
            value={filters.detection_result ?? ''}
            onChange={(e) => setFilter('detection_result', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All results</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
            <option value="pending">Pending</option>
          </select>
        </Field>

        {/* Language */}
        <Field label="Language">
          <select
            value={filters.language ?? ''}
            onChange={(e) => setFilter('language', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="fi">Finnish</option>
          </select>
        </Field>
      </div>

      {/* ---- Date range ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="From date">
          <input
            type="date"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilter('date_from', e.target.value)}
            className={SELECT_CLS}
          />
        </Field>
        <Field label="To date">
          <input
            type="date"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilter('date_to', e.target.value)}
            className={SELECT_CLS}
          />
        </Field>
      </div>

      {/* ---- Format selector ----------------------------------------------- */}
      <Field label="Format">
        <div className="flex gap-4">
          {(['csv', 'text'] as const).map((f) => (
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
                {f === 'csv' ? 'CSV spreadsheet' : 'Text transcripts (ZIP)'}
              </span>
            </label>
          ))}
        </div>
      </Field>

      {/* ---- Error message ------------------------------------------------- */}
      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {/* ---- Action row ---------------------------------------------------- */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Preview count button */}
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing || !password}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white
                     text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          {previewing ? 'Counting…' : 'Preview count'}
        </button>

        {/* Count badge — appears after a successful preview */}
        {previewCount !== null && (
          <span className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{previewCount}</span>
            {' '}conversation{previewCount !== 1 ? 's' : ''} match the current filters
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Export / download button */}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !password}
          className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white font-medium
                     hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                     transition-colors"
        >
          {exporting
            ? 'Downloading…'
            : format === 'text'
            ? 'Download ZIP'
            : 'Download CSV'}
        </button>
      </div>
    </div>
  );
}
