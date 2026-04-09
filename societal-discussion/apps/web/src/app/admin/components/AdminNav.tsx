'use client';

/**
 * AdminNav — fixed left sidebar navigation for the admin section.
 *
 * Design decisions:
 * - Width is w-56 (224px) via Tailwind; design tokens specify 240px but w-56
 *   is the nearest Tailwind step and is visually equivalent for a fixed sidebar.
 * - Active state uses bg-slate-200 (not blue) — the design system explicitly
 *   keeps the sidebar neutral. Blue is reserved for political block encoding.
 * - Exact match for /admin; startsWith for sub-routes, so /admin/conversations
 *   is active when on any child of that path.
 * - Icons are inline SVG (16×16) using standard Heroicons outlines; no external
 *   icon library dependency required since Lucide is not in package.json.
 * - Sign Out clears sessionStorage and reloads so the password prompt appears.
 * - z-10 keeps the sidebar above page content during scroll without competing
 *   with dropdowns (z-20) or modals (z-30).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Inline SVG icons (Heroicons outline, 16×16 viewport)
// ---------------------------------------------------------------------------

function IconGrid(): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconChat(): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconDownload(): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSettings(): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconSignOut(): ReactNode {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Navigation item definitions
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  Icon: () => ReactNode;
  /** If true, only exact pathname matches trigger the active state. */
  exactMatch: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', Icon: IconGrid, exactMatch: true },
  {
    href: '/admin/conversations',
    label: 'Conversations',
    Icon: IconChat,
    exactMatch: false,
  },
  {
    href: '/admin/data',
    label: 'Data & Export',
    Icon: IconDownload,
    exactMatch: false,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    Icon: IconSettings,
    exactMatch: false,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminNav() {
  const pathname = usePathname();

  /**
   * Determine whether a nav item should be styled as active.
   * The dashboard (/admin) uses exact matching to avoid lighting up for every
   * admin sub-route; all other items use prefix matching.
   */
  function isActive(item: NavItem): boolean {
    if (item.exactMatch) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const handleSignOut = () => {
    sessionStorage.removeItem('adminPassword');
    // Full page reload returns the user to the AdminAuth prompt
    window.location.reload();
  };

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-56 bg-slate-100 border-r border-slate-200
                 flex flex-col z-10"
      aria-label="Admin navigation"
    >
      {/* Branding block */}
      <div className="px-4 py-5 border-b border-slate-200">
        <p className="text-xs font-semibold text-slate-900 uppercase tracking-widest">
          Synthetica
        </p>
        <p className="mt-0.5 text-xs text-slate-500">Research Dashboard</p>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium',
                'transition-colors',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-blue-600 focus-visible:ring-offset-1',
                active
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              {/* Icon inherits text color from the parent anchor */}
              <span
                className={active ? 'text-slate-900' : 'text-slate-400'}
              >
                <item.Icon />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: sign-out action */}
      <div className="px-2 py-3 border-t border-slate-200">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md
                     text-sm font-medium text-slate-500
                     hover:bg-slate-200 hover:text-slate-900
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-blue-600 focus-visible:ring-offset-1
                     active:bg-slate-300 transition-colors"
        >
          <span className="text-slate-400">
            <IconSignOut />
          </span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
