'use client';

import { useState, useEffect, useMemo } from 'react';
import FilterBar from '../components/FilterBar';
import ConversationList from '../components/ConversationList';
import ConversationDetail from '../components/ConversationDetail';
import { getConversationList, getConversationDetail } from '../lib/api';
import type {
  ConversationListResponse,
  ConversationListItem,
  ConversationDetailResponse,
  ConversationFilters,
} from '../lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Hits /api/admin/conversations directly so we can pass date_from / date_to,
// which the shared `getConversationList` helper does not forward yet.  If the
// backend rejects the params (older deploy), we fall back to the helper and
// filter client-side.
async function fetchConversationsWithDates(
  password: string,
  filters: ConversationFilters,
  page: number,
  perPage = 20,
): Promise<{ data: ConversationListResponse; serverFilteredDates: boolean }> {
  const params = new URLSearchParams();
  if (filters.assigned_party) params.set('assigned_party', filters.assigned_party);
  if (filters.search) params.set('search', filters.search);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  params.set('page', String(page));
  params.set('per_page', String(perPage));

  try {
    const res = await fetch(
      `${API_BASE}/api/admin/conversations?${params.toString()}`,
      { headers: { 'X-Admin-Password': password } },
    );
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = (await res.json()) as ConversationListResponse;
    return { data, serverFilteredDates: true };
  } catch (err) {
    // Fallback: shared helper (no date params) + client-side date filter
    console.warn('Falling back to client-side date filtering', err);
    const data = await getConversationList(password, filters, page, perPage);
    return { data, serverFilteredDates: false };
  }
}

function withinDateRange(
  conv: ConversationListItem,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!dateFrom && !dateTo) return true;
  const ts = new Date(conv.started_at).getTime();
  if (dateFrom) {
    const fromTs = new Date(`${dateFrom}T00:00:00`).getTime();
    if (ts < fromTs) return false;
  }
  if (dateTo) {
    const toTs = new Date(`${dateTo}T23:59:59.999`).getTime();
    if (ts > toTs) return false;
  }
  return true;
}

export default function ConversationsPage() {
  const [password, setPassword] = useState('');
  const [filters, setFilters] = useState<ConversationFilters>({});
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState<ConversationListResponse | null>(null);
  const [serverFilteredDates, setServerFilteredDates] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetailResponse | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setPassword(sessionStorage.getItem('adminPassword') || '');
  }, []);

  // Fetch conversation list
  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    setListLoading(true);

    fetchConversationsWithDates(password, filters, page)
      .then(({ data, serverFilteredDates: sf }) => {
        if (!cancelled) {
          setListData(data);
          setServerFilteredDates(sf);
        }
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setListLoading(false); });

    return () => { cancelled = true; };
  }, [password, filters, page]);

  // Fetch detail when selected
  useEffect(() => {
    if (!password || !selectedId) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);

    getConversationDetail(password, selectedId)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setDetailLoading(false); });

    return () => { cancelled = true; };
  }, [password, selectedId]);

  // If the server didn't honour the date params, apply them client-side.
  const visibleConversations = useMemo(() => {
    if (!listData) return [];
    if (serverFilteredDates) return listData.conversations;
    return listData.conversations.filter((c) =>
      withinDateRange(c, filters.date_from, filters.date_to),
    );
  }, [listData, serverFilteredDates, filters.date_from, filters.date_to]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Conversations</h1>
        <p className="text-sm text-slate-500 mt-1">Browse and review conversations</p>
      </div>

      <FilterBar filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1); }} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[70vh] overflow-y-auto">
          {listLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-slate-400 animate-pulse">Loading...</span>
            </div>
          ) : listData ? (
            <>
              <ConversationList
                conversations={visibleConversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              {/* Pagination */}
              {listData.total > 20 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 text-sm text-slate-500">
                  <span>{listData.total} conversations</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-2 py-1 rounded border border-slate-300 disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <span className="px-2 py-1">Page {page}</span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={listData.conversations.length < 20}
                      className="px-2 py-1 rounded border border-slate-300 disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Detail panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 max-h-[70vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-slate-400 animate-pulse">Loading...</span>
            </div>
          ) : detail ? (
            <ConversationDetail
              conversation={detail}
              onFlagChange={(id, isFlagged, flagNotes) => {
                // Update list + detail state in lockstep so the row badge
                // disappears immediately when the flag is removed.
                setListData((prev) =>
                  prev
                    ? {
                        ...prev,
                        conversations: prev.conversations.map((c) =>
                          c.id === id
                            ? { ...c, is_flagged: isFlagged, flag_notes: flagNotes }
                            : c,
                        ),
                      }
                    : prev,
                );
                setDetail((prev) =>
                  prev && prev.id === id
                    ? { ...prev, is_flagged: isFlagged, flag_notes: flagNotes }
                    : prev,
                );
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-400">
              Select a conversation from the list
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
