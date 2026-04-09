'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function LanguageSelector() {
  const t = useTranslations('language');
  const router = useRouter();
  const pathname = usePathname();

  const currentLocale = pathname.split('/')[1] || 'en';

  const switchLocale = (newLocale: string) => {
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-gray-600">{t('select')}</span>
      <div className="flex gap-2">
        <button
          onClick={() => switchLocale('en')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            currentLocale === 'en'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {t('en')}
        </button>
        <button
          onClick={() => switchLocale('fi')}
          className={`px-4 py-2 rounded-lg border transition-colors ${
            currentLocale === 'fi'
              ? 'bg-primary-600 text-white border-primary-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {t('fi')}
        </button>
      </div>
    </div>
  );
}
