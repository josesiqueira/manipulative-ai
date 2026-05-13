'use client';

import { PARTIES, PARTY_DISPLAY_NAMES } from '../lib/types';
import type { ConversationFilters } from '../lib/types';

interface FilterBarProps {
  filters: ConversationFilters;
  onFiltersChange: (filters: ConversationFilters) => void;
}

export default function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Party filter */}
      <select
        value={filters.assigned_party || ''}
        onChange={(e) => onFiltersChange({ ...filters, assigned_party: e.target.value || undefined })}
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white"
      >
        <option value="">All parties</option>
        {PARTIES.map((p) => (
          <option key={p} value={p}>{PARTY_DISPLAY_NAMES[p]}</option>
        ))}
      </select>

      {/* Search */}
      <input
        type="text"
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined })}
        placeholder="Search in messages..."
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white w-48"
      />

      {/* Date range */}
      <label className="flex items-center gap-1.5 text-sm text-slate-600">
        <span>From</span>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, date_from: e.target.value || undefined })
          }
          className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white"
        />
      </label>
      <label className="flex items-center gap-1.5 text-sm text-slate-600">
        <span>To</span>
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={(e) =>
            onFiltersChange({ ...filters, date_to: e.target.value || undefined })
          }
          className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white"
        />
      </label>

      {(filters.date_from || filters.date_to) && (
        <button
          type="button"
          onClick={() =>
            onFiltersChange({ ...filters, date_from: undefined, date_to: undefined })
          }
          className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
        >
          Clear dates
        </button>
      )}
    </div>
  );
}
