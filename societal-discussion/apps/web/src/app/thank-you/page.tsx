'use client';

import { useState, useEffect } from 'react';
import { TRANSLATIONS, getStoredLanguage } from '@/lib/translations';

export default function ThankYouPage() {
  const [t, setT] = useState(TRANSLATIONS.fi);

  useEffect(() => {
    setT(TRANSLATIONS[getStoredLanguage()]);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{t.thankYou.title}</h1>
          <p className="text-slate-600">{t.thankYou.description}</p>
        </div>
      </div>
    </div>
  );
}
