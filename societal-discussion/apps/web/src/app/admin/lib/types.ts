// Conversation list — GET /api/admin/conversations
export interface ConversationListItem {
  id: string;
  session_id: string;
  assigned_party: string;
  starter_topic: string | null;
  started_at: string;
  ended_at: string | null;
  message_count: number;
  is_complete: boolean;
  is_test_mode: boolean;
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
  starter_topic: string | null;
  started_at: string;
  ended_at: string | null;
  is_complete: boolean;
  is_test_mode: boolean;
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
}

// Domain constants — keep in sync with apps/api/src/services/party_grounding.py
export const PARTIES = [
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

export const PARTY_DISPLAY_NAMES: Record<string, string> = {
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

// Colors loosely match each party's brand identity while staying visually
// distinct in charts and badges.
export const PARTY_COLORS: Record<string, string> = {
  sdp: '#DC2626',                  // red
  vasemmistoliitto: '#9333EA',     // purple (brand red would clash with SDP)
  vihreat: '#16A34A',              // emerald green
  rkp: '#FACC15',                  // yellow
  keskusta: '#65A30D',             // olive green
  kokoomus: '#2563EB',             // royal blue
  perussuomalaiset: '#1E3A8A',     // navy blue
  kristillisdemokraatit: '#F59E0B',// amber
  liikenyt: '#0D9488',             // teal
};
