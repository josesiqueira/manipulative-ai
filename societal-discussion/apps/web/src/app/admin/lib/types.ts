// Conversation list — GET /api/admin/conversations
export interface ConversationListItem {
  id: string;
  session_id: string;
  assigned_party: string;
  language: string;
  starter_topic: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  is_complete: boolean;
  is_test_mode: boolean;
  is_test_saved: boolean;
  is_flagged: boolean;
  flag_notes: string | null;
}

export interface ConversationListResponse {
  conversations: ConversationListItem[];
  total: number;
  page: number;
  per_page: number;
}

// Conversation detail
export interface MessageDetail {
  id: string;
  role: string;
  content: string;
  created_at: string;
  token_count: number | null;
}

export interface ConversationDetailResponse {
  id: string;
  session_id: string;
  assigned_party: string;
  language: string;
  starter_topic: string | null;
  started_at: string;
  ended_at: string | null;
  is_complete: boolean;
  is_test_mode: boolean;
  is_test_saved: boolean;
  is_flagged: boolean;
  flag_notes: string | null;
  messages: MessageDetail[];
}

// Stats
export interface StatsResponse {
  total_sessions: number;
  total_conversations: number;
  completed_conversations: number;
  total_messages: number;
  conversations_by_party: Record<string, number>;
  total_surveys: number;
  completion_rate: number;          // 0..1, multiply by 100 for display
  conversations_today: number;
  conversations_yesterday: number;
  flagged_count: number;
  conversations_fi: number;
  conversations_en: number;
  test_conversations_saved: number;
}

// Daily breakdown — GET /api/admin/stats/daily?days=7
export interface DailyStatsDay {
  date: string;                     // ISO YYYY-MM-DD (Europe/Helsinki)
  by_party: Record<string, number>; // sparse — parties with 0 may be omitted
  total: number;
}

export interface DailyStatsResponse {
  days: DailyStatsDay[];
}

// Session list
export interface SessionListItem {
  id: string;
  created_at: string;
  conversation_count: number;
  is_test_mode: boolean;
}

// Filters
export interface ConversationFilters {
  assigned_party?: string;
  search?: string;
  date_from?: string;               // ISO date (YYYY-MM-DD)
  date_to?: string;                 // ISO date (YYYY-MM-DD)
}

// Flag toggle — PATCH /api/admin/conversations/{id}/flag
export interface FlagConversationRequest {
  is_flagged: boolean;
  flag_notes?: string;
}

// Domain constants. Keep in sync with apps/api/src/services/party_grounding.py:
// 9 base parties plus a "<party>_populist" twin for each (18 conditions).
export const BASE_PARTIES = [
  'sdp',
  'vasemmistoliitto',
  'vihreat',
  'rkp',
  'keskusta',
  'kokoomus',
  'perussuomalaiset',
  'kristillisdemokraatit',
  'liikenyt',
] as const;

export const POPULIST_SUFFIX = '_populist';

export const PARTIES: readonly string[] = [
  ...BASE_PARTIES,
  ...BASE_PARTIES.map((p) => `${p}${POPULIST_SUFFIX}`),
];

export function isPopulist(party: string): boolean {
  return party.endsWith(POPULIST_SUFFIX);
}

export function baseParty(party: string): string {
  return isPopulist(party) ? party.slice(0, -POPULIST_SUFFIX.length) : party;
}

const BASE_DISPLAY_NAMES: Record<string, string> = {
  sdp: 'SDP',
  vasemmistoliitto: 'Vasemmistoliitto',
  vihreat: 'Vihreät',
  rkp: 'RKP',
  keskusta: 'Keskusta',
  kokoomus: 'Kokoomus',
  perussuomalaiset: 'Perussuomalaiset',
  kristillisdemokraatit: 'Kristillisdemokraatit',
  liikenyt: 'Liike Nyt',
};

export const PARTY_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  PARTIES.map((p) => [
    p,
    isPopulist(p) ? `${BASE_DISPLAY_NAMES[baseParty(p)]} Populist` : BASE_DISPLAY_NAMES[p],
  ]),
);

// Base colors loosely match each party's brand identity while staying
// visually distinct in charts and badges. The populist twin uses a darker
// shade of the same hue so the pair reads as related but separate. All 18
// values are unique.
const BASE_COLORS: Record<string, string> = {
  sdp: '#DC2626',                   // red
  vasemmistoliitto: '#9333EA',      // purple (brand red would clash with SDP)
  vihreat: '#16A34A',               // emerald green
  rkp: '#FACC15',                   // yellow
  keskusta: '#65A30D',              // olive green
  kokoomus: '#2563EB',              // royal blue
  perussuomalaiset: '#1E3A8A',      // navy blue
  kristillisdemokraatit: '#F59E0B', // amber
  liikenyt: '#0D9488',              // teal
};

const POPULIST_COLORS: Record<string, string> = {
  sdp: '#7F1D1D',
  vasemmistoliitto: '#581C87',
  vihreat: '#14532D',
  rkp: '#A16207',
  keskusta: '#365314',
  kokoomus: '#1E40AF',
  perussuomalaiset: '#0C1E55',      // unchanged from the HEPP2026 value
  kristillisdemokraatit: '#92400E',
  liikenyt: '#134E4A',
};

export const PARTY_COLORS: Record<string, string> = Object.fromEntries(
  PARTIES.map((p) => [p, isPopulist(p) ? POPULIST_COLORS[baseParty(p)] : BASE_COLORS[p]]),
);
