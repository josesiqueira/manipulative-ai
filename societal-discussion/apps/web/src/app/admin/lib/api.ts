/**
 * Thin fetch wrapper for the admin API.
 *
 * All requests attach the X-Admin-Password header so the FastAPI
 * `verify_admin` dependency accepts them.  A non-2xx response always
 * throws an Error — callers (TanStack Query or plain try/catch) handle
 * the failure explicitly.
 *
 * Why a single adminFetch helper instead of per-endpoint fetch calls?
 * Header injection and error normalisation are cross-cutting concerns.
 * Centralising them here means every future endpoint gets auth and
 * consistent error messages for free.
 */

import type {
  ChatListResponse,
  ChatDetailResponse,
  DetailedStatsResponse,
  StatsResponse,
  StatementListResponse,
  ConversationFilters,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Core fetch helper.  Attaches the admin password header, checks the
 * response status, and deserialises JSON.
 *
 * @param path     - API path starting with '/', e.g. '/api/admin/stats'
 * @param password - Value for the X-Admin-Password header
 * @param options  - Optional fetch init (method, body, extra headers, …)
 * @returns        - Parsed JSON body typed as T
 * @throws         - Error with status code and status text on non-2xx
 */
async function adminFetch<T>(
  path: string,
  password: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Build a URLSearchParams string from an object, skipping keys whose
 * value is undefined or an empty string.  This avoids sending
 * `?political_block=&topic_category=` which would confuse the backend
 * filter logic.
 */
function buildQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ---------------------------------------------------------------------------
// Typed endpoint helpers
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/chats
 * Returns a paginated, filterable list of chats for the conversation browser.
 *
 * @param password  - Admin password
 * @param filters   - Optional filter values (undefined keys are omitted from the query string)
 * @param page      - 1-based page number (default 1)
 * @param perPage   - Items per page (default 20)
 */
export async function getChatList(
  password: string,
  filters: ConversationFilters = {},
  page = 1,
  perPage = 20,
): Promise<ChatListResponse> {
  const qs = buildQueryString({
    political_block: filters.political_block,
    topic_category: filters.topic_category,
    detection_result: filters.detection_result,
    language: filters.language,
    search: filters.search,
    page,
    per_page: perPage,
  });
  return adminFetch<ChatListResponse>(`/api/admin/chats${qs}`, password);
}

/**
 * GET /api/admin/chats/{chatId}/detail
 * Returns the full chat record: messages, survey answers, participant
 * demographics, and the few-shot priming cache.
 *
 * @param password - Admin password
 * @param chatId   - UUID string of the target chat
 */
export async function getChatDetail(
  password: string,
  chatId: string,
): Promise<ChatDetailResponse> {
  return adminFetch<ChatDetailResponse>(
    `/api/admin/chats/${encodeURIComponent(chatId)}/detail`,
    password,
  );
}

/**
 * GET /api/admin/stats/detailed
 * Returns multi-dimensional statistics used by the dashboard charts:
 * block accuracy, persuasiveness heatmap, length distribution, and
 * coverage matrix.
 *
 * @param password - Admin password
 */
export async function getDetailedStats(
  password: string,
): Promise<DetailedStatsResponse> {
  return adminFetch<DetailedStatsResponse>('/api/admin/stats/detailed', password);
}

/**
 * GET /api/admin/stats
 * Returns the basic experiment statistics (totals, averages).
 * Used on the settings page and anywhere a quick summary is needed.
 *
 * @param password - Admin password
 */
export async function getBasicStats(password: string): Promise<StatsResponse> {
  return adminFetch<StatsResponse>('/api/admin/stats', password);
}

/**
 * GET /api/admin/statements
 * Returns a paginated list of political statements with optional
 * filtering by block and/or topic.
 *
 * @param password - Admin password
 * @param filters  - Optional block and topic filters
 * @param page     - 1-based page number (default 1)
 * @param perPage  - Items per page (default 20)
 */
export async function getStatements(
  password: string,
  filters: { political_block?: string; topic_category?: string } = {},
  page = 1,
  perPage = 20,
): Promise<StatementListResponse> {
  const qs = buildQueryString({
    political_block: filters.political_block,
    topic_category: filters.topic_category,
    page,
    per_page: perPage,
  });
  return adminFetch<StatementListResponse>(`/api/admin/statements${qs}`, password);
}

/**
 * Build a download URL for the export endpoint.
 *
 * The backend requires the password via the X-Admin-Password *header*, so a
 * plain window.location.href redirect cannot be used for authenticated
 * downloads.  Callers should fetch the URL with adminFetch (or a raw fetch
 * that sets the header), receive the response as a Blob, and then create an
 * object URL to trigger the browser save dialog:
 *
 *   const url = getExportUrl(password, 'csv', filters);
 *   const res = await fetch(url, { headers: { 'X-Admin-Password': password } });
 *   const blob = await res.blob();
 *   const link = document.createElement('a');
 *   link.href = URL.createObjectURL(blob);
 *   link.download = 'export.csv';
 *   link.click();
 *
 * `getExportUrl` is a pure function that builds the path+query string without
 * any fetch side-effects; the caller decides how to initiate the download.
 *
 * @param password - Admin password (used by the caller in the header, not embedded in the URL)
 * @param format   - 'csv' for spreadsheet export, 'text' for ZIP of transcripts
 * @param filters  - Optional conversation filters to narrow the export
 */
export function getExportUrl(
  password: string,
  format: 'csv' | 'text',
  filters: ConversationFilters = {},
): string {
  // password is accepted as a parameter for API symmetry; callers must pass it
  // as a header when fetching this URL — see the docstring above.
  void password;

  const params = new URLSearchParams();
  params.set('format', format);

  if (filters.political_block) params.set('political_block', filters.political_block);
  if (filters.topic_category) params.set('topic_category', filters.topic_category);
  if (filters.detection_result) params.set('detection_result', filters.detection_result);
  if (filters.language) params.set('language', filters.language);

  return `${API_BASE}/api/admin/export?${params.toString()}`;
}
