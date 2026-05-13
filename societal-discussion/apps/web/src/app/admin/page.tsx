'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStats, getConversationList } from './lib/api';
import type {
  ConversationListItem,
  ConversationListResponse,
  DailyStatsResponse,
  StatsResponse,
} from './lib/types';
import { PARTY_DISPLAY_NAMES, PARTY_COLORS } from './lib/types';
import RefreshButton from './components/RefreshButton';
import DailyChart from './components/DailyChart';
import HorizontalBarChart from './components/HorizontalBarChart';
import RecentActivity from './components/RecentActivity';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchDailyStats(
  password: string,
  days = 7,
): Promise<DailyStatsResponse> {
  const res = await fetch(`${API_BASE}/api/admin/stats/daily?days=${days}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as DailyStatsResponse;
}

// Hero card — large, top-left in the F-pattern.
function HeroCard({
  total,
  today,
  yesterday,
}: {
  total: number;
  today: number;
  yesterday: number;
}) {
  const delta = today - yesterday;
  const trendColor =
    delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-400';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 col-span-2 row-span-2">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        Conversations
      </p>
      <p className="text-5xl font-semibold text-slate-900 mt-2 tabular-nums">
        {total}
      </p>
      <p className="text-xs text-slate-400 mt-1">since launch</p>
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
          Today
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-semibold text-slate-900 tabular-nums">
            {today}
          </span>
          <span className={`text-xs font-medium ${trendColor} tabular-nums`}>
            {arrow} {delta >= 0 ? '+' : ''}
            {delta} vs yesterday
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1 tabular-nums">
          {yesterday} yesterday
        </p>
      </div>
    </div>
  );
}

// Compact secondary metric card.
function CompactMetric({
  label,
  value,
  hint,
  accent,
  tooltip,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'red' | 'emerald' | 'blue';
  tooltip?: string;
}) {
  const valueColor =
    accent === 'red'
      ? 'text-rose-600'
      : accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'blue'
      ? 'text-blue-600'
      : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative group">
      <div className="flex items-center gap-1">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
          {label}
        </p>
        {tooltip && (
          <span className="text-[10px] text-slate-400 cursor-help">ⓘ</span>
        )}
      </div>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${valueColor}`}>
        {value}
      </p>
      {hint && <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{hint}</p>}
      {tooltip && (
        <div className="pointer-events-none absolute top-full left-0 mt-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded-md px-2 py-1.5 w-56 leading-snug shadow-lg">
          {tooltip}
        </div>
      )}
    </div>
  );
}

// Language split bar — single 2-color stacked bar showing FI vs EN proportion.
function LanguageSplit({ fi, en }: { fi: number; en: number }) {
  const total = fi + en;
  const fiPct = total > 0 ? (fi / total) * 100 : 0;
  const enPct = total > 0 ? (en / total) * 100 : 0;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        Language
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-900 tabular-nums">
          {fi}
        </span>
        <span className="text-xs text-slate-400">FI</span>
        <span className="text-slate-300">·</span>
        <span className="text-2xl font-semibold text-slate-900 tabular-nums">
          {en}
        </span>
        <span className="text-xs text-slate-400">EN</span>
      </div>
      {total > 0 && (
        <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            className="bg-blue-500"
            style={{ width: `${fiPct}%` }}
            title={`Finnish ${Math.round(fiPct)}%`}
          />
          <div
            className="bg-amber-400"
            style={{ width: `${enPct}%` }}
            title={`English ${Math.round(enPct)}%`}
          />
        </div>
      )}
      {total === 0 && (
        <p className="text-xs text-slate-400 mt-2">No conversations yet</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [daily, setDaily] = useState<DailyStatsResponse | null>(null);
  const [recent, setRecent] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  const passwordRef = useRef('');

  useEffect(() => {
    const pw = sessionStorage.getItem('adminPassword') || '';
    passwordRef.current = pw;
    setPassword(pw);
  }, []);

  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  const fetchAll = useCallback(async () => {
    const pw = passwordRef.current;
    if (!pw) return;
    try {
      const [s, d, list]: [StatsResponse, DailyStatsResponse, ConversationListResponse] = await Promise.all([
        getStats(pw),
        fetchDailyStats(pw, 7),
        getConversationList(pw, {}, 1, 20),
      ]);
      setStats(s);
      setDaily(d);
      setRecent(list.conversations);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }, []);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await fetchAll();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [password, fetchAll]);

  useEffect(() => {
    if (!isAutoRefreshing || !password) return;
    const id = setInterval(() => {
      fetchAll();
    }, 10_000);
    return () => clearInterval(id);
  }, [isAutoRefreshing, password, fetchAll]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-400 animate-pulse">Loading...</span>
      </div>
    );
  }

  const completionPct = `${Math.round((stats.completion_rate ?? 0) * 100)}%`;
  const partyChartData = Object.entries(stats.conversations_by_party).map(
    ([party, count]) => ({
      key: party,
      label: PARTY_DISPLAY_NAMES[party] || party,
      value: count,
      color: PARTY_COLORS[party] || '#6B7280',
    }),
  );

  const avgMessages =
    stats.total_conversations > 0
      ? (stats.total_messages / stats.total_conversations).toFixed(1)
      : '–';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Experiment overview</p>
        </div>
        <RefreshButton
          onRefresh={fetchAll}
          lastUpdated={lastUpdated}
          isAutoRefreshing={isAutoRefreshing}
          onToggleAutoRefresh={setIsAutoRefreshing}
        />
      </div>

      {/* Hero + key secondary metrics (F-pattern top-left) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <HeroCard
          total={stats.total_conversations}
          today={stats.conversations_today}
          yesterday={stats.conversations_yesterday}
        />
        <LanguageSplit fi={stats.conversations_fi} en={stats.conversations_en} />
        <CompactMetric
          label="Completion"
          value={completionPct}
          hint={`${stats.completed_conversations} / ${stats.total_conversations}`}
          tooltip="Conversations where the participant pressed 'End conversation' and submitted the survey."
        />
        <CompactMetric
          label="Flagged"
          value={stats.flagged_count}
          accent={stats.flagged_count > 0 ? 'red' : undefined}
          tooltip="Conversations you've manually flagged for follow-up review."
        />
        <CompactMetric
          label="Avg msgs / conv"
          value={avgMessages}
          tooltip="Average number of messages per conversation, including both participant and bot turns."
        />
        <CompactMetric
          label="Sessions"
          value={stats.total_sessions}
          hint={`${stats.total_messages} messages · ${stats.total_surveys} surveys`}
          tooltip="Unique participant sessions (each session can hold multiple conversations)."
        />
        <CompactMetric
          label="Saved test runs"
          value={stats.test_conversations_saved}
          tooltip="Test-bot conversations the researcher explicitly clicked 'Save this conversation' on. Excluded from all real-participant counts."
        />
      </div>

      {/* Two-column row: party distribution + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Conversations by party
            </h2>
            <span className="text-xs text-slate-400 tabular-nums">
              {stats.total_conversations} total
            </span>
          </div>
          <HorizontalBarChart
            data={partyChartData}
            emptyLabel="No conversations yet — share the participant URL to start collecting data."
          />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Recent activity
            </h2>
            <span className="text-xs text-slate-400">latest 10</span>
          </div>
          <RecentActivity conversations={recent} />
        </div>
      </div>

      {/* Daily trend, full width */}
      {daily && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Conversations per day (last 7 days)
          </h2>
          <DailyChart data={daily} />
        </div>
      )}
    </div>
  );
}
