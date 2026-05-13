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

export default function LandingPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [lang, setLang] = useState<Language>('fi');

  // Load language preference on mount (client-only)
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
          // fall through to create new
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

  const startChat = useCallback(
    async (starterTopic?: string) => {
      if (!sessionId) return;
      try {
        const response = await fetch(`${API_URL}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            starter_topic: starterTopic || null,
            language: lang,
          }),
        });
        if (response.status === 404) {
          localStorage.removeItem('sessionId');
          window.location.reload();
          return;
        }
        if (!response.ok) throw new Error('Failed to create conversation');
        const data = await response.json();
        localStorage.setItem('conversationId', data.id);
        if (starterTopic) {
          localStorage.setItem('starterTopic', starterTopic);
        } else {
          localStorage.removeItem('starterTopic');
        }
        router.push('/chat');
      } catch (error) {
        console.error('Error starting chat:', error);
      }
    },
    [sessionId, router, lang],
  );

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
    </div>
  );
}
