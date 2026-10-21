// The browser-side state of a visit: four localStorage keys. Everything here
// runs only in client scripts (no window on the server).
import type { Language } from './strings';

const KEYS = { session: 'sessionId', conversation: 'conversationId', language: 'language', survey: 'surveySubmitted' } as const;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: the flow still works for one page.
  }
}

export const getSessionId = () => read(KEYS.session);
export const setSessionId = (id: string | null) => write(KEYS.session, id);
export const getConversationId = () => read(KEYS.conversation);
export const setConversationId = (id: string | null) => write(KEYS.conversation, id);

export function getStoredLanguage(): Language {
  return read(KEYS.language) === 'en' ? 'en' : 'fi';
}
export const setStoredLanguage = (lang: Language) => write(KEYS.language, lang);

// Set once the survey is stored, so a second visit to the survey page goes
// straight to the thank-you page instead of storing a second row.
export const isSurveySubmitted = () => read(KEYS.survey) === '1';
export const setSurveySubmitted = () => write(KEYS.survey, '1');

export function clearSession(): void {
  setSessionId(null);
  setConversationId(null);
  write(KEYS.survey, null);
}

// The code the participant can quote to ask for their data: the first eight
// hex characters of the session id as XXXX-XXXX, as the API's session_code.py.
export function sessionCode(sessionId: string): string {
  const raw = sessionId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
