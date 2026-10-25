"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import IngestionWidget from "@/components/IngestionWidget";
import {
  BooksIcon,
  ChartIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CopyTagsIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
} from "@/components/icons";

/**
 * App shell for the dashboard (main view). Every header button/link lives in
 * the collapsible left menu, which closes through the labelled button at its
 * bottom; an icon-only toggle in the header reopens the menu when collapsed.
 *
 * The menu preference lives in localStorage and the first visit starts
 * collapsed on small screens. Both are read through `useSyncExternalStore`
 * (not an effect) so the server markup and the hydrated client markup match:
 * `getServerSnapshot` renders the open menu during SSR/hydration, and React
 * re-renders right after hydration when the stored preference differs.
 */

type MenuEntry = {
  href: string;
  label: string;
  Icon: () => ReactNode;
  primary?: boolean;
};

const MENU_ENTRIES: MenuEntry[] = [
  { href: "/books/new", label: "Start a book", primary: true, Icon: PlusIcon },
  { href: "/sagas", label: "Book sagas", Icon: BooksIcon },
  { href: "/stats", label: "Statistics & graphs", Icon: ChartIcon },
  {
    href: "/reports/open-library-tags",
    label: "Open Library tag report",
    Icon: TagIcon,
  },
  {
    href: "/reports/open-library-matches",
    label: "Possible Open Library matches",
    Icon: SearchIcon,
  },
  { href: "/tags/manage", label: "Review similar tags", Icon: CopyTagsIcon },
];

const MENU_STORAGE_KEY = "books.dashboard-menu-open";
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

function subscribeToMenuPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readMenuPreference(): boolean | null {
  try {
    const stored = window.localStorage.getItem(MENU_STORAGE_KEY);
    return stored === null ? null : stored === "true";
  } catch {
    return null; // Storage unavailable (private mode): fall back to defaults.
  }
}

function readServerMenuPreference(): boolean | null {
  return null;
}

function subscribeToViewport(onStoreChange: () => void) {
  const query = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function readIsMobileViewport() {
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function readServerIsMobileViewport() {
  return false;
}

export default function DashboardShell({
  title,
  subtitle,
  search,
  children,
  userName,
}: {
  title: string;
  subtitle: string;
  search: ReactNode;
  children: ReactNode;
  userName: string;
}) {
  const [explicitPreference, setExplicitPreference] = useState<boolean | null>(
    null,
  );
const [userPanelOpen, setUserPanelOpen] = useState<boolean>(false);
  const storedPreference = useSyncExternalStore(
    subscribeToMenuPreference,
    readMenuPreference,
    readServerMenuPreference,
  );
  const isMobileViewport = useSyncExternalStore(
    subscribeToViewport,
    readIsMobileViewport,
    readServerIsMobileViewport,
  );
  const pathname = usePathname();

  // Explicit toggle wins; otherwise the stored preference; the first visit
  // collapses the menu on small screens so it never buries the dashboard.
  const menuOpen = explicitPreference ?? storedPreference ?? !isMobileViewport;

  function toggleMenu() {
    const next = !menuOpen;
    setExplicitPreference(next);
    try {
      window.localStorage.setItem(MENU_STORAGE_KEY, String(next));
    } catch {
      /* Storage may be unavailable; the in-memory toggle still works. */
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-900 text-slate-100 md:flex-row">
      <aside
        id="dashboard-menu"
        className={`shrink-0 overflow-hidden border-b border-slate-800 transition-[width] duration-300 ease-in-out md:border-b-0 md:border-r ${
          menuOpen ? "w-full md:w-64" : "h-0 w-0 border-b-0 md:h-auto"
        }`}
      >
        <div
          className="flex h-full w-full flex-col gap-3 p-4 md:w-64"
          inert={!menuOpen}
        >
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Menu
          </p>
          <nav aria-label="Main" className="flex flex-col gap-2">
            {MENU_ENTRIES.map(({ href, label, primary, Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={
                    primary
                      ? "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                      : `inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-center text-sm font-semibold transition ${
                          active
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-white"
                        }`
                  }
                >
                  <Icon />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 border-t border-slate-800 pt-4">
            <IngestionWidget />
          </div>
          <div className="mt-auto flex flex-col gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="dashboard-menu"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
            >
              <ChevronsLeftIcon />
              <span>Close menu</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex flex-col gap-4 border-b border-slate-800 bg-slate-900 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-12">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="dashboard-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              title={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
            >
              {menuOpen ? <ChevronsLeftIcon /> : <ChevronsRightIcon />}
            </button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {title}
              </h1>
              <p className="text-slate-400 mt-1">{subtitle}</p>
            </div>
          </div>
          {search}
<button
          type="button"
          onClick={() => setUserPanelOpen(!userPanelOpen)}
          aria-expanded={userPanelOpen}
          aria-label={userPanelOpen ? "Collapse user panel" : "Expand user panel"}
          className="inline-flex items-center rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
        >
          {userPanelOpen ? <ChevronsLeftIcon /> : <ChevronsRightIcon />}
        </button>
        </header>
          {userPanelOpen && (
            <div className="absolute right-0 top-0 w-64 bg-slate-800 rounded-lg p-4 space-y-4 shadow-lg z-20">
              <div className="flex items-center justify-between text-slate-300">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-medium">
                    M
                  </div>
                  <span>{userName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setUserPanelOpen(false)}
                  aria-label="Close user panel"
                  className="p-1 rounded-lg hover:bg-slate-700 transition"
                >
                  <ChevronsRightIcon />
                </button>
              </div>
              <a href="/account" className="hover:text-white transition text-sm">Change password</a>
              <LogoutButton />
            </div>
          )}

        <main className="flex-1 p-6 md:p-12">{children}</main>
      </div>
    </div>
  );
}
