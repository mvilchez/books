"use client";

import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BooksIcon,
  ChartIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CopyTagsIcon,
  PlusIcon,
  SearchIcon,
  TagIcon,
  GlobeIcon,
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
  { href: "/import", label: "Import books", Icon: PlusIcon, primary: true },
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
  {
    href: "/enrich-author-nationality",
    label: "Bulk nationality script",
    Icon: GlobeIcon,
    primary: true,
  },
  { href: "/tags/manage", label: "Review similar tags", Icon: CopyTagsIcon },
  {
    href: "/api/v1/books/export",
    label: "Export to Excel",
    Icon: TagIcon,
    primary: true,
  },
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
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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

  function closeMenu() {
    setExplicitPreference(false);
    try {
      window.localStorage.setItem(MENU_STORAGE_KEY, "false");
    } catch {
      /* Storage may be unavailable; the in-memory toggle still works. */
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-900 text-slate-100 md:h-dvh md:min-h-0 md:flex-row md:overflow-hidden">
      {menuOpen && isMobileViewport ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={closeMenu}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm md:hidden"
        />
      ) : null}
      <aside
        id="dashboard-menu"
        className={`fixed inset-y-0 left-0 z-40 w-[min(20rem,80vw)] overflow-y-auto border-r border-slate-800 bg-slate-950 transition-[transform,width] duration-300 ease-in-out md:sticky md:top-0 md:z-20 md:h-dvh md:shrink-0 md:overflow-hidden md:border-r ${
          menuOpen
            ? "translate-x-0 md:w-64"
            : "-translate-x-full md:translate-x-0 md:w-16"
        }`}
      >
        <div
          className="flex min-h-full w-full flex-col gap-3 p-4 md:h-full md:p-2"
          inert={!menuOpen && isMobileViewport}
        >
          <p className={`px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 ${!menuOpen && !isMobileViewport ? "sr-only" : ""}`}>
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
                  title={!menuOpen && !isMobileViewport ? label : undefined}
                  onClick={isMobileViewport ? closeMenu : undefined}
                  className={
                    primary
                      ? `inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-500 px-3 py-2 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-400 ${!menuOpen && !isMobileViewport ? "md:rounded-xl md:px-0" : "px-4"}`
                      : `inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-3 py-2 text-center text-sm font-semibold transition ${
                          active
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-slate-700 text-slate-300 hover:border-emerald-500/50 hover:text-white"
                        } ${!menuOpen && !isMobileViewport ? "md:rounded-xl md:px-0" : "px-4"}`
                  }
                >
                  <span className="shrink-0"><Icon /></span>
                  <span className={!menuOpen && !isMobileViewport ? "md:sr-only" : ""}>
                    {label}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="dashboard-menu"
              aria-label={menuOpen ? "Collapse navigation" : "Expand navigation"}
              title={menuOpen ? "Collapse navigation" : "Expand navigation"}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
            >
              {menuOpen ? <ChevronsLeftIcon /> : <ChevronsRightIcon />}
              <span className={!menuOpen && !isMobileViewport ? "md:sr-only" : ""}>
                {menuOpen ? "Collapse menu" : "Expand menu"}
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:overflow-y-auto">
        <header className="sticky top-0 z-20 flex min-w-0 flex-col gap-3 border-b border-slate-800/80 bg-slate-900/95 px-3 py-3 backdrop-blur-xl sm:px-6 sm:py-4 lg:px-10 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3 md:order-1">
            <button
              type="button"
              onClick={toggleMenu}
              aria-expanded={menuOpen}
              aria-controls="dashboard-menu"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              title={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
            >
              {menuOpen ? <ChevronsLeftIcon /> : <ChevronsRightIcon />}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BooksIcon />
                <h1 className="truncate text-lg font-extrabold tracking-tight text-white sm:text-2xl">
                  <span className="md:hidden">Books</span>
                  <span className="hidden md:inline">{title}</span>
                </h1>
              </div>
              <p className="hidden text-sm text-slate-400 md:block">{subtitle}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 md:order-3">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((open) => !open)}
              aria-expanded={mobileSearchOpen}
              aria-controls="dashboard-search"
              aria-label={mobileSearchOpen ? "Close search" : "Open search"}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-emerald-500/50 hover:text-white md:hidden"
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={() => setUserPanelOpen((open) => !open)}
              aria-expanded={userPanelOpen}
              aria-controls="dashboard-user-panel"
              aria-label={userPanelOpen ? "Close user menu" : `Open user menu for ${userName}`}
              className="ml-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm font-bold text-emerald-300 transition hover:border-emerald-400/60 hover:bg-emerald-500/20 md:ml-0"
            >
              {userName.trim().charAt(0).toUpperCase() || "U"}
            </button>
          </div>
          {userPanelOpen && (
            <div
              id="dashboard-user-panel"
              className="absolute right-3 top-full z-30 w-64 max-w-[calc(100vw-1.5rem)] space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-4 shadow-2xl sm:right-6 lg:right-10"
            >
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
              <button
          type="button"
          onClick={() => setUserPanelOpen(false)}
          aria-label="Close user panel"
          className="inline-flex items-center rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white">
          Change password
        </button>
        <LogoutButton />
            </div>
          )}
          <div
            id="dashboard-search"
            className={`${mobileSearchOpen ? "block" : "hidden"} min-w-0 md:order-2 md:block md:w-full md:max-w-md`}
          >
            {search}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10 xl:p-12">{children}</main>
      </div>
    </div>
  );
}
