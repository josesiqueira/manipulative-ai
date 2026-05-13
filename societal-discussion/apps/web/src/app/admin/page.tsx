'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getStats } from './lib/api';
import type { DailyStatsResponse, StatsResponse } from './lib/types';
import { PARTY_DISPLAY_NAMES, PARTY_COLORS } from './lib/types';
import MetricCard from './components/MetricCard';
import AdminBarChart from './components/AdminBarChart';
import RefreshButton from './components/RefreshButton';
import DailyChart from './components/DailyChart';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchDailyStats(
  password: string,
  days = 7,
): Promise<DailyStatsResponse> {
  // Kept inline (rather than added to lib/api.ts) because Stream B's brief
  // forbids modifying lib/api.ts.  Behaviour mirrors the adminFetch helper:
  // Same headers, same error shape.
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

export default function DashboardPage() {
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [daily, setDaily] = useState<DailyStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

  // Track the latest password without re-creating the fetcher on each render.
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
      const [s, d] = await Promise.all([
        getStats(pw),
        fetchDailyStats(pw, 7),
      ]);
      setStats(s);
      setDaily(d);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Initial fetch once we have the password.
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

  // Auto-refresh: poll every 10 seconds when enabled.
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

  // Build chart data for conversations by party
  const partyChartData = Object.entries(stats.conversations_by_party).map(
    ([party, count]) => ({
      name: PARTY_DISPLAY_NAMES[party] || party,
      value: count,
      color: PARTY_COLORS[party] || '#6B7280',
    }),
  );

  const completionPct = `${Math.round((stats.completion_rate ?? 0) * 100)}%`;

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

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <MetricCard label="Sessions" value={stats.total_sessions} />
        <MetricCard label="Conversations" value={stats.total_conversations} />
        <MetricCard label="Completed" value={stats.completed_conversations} />
        <MetricCard label="Messages" value={stats.total_messages} />
        <MetricCard label="Surveys" value={stats.total_surveys} />
        <MetricCard
          label="Completion %"
          value={completionPct}
          tooltip="Completed conversations divided by total. A completed conversation is one where the participant pressed 'End conversation' and submitted the survey."
        />
        <MetricCard
          label="Today"
          value={stats.conversations_today}
          tooltip="Conversations started today (Europe/Helsinki time)."
        />
        <MetricCard
          label="Flagged"
          value={stats.flagged_count}
          accent="red"
          tooltip="Conversations you've manually flagged for follow-up review."
        />
      </div>

      {/* Conversations by party chart */}
      {partyChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Conversations by party
          </h2>
          <AdminBarChart data={partyChartData} height={300} />
        </div>
      )}

      {/* Conversations per day chart */}
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
