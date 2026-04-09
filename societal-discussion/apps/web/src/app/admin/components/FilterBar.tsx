'use client';

/**
 * FilterBar — horizontal row of filter controls above the conversation list.
 *
 * Design reference: COMPONENTS.md § FilterBar
 *
 * Renders four selects (block, topic, detection result, language) and a text
 * search input. Each change replaces the entire ConversationFilters object so
 * the parent never has to merge partial updates itself.
 *
 * Empty-string select values are normalised to `undefined` before the callback
 * fires — this keeps the filter object clean and avoids sending empty query
 * parameters to the API.
 *
 * An active filter (non-default value) gets a visual highlight on the select
 * element so the researcher can quickly see which dimensions are restricted.
 */

import { ConversationFilters, POLITICAL_BLOCKS, TOPIC_CATEGORIES, TOPIC_LABELS } from '../lib/types';

interface FilterBarProps {
  filters: ConversationFilters;
  onChange: (filters: ConversationFilters) => void;
}

/**
 * Shared Tailwind classes for every select and input.
 * Defined once here to guarantee consistency and to make COMPONENTS.md's
 * class list easy to update in a single place.
 */
const BASE_CONTROL_CLASSES =
  'px-3 py-1.5 text-sm border rounded-md bg-white text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600';

/**
 * Returns the border class for a select based on whether a non-default value
 * is selected. An active filter shows bg-blue-50 + border-blue-300 per the
 * design spec; default is border-slate-300.
 */
function selectClasses(isActive: boolean): string {
  return `${BASE_CONTROL_CLASSES} ${
    isActive ? 'bg-blue-50 border-blue-300' : 'border-slate-300'
  }`;
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  /**
   * Produce an updated filter object by merging a single key change.
   * Empty string → undefined so API callers receive clean params.
   */
  function update(key: keyof ConversationFilters, rawValue: string): void {
    const value = rawValue === '' ? undefined : rawValue;
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Block filter */}
      <select
        value={filters.political_block ?? ''}
        onChange={(e) => update('political_block', e.target.value)}
        className={selectClasses(!!filters.political_block)}
        aria-label="Filter by political block"
      >
        <option value="">All Blocks</option>
        {POLITICAL_BLOCKS.map((block) => (
          <option key={block} value={block}>
            {/* Capitalise each word of the block name for display */}
            {block
              .split('-')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join('-')}
          </option>
        ))}
      </select>

      {/* Topic filter */}
      <select
        value={filters.topic_category ?? ''}
        onChange={(e) => update('topic_category', e.target.value)}
        className={selectClasses(!!filters.topic_category)}
        aria-label="Filter by topic"
      >
        <option value="">All Topics</option>
        {TOPIC_CATEGORIES.map((topic) => (
          <option key={topic} value={topic}>
            {TOPIC_LABELS[topic] ?? topic}
          </option>
        ))}
      </select>

      {/* Detection result filter */}
      <select
        value={filters.detection_result ?? ''}
        onChange={(e) => update('detection_result', e.target.value)}
        className={selectClasses(!!filters.detection_result)}
        aria-label="Filter by detection result"
      >
        <option value="">All Results</option>
        <option value="correct">Correct Guess</option>
        <option value="incorrect">Incorrect Guess</option>
        <option value="pending">Pending</option>
      </select>

      {/* Language filter */}
      <select
        value={filters.language ?? ''}
        onChange={(e) => update('language', e.target.value)}
        className={selectClasses(!!filters.language)}
        aria-label="Filter by language"
      >
        <option value="">All Languages</option>
        <option value="en">English</option>
        <option value="fi">Finnish</option>
      </select>

      {/* Free-text message search */}
      <input
        type="search"
        placeholder="Search messages..."
        value={filters.search ?? ''}
        onChange={(e) => update('search', e.target.value)}
        className={`${BASE_CONTROL_CLASSES} border-slate-300 placeholder:text-slate-400 min-w-[200px]`}
        aria-label="Search message content"
      />

      {/* Clear all filters — text-only link per design spec */}
      <button
        type="button"
        onClick={() => onChange({})}
        className="ml-auto text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
      >
        Clear filters
      </button>
    </div>
  );
}
