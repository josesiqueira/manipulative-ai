// The backend calls the participant pages need. Runs in client scripts.
import type { Language } from './strings';

// Empty means the app's own origin (the dev server proxies /api to the API).
export const API_URL: string = (import.meta.env.PUBLIC_API_URL as string | undefined) ?? 'http://localhost:8000';

export interface SessionInfo {
  id: string;
  created_at: string;
  consent_accepted_at: string | null;
}

export async function createSession(consentVersion: string, language: Language): Promise<SessionInfo> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_version: consentVersion, age_confirmed: true, language }),
  });
  if (!res.ok) throw new Error('session-create-failed');
  return res.json();
}

// null when the server does not know the session (404).
export async function getSession(id: string): Promise<SessionInfo | null> {
  const res = await fetch(`${API_URL}/api/sessions/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('session-get-failed');
  return res.json();
}

// The server's reason text, or '' when the body is not the usual JSON.
async function detail(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.detail === 'string' ? data.detail : '';
  } catch {
    return '';
  }
}

// The error codes the pages act on. 'session-finished' means the survey is
// done or the data deleted: that session takes no new conversation, and the
// browser starts again through consent.
export async function createConversation(sessionId: string, language: Language): Promise<string> {
  const res = await fetch(`${API_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, starter_topic: null, language }),
  });
  if (res.status === 404) throw new Error('session-missing');
  if (res.status === 403) throw new Error((await detail(res)) === 'Consent required' ? 'consent-required' : 'session-finished');
  if (res.status === 429) throw new Error('too-many-conversations');
  if (!res.ok) throw new Error('conversation-create-failed');
  const data = await res.json();
  return data.id as string;
}

// null when the server does not know the conversation (404).
export async function getConversation(conversationId: string): Promise<{ id: string; is_complete: boolean } | null> {
  const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('conversation-get-failed');
  return res.json();
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

// The earlier turns, oldest first, so a reload shows the conversation again.
export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages`);
  if (!res.ok) throw new Error('messages-get-failed');
  return res.json();
}

export type InputMode = 'typed' | 'spoken';

export type AssistantMessage = ChatMessage;

// Error codes: 'conversation-closed' (ended, or unknown to the server),
// 'too-many-messages' (the per-conversation limit), 'message-failed' (anything
// else, including a timeout: the participant may simply try again).
export async function sendMessage(conversationId: string, content: string, inputMode: InputMode): Promise<AssistantMessage> {
  const res = await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, input_mode: inputMode }),
  });
  if (res.status === 400 || res.status === 403 || res.status === 404) throw new Error('conversation-closed');
  if (res.status === 429) throw new Error('too-many-messages');
  if (!res.ok) throw new Error('message-failed');
  return res.json();
}

export async function endConversation(conversationId: string): Promise<void> {
  await fetch(`${API_URL}/api/conversations/${encodeURIComponent(conversationId)}/end`, { method: 'PUT' }).catch(() => undefined);
}

// The recording goes as the raw body with its own mime type; nothing is kept on the server.
// A busy speech server answers 503 at once: one more try after a short pause.
// No request waits more than 15 s, so a lost one never holds up the page.
async function speechFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    if (res.status !== 503 || attempt > 0) return res;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export async function transcribe(conversationId: string, blob: Blob, language: Language): Promise<string> {
  const url = `${API_URL}/api/speech/transcribe?conversation_id=${encodeURIComponent(conversationId)}&language=${language}`;
  const res = await speechFetch(url, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob });
  if (!res.ok) throw new Error('transcribe-failed');
  const data = await res.json();
  return (data.text as string) ?? '';
}

export interface SpeechClip {
  audio_base64: string;
  sample_rate: number;
  words: string[];
  wtimes: number[];
  wdurations: number[];
}

// index: the sentence's place in its reply; the server voices the first
// sentence of a reply before the prefetched ones.
export async function synthesize(conversationId: string, text: string, language: Language, index = 0): Promise<SpeechClip> {
  const res = await speechFetch(`${API_URL}/api/speech/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, text, language, index }),
  });
  if (!res.ok) throw new Error('synthesize-failed');
  return res.json();
}

// Survey: every answer optional; the keys are the ones the
// researchers' export already knows.
export interface SurveyResponses {
  chatbot_usage: string;
  chatbot_which: string;
  political_chatbot: string;
  chatbot_perception: number | null;
  conversation_reflection: string;
  response_speed: number | null;
  topic_variety: number | null;
  detected_bias: number | null;
  detected_terminology: number | null;
  detected_persuasion: number | null;
  notice_anything: string;
}

export async function submitSurvey(sessionId: string, responses: SurveyResponses): Promise<void> {
  const res = await fetch(`${API_URL}/api/survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, responses }),
  });
  // 409: the row is already stored (a second tab, or a retry after a lost
  // response), so the survey is done.
  if (res.status === 409) return;
  if (!res.ok) throw new Error('survey-failed');
}

// Debrief: the one participant call that reveals the condition,
// and only after the survey row exists.
export interface DebriefConversation {
  id: string;
  party_display_name: string;
  is_populist: boolean;
  // 'populist', 'antipopulist', or null for the former standard condition
  framing?: 'populist' | 'antipopulist' | null;
  started_at: string;
}

export interface Debrief {
  session_code: string;
  data_deleted: boolean;
  conversations: DebriefConversation[];
}

// null before the survey (403) or for an unknown session (404).
export async function getDebrief(sessionId: string): Promise<Debrief | null> {
  const res = await fetch(`${API_URL}/api/sessions/${encodeURIComponent(sessionId)}/debrief`);
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error('debrief-failed');
  return res.json();
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/sessions/${encodeURIComponent(sessionId)}/data`, { method: 'DELETE' });
  if (!res.ok) throw new Error('delete-failed');
}
