'use client';

import { useState, useEffect } from 'react';
import FilterBar from '../components/FilterBar';
import ConversationList from '../components/ConversationList';
import ConversationDetail from '../components/ConversationDetail';
import { getConversationList, getConversationDetail } from '../lib/api';
import type { ConversationListResponse, ConversationDetailResponse, ConversationFilters } from '../lib/types';

export default function ConversationsPage() {
  const [password, setPassword] = useState('');
  const [filters, setFilters] = useState<ConversationFilters>({});
  const [page, setPage] = useState(1);
  const [listData, setListData] = useState<ConversationListResponse | null>(null);
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

    getConversationList(password, filters, page)
      .then((data) => { if (!cancelled) setListData(data); })
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Keskustelut</h1>
        <p className="text-sm text-slate-500 mt-1">Selaa ja tarkastele keskusteluja</p>
      </div>

      <FilterBar filters={filters} onFiltersChange={(f) => { setFilters(f); setPage(1); }} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* List panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[70vh] overflow-y-auto">
          {listLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-slate-400 animate-pulse">Ladataan...</span>
            </div>
          ) : listData ? (
            <>
              <ConversationList
                conversations={listData.conversations}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
              {/* Pagination */}
              {listData.total > 20 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 text-sm text-slate-500">
                  <span>{listData.total} keskustelua</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-2 py-1 rounded border border-slate-300 disabled:opacity-30"
                    >
                      Edellinen
                    </button>
                    <span className="px-2 py-1">Sivu {page}</span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={listData.conversations.length < 20}
                      className="px-2 py-1 rounded border border-slate-300 disabled:opacity-30"
                    >
                      Seuraava
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
              <span className="text-slate-400 animate-pulse">Ladataan...</span>
            </div>
          ) : detail ? (
            <ConversationDetail conversation={detail} />
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-400">
              Valitse keskustelu listasta
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
