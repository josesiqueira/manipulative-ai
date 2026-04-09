'use client';

/**
 * Conversation Browser — /admin/conversations
 *
 * Two-panel layout: a filterable, paginated chat list on the left and a full
 * conversation detail panel on the right.  On mobile (<lg breakpoint) only one
 * panel is visible at a time; a "Back to list" button lets the user return from
 * the detail view.
 *
 * State management is plain useState + useEffect (no TanStack Query) as
 * specified in PLAN.md § Phase 5, task 4.  Three independent effects handle:
 *   1. Reading the admin password from sessionStorage on mount
 *   2. Fetching the chat list whenever password, filters, or page changes
 *   3. Fetching the full chat detail whenever the selected chat ID changes
 *
 * The password is read asynchronously in an effect (not synchronously at
 * render time) because sessionStorage is not available during Next.js
 * server-side rendering.
 */

import { useState, useEffect } from 'react';
import FilterBar from '../components/FilterBar';
import ChatList from '../components/ChatList';
import ChatDetail from '../components/ChatDetail';
import { getChatList, getChatDetail } from '../lib/api';
import type { ChatListResponse, ChatDetailResponse, ConversationFilters } from '../lib/types';

export default function ConversationsPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  /** Admin password recovered from sessionStorage on mount. */
  const [password, setPassword] = useState('');

  /** Active filter values — each key is optional; undefined means "no filter". */
  const [filters, setFilters] = useState<ConversationFilters>({});

  /** 1-based current page number for the chat list. */
  const [page, setPage] = useState(1);

  /** Paginated chat list returned by the API, or null before the first fetch. */
  const [chatList, setChatList] = useState<ChatListResponse | null>(null);

  /** UUID of the currently selected chat, or null if none selected. */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Full detail for the selected chat, or null when nothing is selected. */
  const [chatDetail, setChatDetail] = useState<ChatDetailResponse | null>(null);

  /** True while the list fetch is in-flight; drives skeleton placeholders. */
  const [listLoading, setListLoading] = useState(true);

  /** True while the detail fetch is in-flight; drives ChatDetail skeleton. */
  const [detailLoading, setDetailLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Effect 1 — Read password from sessionStorage on mount
  //
  // sessionStorage is unavailable during SSR, so we must read it inside an
  // effect rather than synchronously at module load time.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setPassword(sessionStorage.getItem('adminPassword') || '');
  }, []);

  // ---------------------------------------------------------------------------
  // Effect 2 — Fetch the chat list whenever password, filters, or page changes
  //
  // We bail early when the password is empty (e.g. before Effect 1 completes
  // or when the user is not authenticated) to avoid a spurious 401 request.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!password) return;

    setListLoading(true);
    getChatList(password, filters, page, 20)
      .then((data) => {
        setChatList(data);
        setListLoading(false);
      })
      .catch(() => {
        // Non-fatal: leave chatList as the previous value so the UI doesn't
        // blank out; the loading indicator stops regardless.
        setListLoading(false);
      });
  }, [password, filters, page]);

  // ---------------------------------------------------------------------------
  // Effect 3 — Fetch full chat detail whenever the selected ID changes
  //
  // Clearing selectedId resets chatDetail to null, which causes ChatDetail to
  // render its "Select a conversation" empty state.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!password || !selectedId) {
      setChatDetail(null);
      return;
    }

    setDetailLoading(true);
    getChatDetail(password, selectedId)
      .then((data) => {
        setChatDetail(data);
        setDetailLoading(false);
      })
      .catch(() => {
        setDetailLoading(false);
      });
  }, [password, selectedId]);

  // ---------------------------------------------------------------------------
  // Filter change handler
  //
  // Whenever any filter dimension changes we reset both the page number and the
  // selection so the detail panel doesn't show a chat that may not appear in
  // the new filtered list.
  // ---------------------------------------------------------------------------
  function handleFiltersChange(newFilters: ConversationFilters): void {
    setFilters(newFilters);
    setPage(1);
    setSelectedId(null);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    /**
     * The outer container fills the viewport height minus the top nav bar
     * (approx 6rem).  The two child panels are positioned inside a flex row
     * that fills the remaining space below the h1 + FilterBar.
     */
    <div className="h-[calc(100vh-6rem)]">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">Conversations</h1>

      <FilterBar filters={filters} onChange={handleFiltersChange} />

      {/* Two-panel layout — h-[calc(100%-8rem)] accounts for the h1 + FilterBar height */}
      <div className="mt-4 flex gap-4 h-[calc(100%-8rem)]">

        {/* ------------------------------------------------------------------ */}
        {/* Left panel — chat list                                             */}
        {/* On mobile: hidden when a chat is selected (detail view is shown).  */}
        {/* On desktop: always visible at 40% width.                          */}
        {/* ------------------------------------------------------------------ */}
        <div
          className={`${
            selectedId ? 'hidden lg:flex' : 'flex'
          } flex-col w-full lg:w-[40%] border border-slate-200 rounded-lg bg-white overflow-hidden`}
        >
          {listLoading ? (
            /* Skeleton: 5 gray rectangles sized to match real list rows */
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : chatList ? (
            <ChatList
              chats={chatList.chats}
              total={chatList.total}
              page={chatList.page}
              perPage={chatList.per_page}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPageChange={setPage}
            />
          ) : null}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Right panel — chat detail                                          */}
        {/* On mobile: hidden when no chat is selected (list view is shown).   */}
        {/* On desktop: always visible at 60% width with independent scroll.  */}
        {/* ------------------------------------------------------------------ */}
        <div
          className={`${
            !selectedId ? 'hidden lg:block' : 'block'
          } w-full lg:w-[60%] border border-slate-200 rounded-lg bg-white overflow-y-auto`}
        >
          {/* Mobile back button — not rendered on lg+ screens */}
          {selectedId && (
            <button
              type="button"
              className="lg:hidden px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              onClick={() => setSelectedId(null)}
            >
              ← Back to list
            </button>
          )}

          <div className="p-4">
            <ChatDetail chat={chatDetail} isLoading={detailLoading} />
          </div>
        </div>

      </div>
    </div>
  );
}
