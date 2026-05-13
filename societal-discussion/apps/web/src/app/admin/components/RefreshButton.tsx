'use client';

/**
 * RefreshButton — compact dashboard control that fires a manual refresh,
 * shows a "Last updated N ago" relative timestamp, and toggles auto-refresh
 * every 10 seconds.
 *
 * The component owns only the relative-time tick (re-rendering every 10s so
 * the timestamp stays current); the actual fetching, auto-refresh interval,
 * and `lastUpdated` state are owned by the parent so the same fetch function
 * can be reused elsewhere.
 */

import { useEffect, useState } from 'react';

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  lastUpdated: Date | null;
  isAutoRefreshing: boolean;
  onToggleAutoRefresh: (v: boolean) => void;
}

function formatRelative(date: Date | null, now: number): string {
  if (!date) return 'never';
  const diffSec = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
}

export default function RefreshButton({
  onRefresh,
  lastUpdated,
  isAutoRefreshing,
  onToggleAutoRefresh,
}: RefreshButtonProps) {
  // Re-render every 10 seconds so the "last updated" label stays fresh even
  // without a refetch.  We track `now` rather than reading Date.now() inline
  // so React schedules the re-render.
  const [now, setNow] = useState<number>(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="tabular-nums">
        Last updated {formatRelative(lastUpdated, now)}
      </span>

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span
          aria-hidden
          className={busy ? 'inline-block animate-spin' : 'inline-block'}
        >
          ↻
        </span>
        {busy ? 'Refreshing…' : 'Refresh'}
      </button>

      <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAutoRefreshing}
          onChange={(e) => onToggleAutoRefresh(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-slate-700 focus:ring-slate-400"
        />
        <span>Auto-refresh (10s)</span>
      </label>
    </div>
  );
}
