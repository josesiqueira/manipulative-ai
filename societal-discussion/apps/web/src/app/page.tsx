'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TRANSLATIONS,
  Language,
  LANGUAGES,
  getStoredLanguage,
  setStoredLanguage,
} from '@/lib/translations';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// A signal value distinguishing "free conversation" from "no pending start".
const FREE_CONVERSATION = '__free__';

export default function LandingPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [lang, setLang] = useState<Language>('fi');

  // Access-code gate state. `pendingTopic` is set when the user clicks any
  // start-conversation button without yet having verified an access code.
  // Once verified for the session, the code is stored in sessionStorage and
  // future starts skip the modal.
  const [pendingTopic, setPendingTopic] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSubmitting, setCodeSubmitting] = useState(false);

  useEffect(() => {
    setLang(getStoredLanguage());
  }, []);

  useEffect(() => {
    async function initSession() {
      setIsCreatingSession(true);
      const existing = localStorage.getItem('sessionId');

      if (existing) {
        try {
          const res = await fetch(`${API_URL}/api/sessions/${existing}`);
          if (res.ok) {
            setSessionId(existing);
            setIsCreatingSession(false);
            return;
          }
        } catch {
          // fall through
        }
        localStorage.removeItem('sessionId');
      }

      try {
        const res = await fetch(`${API_URL}/api/sessions`, { method: 'POST' });
        const data = await res.json();
        localStorage.setItem('sessionId', data.id);
        setSessionId(data.id);
      } catch (err) {
        console.error('Failed to create session:', err);
      } finally {
        setIsCreatingSession(false);
      }
    }

    initSession();
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    setStoredLanguage(newLang);
  };

  // Actually create a conversation against the API, using a known-good code.
  const createConversation = useCallback(
    async (starterTopic: string | null, accessCode: string): Promise<'ok' | 'unauthorized' | 'error'> => {
      if (!sessionId) return 'error';
      try {
        const response = await fetch(`${API_URL}/api/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Participant-Password': accessCode,
          },
          body: JSON.stringify({
            session_id: sessionId,
            starter_topic: starterTopic,
            language: lang,
          }),
        });
        if (response.status === 401) return 'unauthorized';
        if (response.status === 404) {
          localStorage.removeItem('sessionId');
          window.location.reload();
          return 'error';
        }
        if (!response.ok) return 'error';
        const data = await response.json();
        localStorage.setItem('conversationId', data.id);
        if (starterTopic) localStorage.setItem('starterTopic', starterTopic);
        else localStorage.removeItem('starterTopic');
        router.push('/chat');
        return 'ok';
      } catch (err) {
        console.error('Error starting chat:', err);
        return 'error';
      }
    },
    [sessionId, router, lang],
  );

  // Entry point for every "start conversation" button.  Either short-circuits
  // (we already have a verified code in sessionStorage) or opens the modal.
  const startChat = useCallback(
    async (starterTopic?: string) => {
      if (!sessionId) return;
      const topicKey = starterTopic ?? FREE_CONVERSATION;

      const cached = sessionStorage.getItem('participantPassword');
      if (cached) {
        const result = await createConversation(starterTopic ?? null, cached);
        if (result === 'unauthorized') {
          // Cached code was rejected (server-side password changed?). Fall
          // through to the modal flow.
          sessionStorage.removeItem('participantPassword');
        } else {
          return;
        }
      }

      // No verified code yet — open the gate.
      setPendingTopic(topicKey);
      setCodeError(null);
      setCodeInput('');
    },
    [sessionId, createConversation],
  );

  const submitCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!codeInput.trim() || codeSubmitting || pendingTopic === null) return;
    setCodeSubmitting(true);
    setCodeError(null);
    const starterTopic = pendingTopic === FREE_CONVERSATION ? null : pendingTopic;
    const result = await createConversation(starterTopic, codeInput);
    if (result === 'ok') {
      sessionStorage.setItem('participantPassword', codeInput);
      // The router push has been triggered — clear local state.
      setPendingTopic(null);
    } else if (result === 'unauthorized') {
      setCodeError(t.accessGate.wrongCode);
    } else {
      setCodeError(t.accessGate.networkError);
    }
    setCodeSubmitting(false);
  };

  const cancelCode = () => {
    setPendingTopic(null);
    setCodeError(null);
    setCodeInput('');
  };

  const t = TRANSLATIONS[lang];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Language toggle */}
        <div className="flex justify-end mb-4 gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => handleLanguageChange(l)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                lang === l
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
              aria-pressed={lang === l}
            >
              {t.langToggle[l]}
            </button>
          ))}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-slate-900 mb-6">
          {t.landing.title}
        </h1>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <p className="text-slate-700 leading-relaxed">{t.landing.instructions}</p>
        </div>

        {/* Guidance */}
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-4 mb-6 space-y-2">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{t.landing.tipLabel}</span> {t.landing.tipText}
          </p>
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{t.landing.goalLabel}</span> {t.landing.goalText}
          </p>
        </div>

        {/* Free conversation button */}
        <button
          onClick={() => startChat()}
          disabled={!sessionId || isCreatingSession}
          className="w-full mb-8 py-4 px-6 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.landing.freeConvButton}
        </button>

        {/* Topic categories */}
        <h2 className="text-lg font-semibold text-slate-700 mb-4">
          {t.landing.orPickTopic}
        </h2>

        <div className="space-y-6">
          {t.categories.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {category.title}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {category.topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => startChat(topic)}
                    disabled={!sessionId || isCreatingSession}
                    className="text-left p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Access-code modal */}
      {pendingTopic !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={submitCode}
            className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-2">
              {t.accessGate.title}
            </h2>
            <p className="text-sm text-slate-500 mb-4">{t.accessGate.hint}</p>

            {codeError && (
              <div
                role="alert"
                className="mb-3 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm"
              >
                {codeError}
              </div>
            )}

            <input
              type="password"
              value={codeInput}
              onChange={(e) => {
                setCodeInput(e.target.value);
                if (codeError) setCodeError(null);
              }}
              placeholder={t.accessGate.placeholder}
              autoFocus
              disabled={codeSubmitting}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-60"
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={cancelCode}
                disabled={codeSubmitting}
                className="flex-1 py-2 rounded-md border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-100 disabled:opacity-60"
              >
                {t.accessGate.cancelBtn}
              </button>
              <button
                type="submit"
                disabled={codeSubmitting || !codeInput.trim()}
                className="flex-1 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {codeSubmitting ? '…' : t.accessGate.continueBtn}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
