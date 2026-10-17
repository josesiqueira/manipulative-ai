// The browser-side state of a visit: three localStorage keys. Everything here
// runs only in client scripts (no window on the server).
import type { Language } from './strings';

const KEYS = { session: 'sessionId', conversation: 'conversationId', language: 'language' } as const;

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

export function clearSession(): void {
  setSessionId(null);
  setConversationId(null);
}
