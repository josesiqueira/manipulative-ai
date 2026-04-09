/**
 * TypeScript interfaces mirroring the backend Pydantic models in admin.py.
 *
 * Field names and nullability are kept in exact 1-to-1 correspondence with the
 * Python definitions so that consuming components never need defensive casts.
 *
 * One JSON-serialisation nuance: Python's dict[str, dict[int, int]] for
 * length_distribution has integer keys that JSON encodes as strings.  The
 * TypeScript type therefore uses Record<string, Record<string, number>>.
 */

// ---------------------------------------------------------------------------
// Chat list — GET /api/admin/chats
// ---------------------------------------------------------------------------

/** Single row returned by the paginated chat list endpoint. */
export interface ChatListItem {
  id: string;
  created_at: string;
  completed_at: string | null;
  political_block: string;
  topic_category: string;
  language: string;
  message_count: number;
  perceived_leaning: string | null;
  /** Computed on the server as perceived_leaning === political_block; null when not yet completed. */
  correct_guess: boolean | null;
  persuasiveness: number | null;
  naturalness: number | null;
  confidence: number | null;
  is_test_mode: boolean;
}

export interface ChatListResponse {
  chats: ChatListItem[];
  total: number;
  page: number;
  per_page: number;
}

// ---------------------------------------------------------------------------
// Chat detail — GET /api/admin/chats/{chat_id}/detail
// ---------------------------------------------------------------------------

/** Single message inside the chat detail view. */
export interface MessageDetail {
  id: string;
  role: string;
  content: string;
  created_at: string;
  token_count: number | null;
  examples_used_ids: number[] | null;
}

/** Participant demographics attached to a chat detail response. */
export interface ParticipantSummary {
  age_group: string | null;
  gender: string | null;
  education: string | null;
  political_leaning: number | null;
  political_knowledge: number | null;
}

/** Survey answers collected at the end of a conversation. */
export interface SurveyDetail {
  perceived_leaning: string | null;
  /** Computed — not stored in the database. */
  correct_guess: boolean | null;
  persuasiveness: number | null;
  naturalness: number | null;
  confidence: number | null;
}

/**
 * The few-shot priming cache stored on the Chat row.
 * Shape: { turns: [...], example_ids: [...], examples: [...] }
 * Matches Chat.few_shot_examples JSON column.
 */
export interface FewShotCache {
  turns: Array<{ role: string; content: string }>;
  example_ids: number[];
  examples: Array<{ text: string; topic_detailed: string; intention: string }>;
}

/** Full chat detail returned by the single-chat endpoint. */
export interface ChatDetailResponse {
  id: string;
  political_block: string;
  topic_category: string;
  language: string;
  created_at: string;
  completed_at: string | null;
  /** Nullable — only populated for chats where few-shot selection ran. */
  few_shot_examples: FewShotCache | null;
  messages: MessageDetail[];
  survey: SurveyDetail;
  participant: ParticipantSummary;
}

// ---------------------------------------------------------------------------
// Detailed statistics — GET /api/admin/stats/detailed
// ---------------------------------------------------------------------------

/** Per-block detection accuracy counts. */
export interface BlockAccuracy {
  total: number;
  correct: number;
  accuracy_pct: number;
}

/** Average persuasiveness rating and sample size for one block × topic cell. */
export interface PersuasivenessCell {
  avg: number;
  count: number;
}

/**
 * Multi-dimensional statistics for dashboard charts.
 *
 * length_distribution keys are stringified integers (JSON object key
 * limitation) representing exchange counts.
 * coverage_matrix counts the number of PoliticalStatement rows per cell.
 */
export interface DetailedStatsResponse {
  block_accuracy: Record<string, BlockAccuracy>;
  persuasiveness_matrix: Record<string, Record<string, PersuasivenessCell | null>>;
  /** block → stringified exchange count → number of chats */
  length_distribution: Record<string, Record<string, number>>;
  /** block → topic → statement count */
  coverage_matrix: Record<string, Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Political statements — GET /api/admin/statements
// ---------------------------------------------------------------------------

/** Single political statement row for admin inspection. */
export interface StatementItem {
  id: number;
  external_id: number;
  political_block: string;
  topic_category: string;
  topic_detailed: string;
  final_output_en: string;
  final_output_fi: string | null;
  intention_of_statement: string;
}

export interface StatementListResponse {
  statements: StatementItem[];
  total: number;
  page: number;
  per_page: number;
}

// ---------------------------------------------------------------------------
// Basic statistics — GET /api/admin/stats (existing endpoint)
// ---------------------------------------------------------------------------

/** Kept for the settings page and any basic stats display. */
export interface StatsResponse {
  total_participants: number;
  total_chats: number;
  completed_chats: number;
  total_messages: number;
  chats_by_block: Record<string, number>;
  chats_by_topic: Record<string, number>;
  correct_guesses: number;
  incorrect_guesses: number;
  avg_persuasiveness: number | null;
  avg_naturalness: number | null;
}

// ---------------------------------------------------------------------------
// Filter shape used by several API helpers
// ---------------------------------------------------------------------------

export interface ConversationFilters {
  political_block?: string;
  topic_category?: string;
  /** "correct" | "incorrect" | "pending" */
  detection_result?: string;
  language?: string;
  /** Full-text substring search across message content. */
  search?: string;
}

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

export const POLITICAL_BLOCKS = [
  'conservative',
  'red-green',
  'moderate',
  'dissatisfied',
] as const;

export const TOPIC_CATEGORIES = [
  'immigration',
  'healthcare',
  'economy',
  'education',
  'foreign_policy',
  'environment',
  'technology',
  'equality',
  'social_welfare',
] as const;

/**
 * Brand colours for political blocks.
 * Chosen to satisfy WCAG AA contrast on white backgrounds.
 */
export const BLOCK_COLORS: Record<string, string> = {
  conservative: '#2563EB',   // blue-600
  'red-green': '#059669',    // emerald-600
  moderate: '#D97706',       // amber-600
  dissatisfied: '#E11D48',   // rose-600
};

/** Human-readable labels for topic category keys. */
export const TOPIC_LABELS: Record<string, string> = {
  immigration: 'Immigration',
  healthcare: 'Healthcare',
  economy: 'Economy',
  education: 'Education',
  foreign_policy: 'Foreign Policy',
  environment: 'Environment',
  technology: 'Technology',
  equality: 'Equality',
  social_welfare: 'Social Welfare',
};
