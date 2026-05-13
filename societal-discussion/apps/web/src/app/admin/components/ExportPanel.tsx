'use client';

import { useState } from 'react';
import { getConversationList } from '../lib/api';
import { PARTIES, PARTY_DISPLAY_NAMES } from '../lib/types';
import type { ConversationFilters } from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type ExportFormat = 'csv' | 'json' | 'text' | 'messages-csv' | 'messages-json';

interface ExportFilters extends ConversationFilters {
  date_from?: string;
  date_to?: string;
}

interface ExportPanelProps {
  password: string;
}

interface FormatOption {
  value: ExportFormat;
  label: string;
  tooltip: string;
  group: 'conversation' | 'message';
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'csv',
    label: 'CSV',
    tooltip: 'One row per conversation. Full transcript is in a single column.',
    group: 'conversation',
  },
  {
    value: 'json',
    label: 'JSON',
    tooltip: 'One record per conversation. Structured, easy to parse programmatically.',
    group: 'conversation',
  },
  {
    value: 'text',
    label: 'Text (ZIP)',
    tooltip: 'One .txt transcript file per conversation, packaged in a ZIP.',
    group: 'conversation',
  },
  {
    value: 'messages-csv',
    label: 'CSV — messages',
    tooltip: 'One row per individual message. Use this for turn-level analysis.',
    group: 'message',
  },
  {
    value: 'messages-json',
    label: 'JSON — messages',
    tooltip: 'One record per individual message. Structured.',
    group: 'message',
  },
];

const SURVEY_COLUMNS = [
  'session_id',
  'submitted_at',
  'chatbot_usage',
  'chatbot_which',
  'political_chatbot',
  'chatbot_perception',
  'conversation_reflection',
  'response_speed',
  'topic_variety',
  'detected_bias',
  'detected_terminology',
  'detected_persuasion',
  'notice_anything',
];

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

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <span
        aria-label="More info"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full
                   bg-slate-200 text-slate-600 text-[10px] font-bold cursor-help
                   group-hover:bg-slate-300 transition-colors"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                   w-56 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs leading-snug text-white
                   opacity-0 group-hover:opacity-100 transition-opacity
                   shadow-lg z-10 whitespace-normal text-center"
      >
        {text}
      </span>
    </span>
  );
}

const SELECT_CLS =
  'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function fileExtensionFor(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'text':
      return 'zip';
    case 'messages-csv':
      return 'csv';
    case 'messages-json':
      return 'json';
  }
}

function fileNameFor(format: ExportFormat): string {
  const today = new Date().toISOString().slice(0, 10);
  if (format === 'messages-csv') return `messages-export-${today}.csv`;
  if (format === 'messages-json') return `messages-export-${today}.json`;
  return `export-${today}.${fileExtensionFor(format)}`;
}

export default function ExportPanel({ password }: ExportPanelProps) {
  const [filters, setFilters] = useState<ExportFilters>({});
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeTest, setIncludeTest] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surveyDownloading, setSurveyDownloading] = useState<'csv' | 'json' | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);

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
      if (includeTest)            params.set('include_test',     'true');

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
      anchor.download = fileNameFor(format);
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function handleSurveyExport(surveyFormat: 'csv' | 'json') {
    if (!password) return;
    setSurveyDownloading(surveyFormat);
    setSurveyError(null);
    try {
      const url = `${API_BASE}/api/admin/export/surveys?format=${surveyFormat}`;
      const res = await fetch(url, {
        headers: { 'X-Admin-Password': password },
      });

      if (!res.ok) {
        throw new Error(`Survey export failed: ${res.status} ${res.statusText}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      const today = new Date().toISOString().slice(0, 10);
      anchor.download = `surveys-export-${today}.${surveyFormat}`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setSurveyError(err instanceof Error ? err.message : 'Survey export failed');
    } finally {
      setSurveyDownloading(null);
    }
  }

  const conversationFormats = FORMAT_OPTIONS.filter((f) => f.group === 'conversation');
  const messageFormats = FORMAT_OPTIONS.filter((f) => f.group === 'message');

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        {/* Filter row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Party */}
          <Field label="Party">
            <select
              value={filters.assigned_party ?? ''}
              onChange={(e) => setFilter('assigned_party', e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">All parties</option>
              {PARTIES.map((p) => (
                <option key={p} value={p}>
                  {PARTY_DISPLAY_NAMES[p]}
                </option>
              ))}
            </select>
          </Field>

          {/* Date from */}
          <Field label="From">
            <input
              type="date"
              value={filters.date_from ?? ''}
              onChange={(e) => setFilter('date_from', e.target.value)}
              className={SELECT_CLS}
            />
          </Field>

          {/* Date to */}
          <Field label="To">
            <input
              type="date"
              value={filters.date_to ?? ''}
              onChange={(e) => setFilter('date_to', e.target.value)}
              className={SELECT_CLS}
            />
          </Field>
        </div>

        {/* Format selector */}
        <Field label="Format">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Conversation level</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {conversationFormats.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-format"
                      value={f.value}
                      checked={format === f.value}
                      onChange={() => setFormat(f.value)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-slate-700">{f.label}</span>
                    <InfoTooltip text={f.tooltip} />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Message level</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {messageFormats.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-format"
                      value={f.value}
                      checked={format === f.value}
                      onChange={() => setFormat(f.value)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-slate-700">{f.label}</span>
                    <InfoTooltip text={f.tooltip} />
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Field>

        {/* Include test mode */}
        <Field label="Options">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => setIncludeTest(e.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span className="flex flex-col">
              <span className="text-sm text-slate-700">Include test-mode conversations</span>
              <span className="text-xs text-slate-500">
                Include conversations created from the Try-bot panel (excluded by default).
              </span>
            </span>
          </label>
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
            {previewing ? 'Calculating...' : 'Preview count'}
          </button>

          {previewCount !== null && (
            <span className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{previewCount}</span>
              {' '}conversations match the filters
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
            {exporting ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>

      {/* Survey responses section */}
      <div className="pt-6 border-t border-slate-200">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Survey responses</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Download all post-conversation survey responses. One row per submitted survey.
          </p>
        </div>

        {surveyError && (
          <p className="mb-3 text-sm text-rose-600 bg-rose-50 rounded-md px-3 py-2">
            {surveyError}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleSurveyExport('csv')}
            disabled={surveyDownloading !== null || !password}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white
                       text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            {surveyDownloading === 'csv' ? 'Downloading...' : 'Download CSV'}
          </button>
          <button
            type="button"
            onClick={() => handleSurveyExport('json')}
            disabled={surveyDownloading !== null || !password}
            className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white
                       text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            {surveyDownloading === 'json' ? 'Downloading...' : 'Download JSON'}
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600 mb-1.5">Columns included:</p>
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2
                          font-mono text-[11px] leading-relaxed text-slate-700 break-all">
            {SURVEY_COLUMNS.join(', ')}
          </div>
        </div>
      </div>
    </div>
  );
}
