import type {
  ConversationListResponse,
  ConversationDetailResponse,
  StatsResponse,
  SessionListItem,
  ConversationFilters,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export async function getConversationList(
  password: string,
  filters: ConversationFilters = {},
  page = 1,
  perPage = 20,
): Promise<ConversationListResponse> {
  const qs = buildQueryString({
    assigned_party: filters.assigned_party,
    search: filters.search,
    page,
    per_page: perPage,
  });
  return adminFetch<ConversationListResponse>(`/api/admin/conversations${qs}`, password);
}

export async function getConversationDetail(
  password: string,
  conversationId: string,
): Promise<ConversationDetailResponse> {
  return adminFetch<ConversationDetailResponse>(
    `/api/admin/conversations/${encodeURIComponent(conversationId)}/detail`,
    password,
  );
}

export async function getStats(password: string): Promise<StatsResponse> {
  return adminFetch<StatsResponse>('/api/admin/stats', password);
}

export async function getSessions(password: string): Promise<SessionListItem[]> {
  return adminFetch<SessionListItem[]>('/api/admin/sessions', password);
}

export function getExportUrl(
  format: 'csv' | 'json' | 'text',
  filters: ConversationFilters = {},
): string {
  const params = new URLSearchParams();
  params.set('format', format);
  if (filters.assigned_party) params.set('assigned_party', filters.assigned_party);
  return `${API_BASE}/api/admin/export?${params.toString()}`;
}
