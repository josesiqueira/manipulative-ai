'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TRANSLATIONS, getStoredLanguage } from '@/lib/translations';

export default function SurveyEntryPage() {
  const router = useRouter();
  const [t, setT] = useState(TRANSLATIONS.fi);

  useEffect(() => {
    setT(TRANSLATIONS[getStoredLanguage()]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{t.surveyEntry.thanks}</h1>
          <p className="text-slate-600 mb-8">{t.surveyEntry.description}</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/survey')}
              className="w-full py-3 px-6 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
            >
              {t.surveyEntry.startSurvey}
            </button>
            <button
              onClick={() => router.push('/chat')}
              className="w-full py-3 px-6 border border-slate-300 text-slate-600 rounded-xl font-medium hover:bg-slate-100 transition-colors"
            >
              {t.surveyEntry.backToChat}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
