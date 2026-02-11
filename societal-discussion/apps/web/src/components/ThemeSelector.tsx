'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { themes } from '@/lib/themes';

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1">
      {Object.values(themes).map((t) => (
        <button
          key={t.id}
          onClick={() => setTheme(t.id)}
          title={t.name}
          className={`w-6 h-6 rounded-full border-2 transition-all ${
            theme.id === t.id
              ? 'border-white scale-110 shadow-md'
              : 'border-transparent hover:scale-105'
          }`}
          style={{
            backgroundColor: t.colors.userMessageBg,
          }}
          aria-label={`Switch to ${t.name} theme`}
        />
      ))}
    </div>
  );
}
