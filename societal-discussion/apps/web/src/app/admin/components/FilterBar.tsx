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
    </div>
  );
}
