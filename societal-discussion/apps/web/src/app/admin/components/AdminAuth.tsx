'use client';

/**
 * AdminAuth — password gate for the entire admin section.
 *
 * Why sessionStorage rather than a cookie or URL parameter?
 * - sessionStorage is cleared when the browser tab closes, giving a natural
 *   session boundary without needing server-side token expiry.
 * - It cannot be accessed by other origins (same-origin policy), which is
 *   sufficient protection for an internal research tool on a trusted network.
 * - The password is forwarded to the API via the X-Admin-Password header on
 *   every request; it is never embedded in a URL or sent as a cookie.
 *
 * Render-prop pattern: children receives the authenticated password string so
 * that child components can pass it directly to adminFetch without reading
 * sessionStorage again (avoids an additional read on every render cycle and
 * keeps auth state in one place).
 */

import { useState, useEffect, type ReactNode } from 'react';

export interface AdminAuthProps {
  /**
   * Render prop — called only when authenticated.
   * Receives the verified password so child pages can forward it to the API.
   */
  children: (password: string) => ReactNode;
}

export default function AdminAuth({ children }: AdminAuthProps) {
  // null = not yet authenticated; string = authenticated with this password
  const [password, setPassword] = useState<string | null>(null);
  const [input, setInput] = useState('');

  /**
   * On mount, check whether the user already authenticated in this session.
   * If so, skip the prompt entirely and hydrate the password from storage.
   * This runs client-side only (sessionStorage is not available during SSR).
   */
  useEffect(() => {
    const stored = sessionStorage.getItem('adminPassword');
    if (stored) {
      setPassword(stored);
    }
  }, []);

  if (!password) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!input.trim()) return;
      sessionStorage.setItem('adminPassword', input);
      setPassword(input);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-lg p-8 w-full max-w-sm shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 mb-1">
            Research Dashboard
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            Enter admin password to continue
          </p>
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-600
                         focus:border-blue-600"
            />
            <button
              type="submit"
              className="mt-4 w-full bg-slate-900 text-white py-2 rounded-md
                         text-sm font-medium hover:bg-slate-800
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-blue-600 focus-visible:ring-offset-2
                         active:bg-slate-950 transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children(password)}</>;
}
