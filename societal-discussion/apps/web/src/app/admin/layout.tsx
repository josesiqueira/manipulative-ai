'use client';

/**
 * AdminLayout — root layout for all /admin/* routes.
 *
 * Why 'use client'?
 * AdminAuth uses sessionStorage and useState, which are client-only APIs.
 * Next.js App Router requires a layout to be a client component if it
 * imports any client component that touches browser APIs at the module level.
 *
 * Architecture:
 * - AdminAuth renders the password prompt; only once authenticated does it
 *   render its children.
 * - AdminNav is the fixed sidebar; it lives outside <main> so it does not
 *   scroll with page content.
 * - ml-56 on <main> offsets the 224px (w-56) fixed sidebar so content is
 *   never hidden underneath it.
 * - Child pages read the session password from sessionStorage directly rather
 *   than receiving it via React context. This avoids a Context provider wrapping
 *   every route while keeping the auth contract simple: if sessionStorage has
 *   the key, the user is authenticated; all API calls read from there.
 */

import type { ReactNode } from 'react';
import AdminAuth from './components/AdminAuth';
import AdminNav from './components/AdminNav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuth>
      {() => (
        <div className="flex min-h-screen bg-slate-50">
          <AdminNav />
          <main className="flex-1 ml-56 p-8 min-w-0">
            {children}
          </main>
        </div>
      )}
    </AdminAuth>
  );
}
