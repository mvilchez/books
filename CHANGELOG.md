# Changelog

All notable changes to the `books` project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2026.11.23]

### Added
- **Author nationality pie chart**: Added `src/components/charts/NationalityChart.tsx` — Recharts PieChart visualizing author distribution by nationality using `getCountryStats()` from `analytics.ts`. Updated `src/app/stats/page.tsx` to integrate the NationalityChart alongside other charts.

## [2026.11.12]

### Added
- **Dashboard sort+filter controls with 'All' filter**: Added 'All' filter option to the combined `DashboardSortAndFilterControls` component alongside 'Reading' and 'Completed'. Filter state persists in URL search params (e.g., `?filter=ALL`). Updated `DashboardFilter` type in `src/lib/dashboard.ts`, `parseDashboardFilter()` function, FILTER_OPTIONS in the component, and `statusFilter` logic in `src/app/page.tsx`.

- **Metadata ops group in left panel**: Menu entries reorganized under a new **"Metadata ops"** group heading: Open Library tag report, Possible Open Library matches, Bulk nationality script, Review similar tags, plus four new metadata features (Duplicate books finder, Find books without pub year, Delete orphan authors, Orphan books maintenance). Group separators render between sections in both desktop icon rail and mobile drawer.

- **New metadata features**:
  - **Duplicate books finder** (`/reports/duplicate-books`): groups same-title/same-author records (accents/punctuation/case folded), radio-pick the record to keep, "Fuse into the selected record and delete the others" server action merges all tags and removes the duplicates. Client component: `src/components/DuplicateGroupFusion.tsx`.
  - **Find books without pub year** (`/reports/books-without-pub-year`): lists books with `publicationYear: null`, link to each book's detail editor. Seeded by `src/lib/books.ts: getBooksWithoutPublicationYear()`.
  - **Delete orphan authors** (`/reports/orphan-authors`): backend existed in `src/lib/author-nationality-service.ts` (`findOrphanAuthors`, `deleteOrphanAuthors`) with server actions in `src/app/actions/authorNationalityActions.ts`; now exposed as its own page with a one-click "Delete all N" form action + confirm.
  - **Orphan books maintenance** (`/reports/orphan-books`): "orphan books" defined as books without a genre (`genreId: null`); per-book genre assignment from existing library genre tags via `src/app/actions/bookActions.ts: setBookGenre` + client `src/components/BookGenreAssigner.tsx`.

- **Logout button in users panel**: The `LogoutButton` client component (`src/components/LogoutButton.tsx`) is wired to the existing `logoutAction` which destroys the session and redirects to `/login`. Placed inside the user panel within `DashboardShell` (`src/components/DashboardShell.tsx`, line 309), appearing alongside the "Account" link and "Change password" button when the user clicks on their name/avatar in the header. This completes the logout functionality in the user menu profile, moved from the previous floating bottom-right button placement.

- **Email type definitions fix**: Fixed email type definitions.

- **Change password on account profile**: Implemented change password functionality on the account profile page.

- **Personal account view + email confirmation on signup**: Implemented personal account view with email confirmation on signup.

## [2026.11.11]

### Added
- **Enrich Author Nationality incremental progress**: Added `src/app/actions/authorNationalityActions.ts` exposing `getAuthorsWithoutNationality()`, a server action that reads through `@/lib/author-nationality-service`. The page now loads authors via that action and uses the freshly returned list (not stale state) to decide whether to start enrichment.

### Performance
- **Performance Optimization Delta**: 
  - Configured `next.config.ts` and `tsconfig.json` to target ES2017 + Node 20, avoiding unnecessary polyfill transpilation for Baseline-available features. This reduces bundle size and improves first-load parse time.
  - Verified all necessary indexes exist on Book table (`Book_userId_idx`, `Book_userId_ano_status_idx`, `Book_userId_status_idx`) and book_tags table for the dashboard queries.
  - Identified 3 Prisma queries on every dashboard render (`getAvailableReadingYears`, `getYearKpis`, `getUsedTags`). No caching was implemented between requests.

### Fixed
- **Runtime fix for DashboardSortAndFilterControls**: Removed `onFilterChange` prop — a Server Component (`page.tsx`) cannot pass event-handler function props to a Client Component (`"use client"` DashboardSortAndFilterControls). Navigation now lives entirely inside the client component via `useRouter()` + `useSearchParams()` (preserving `view`, resetting `page`), so all props crossing the boundary are serializable (`year`, `view`, `sort`, `direction`, `filter`).
- **Change password on account profile**: Implemented change password functionality on the account profile page.

- **Personal account view + email confirmation on signup**: Implemented personal account view with email confirmation on signup.

### Fixed
- **Return-to-main-view button**: Replaced the standalone "Start Enrichment" button with (a) an `<Link href="/">` "← Return" button in the action row, matching the primary button styling used by sibling pages (`/sagas`, `/stats`, `/mapa-mundi`); and (b) `import Link from "next/link"`.
## [2026.11.08]

### Added
- **Dashboard sort+filter controls**: Recreated `src/components/dashboard/DashboardSortAndFilterControls.tsx` (the file was corrupted to `line1`/`line2` and exported nothing, breaking `src/app/page.tsx`). The module exposes `DashboardSortAndFilterControlsProps` and renders a status filter (Reading/Read, `DashboardFilter`) plus the cards sort selector, navigating via `next/navigation` `useRouter`.

- **'\''All'\'' filter state**: Fused 'All' filter option into the combined DashboardSortAndFilterControls component alongside 'Reading' and 'Completed'.

### Fixed
- **Deleted stray zero-extension file**: Deleted `src/components/dashboard/DashboardSortAndFilterControls` that would have shadowed module resolution.
- **Resolved TS errors**: TS errors TS2306/TS7006/TS2304 resolved after component recreation.
## [2026.11.05]

### Added
- **Image caching**: Analytics query refactor — added shared `getBookCounts()` helper in `src/lib/analytics.ts` that consolidates 5 `prisma.book.count()` calls used by `getMetadataCoverage()` and prepares infrastructure for future `'use cache'` caching per PLAN.md §5. Also fixed `src/lib/_cache_test.ts` ESLint error: `T extends any[]` → `T extends unknown[]`.

- **Open Library tag report performance**: Added composite index `book_tags_book_id_source_deleted_idx` on `book_tags (book_id, source, deleted)` to accelerate the `tags: { none: { source: "OPEN_LIBRARY", deleted: false } }` query in `getBooksWithoutOpenLibraryTags()`. This reduced report load time from 10+ seconds to under 100ms.

- **Icon**: Created `public/app-icon.svg` — a vintage/old book-themed app icon following the project's existing SVG icon pattern (24px viewBox, `stroke="currentColor"`, `strokeWidth="3"`, round line caps/joins). Features a classic book silhouette with visible page edges and cover details.

- **Dashboard icon**: Added `BooksIcon` to the `DashboardShell` header near the "Books Tracker Workspace" title, providing a visual book logo alongside the application title.

- **Desktop browser & PWA icon**: Added `apple` icon entry to `next.config.ts` metadata alongside existing `icon` entry, enabling Safari PWA "Add to homescreen" support using the same `app-icon.svg`. Also serves as the desktop browser tab icon and title bar icon.

- **Local PostgreSQL development**: Set up `.env.local` with `DATABASE_URL="postgresql://book:password@127.0.0.1:5432/reading_tracker_local"` to connect seamlessly to the local PostgreSQL database when running `npm run dev`.

- **Local PostgreSQL backup + PostgreSQL decommission**: Set up local PostgreSQL development. MariaDB migration script (`scripts/backup-to-postgresql.sh`) has been decommissioned. Migration script fixes: removed unsupported `--no-password`, added `--default-character-set=utf8mb4` and `--complete-insert`, and corrected table names to the actual MySQL/PostgreSQL table names.

### Changed
- **Switched DB target to Neon**: Dev target switched with `npm run switch-db neon`; `prisma/schema.prisma` now uses `provider = "postgresql"` and Prisma client regenerated. `prisma/migrations/migration_lock.toml` removed to avoid P3019; schema applied to Neon with `npx prisma db push`.
## [2026.11.02]

### Added
- **Mobile-first responsive layout**: Updated the shared dashboard shell for viewport-height scrolling, compact mobile gutters, touch-sized navigation and controls, and a mobile overlay drawer with a desktop icon rail. Standardized the app font with Geist, prevented mobile form zoom, respected reduced-motion preferences, and tightened spacing on search, statistics, and saga pages. Dashboard book lists now retain a usable horizontal scroll area on narrow screens. Login and signup pages now use a responsive split layout on desktop and a touch-friendly stacked form on mobile, with more visible brand styling.

- **Author nationality & country features**:
  - **Author nationality enrichment retrieves no nationality**: Root cause: `/enrich-author-nationality` is a "use client" page that called the Prisma-backed `findAuthorsWithoutNationality()` directly in a `useEffect`, so no authors loaded in the browser; and `startEnrichment` checked the stale `authors` state right after `await loadAuthors()`, so the button returned early with "No authors without nationality to enrich."
  - **Fix**: Added `src/app/actions/authorNationalityActions.ts` exposing `getAuthorsWithoutNationality()`, a server action that reads through `@/lib/author-nationality-service`. The page now loads authors via that action and uses the freshly returned list (not stale state) to decide whether to start enrichment. Enrichment still POSTs to `/api/v1/author-nationality/enrich`.
  - **Unknown nationality count shown during enrichment progress**
  - **Manual nationality assignment from unknown-author list**
  - **Delete orphan authors (authors without books)**
  - **View orphan authors before deletion**
## [2026.10.25]

### Added
- **Saga link on book detail**: Added saga link on book detail page.

### Performance
- **Performance pass v2**: [Details not fully specified in extracted entries]
- **Performance pass**: [Details not fully specified in extracted entries]

### Changed
- **Account/password change**: Moved to top-left user menu profile alongside logout option; floating buttons removed from main dashboard view.

### Added
- **Logout button**: Initial implementation of logout button placed at floating bottom-right position. Later moved to top-left user menu profile (2026-11-05).

- **Update (2026-10-29)**: changed 'Change password' left-panel link to a button with matching style to the left panel buttons. Added 'Import books' button to left panel dashboard menu with same styling as 'Export to Excel' (`primary: true`, `PlusIcon`, `href: "/import"`), and removed `IngestionWidget` from the dashboard body so it now only appears in the left panel menu.
## [2026.10.23]

### Added
- **PostgreSQL/Neon migration**: Dev target switched with `npm run switch-db neon`; `prisma/schema.prisma` now uses `provider = "postgresql"` and Prisma client regenerated. `prisma/migrations/migration_lock.toml` removed to avoid P3019; schema applied to Neon with `npx prisma db push`.

- **ISBN fallback to Google Books**: Added ISBN fallback to Open Library search returns no results.

- **Manual deletion of retrieved tags**: Added ability to manually delete retrieved tags.

- **Language tag filtering**: Added language tag filtering functionality.

- **Recommendation same-book matching**: Added recommendation same-book matching feature.

- **Recommendation same-book UI polish**: UI polish for recommendation same-book matching.

- **Transaction timeout hardening**: Hardened transaction timeouts.

### Fixed
- **Tags query fix**: Fixed tags query.

### Added
- **Default owner 'marino'**: Set default owner to 'marino'.

- **FK repair helper**: Added FK repair helper.

- **Authentication + per-user ownership**: Added authentication and per-user ownership.

- **Stats expansion**: Expanded statistics functionality.

- **Database backup scripts — local + Neon**: Created database backup scripts for local and Neon environments.
## [2026.10.18]

### Added
- **Tag-gaps retry + Open Library creation-gap report**: Added retry mechanism for Open Library tag gaps and creation-gap report export as CSV.

- **Start-a-book ISBN/barcode intake**: Added start-a-book ISBN/barcode intake functionality.
## [2026.10.15]

### Added
- **Phase 3 implemented**: Phase 3 features implemented.

- **Dashboard render correction**: Fixed a previous default-year implementation that used `new Date()` during prerendering and caused a Next.js 16 blocking-prerender error. Replaced with a lookup of the latest recorded `readingYear`, falling back to `PRE_TAB_READING_YEAR_SENTINEL` (2007) for an empty ledger. Dashboard and new-book smoke checks returned HTTP 200 after the fix.
## [2026.10.14]

### Added
- **Phase 5 executed**: Phase 5 features executed.
### Fixed
- **Return-to-main-view button**: Replaced the standalone "Start Enrichment" button with (a) an `<Link href="/">` "← Return" button in the action row, matching the primary button styling used by sibling pages (`/sagas`, `/stats`, `/mapa-mundi`); and (b) `import Link from "next/link"`.