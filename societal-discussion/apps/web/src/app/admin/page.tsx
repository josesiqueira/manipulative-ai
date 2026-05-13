'use client';

import { useEffect, useState } from 'react';
import { getStats } from './lib/api';
import type { StatsResponse } from './lib/types';
import { PARTY_DISPLAY_NAMES, PARTY_COLORS } from './lib/types';
import MetricCard from './components/MetricCard';
import AdminBarChart from './components/AdminBarChart';

export default function DashboardPage() {
  const [password, setPassword] = useState('');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pw = sessionStorage.getItem('adminPassword') || '';
    setPassword(pw);
  }, []);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const data = await getStats(password);
        if (!cancelled) setStats(data);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [password]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-slate-400 animate-pulse">Loading...</span>
      </div>
    );
  }

  // Build chart data for conversations by party
  const partyChartData = Object.entries(stats.conversations_by_party).map(([party, count]) => ({
    name: PARTY_DISPLAY_NAMES[party] || party,
    value: count,
    color: PARTY_COLORS[party] || '#6B7280',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Experiment overview</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <MetricCard label="Sessions" value={stats.total_sessions} />
        <MetricCard label="Conversations" value={stats.total_conversations} />
        <MetricCard label="Completed" value={stats.completed_conversations} />
        <MetricCard label="Messages" value={stats.total_messages} />
        <MetricCard label="Surveys" value={stats.total_surveys} />
      </div>

      {/* Conversations by party chart */}
      {partyChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Conversations by party
          </h2>
          <AdminBarChart
            data={partyChartData}
            height={300}
          />
        </div>
      )}
    </div>
  );
}
