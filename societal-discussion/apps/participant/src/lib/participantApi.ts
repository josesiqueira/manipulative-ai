// The three backend calls the consent flow needs. Runs in client scripts.
import type { Language } from './strings';

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

export async function createConversation(sessionId: string, language: Language): Promise<string> {
  const res = await fetch(`${API_URL}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, starter_topic: null, language }),
  });
  if (res.status === 404) throw new Error('session-missing');
  if (res.status === 403) throw new Error('consent-required');
  if (!res.ok) throw new Error('conversation-create-failed');
  const data = await res.json();
  return data.id as string;
}
