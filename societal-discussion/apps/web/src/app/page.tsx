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
  const [isStarting, setIsStarting] = useState(false);
  const [lang, setLang] = useState<Language>('fi');

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

  const startConversation = useCallback(async () => {
    if (!sessionId || isStarting) return;
    setIsStarting(true);
    try {
      const response = await fetch(`${API_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          starter_topic: null,
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
      localStorage.removeItem('starterTopic');
      router.push('/chat');
    } catch (err) {
      console.error('Error starting chat:', err);
    } finally {
      setIsStarting(false);
    }
  }, [sessionId, isStarting, lang, router]);

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

        {/* Single start-conversation button */}
        <button
          onClick={startConversation}
          disabled={!sessionId || isCreatingSession || isStarting}
          className="w-full mb-8 py-4 px-6 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.landing.freeConvButton}
        </button>

        {/* Topic suggestions — read-only text */}
        <h2 className="text-lg font-semibold text-slate-700 mb-4">
          {t.landing.orPickTopic}
        </h2>

        <div className="space-y-6">
          {t.categories.map((category) => (
            <div key={category.title}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {category.title}
              </h3>
              <ul className="space-y-1.5">
                {category.topics.map((topic) => (
                  <li
                    key={topic}
                    className="text-slate-700 text-sm leading-relaxed pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-slate-400"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
