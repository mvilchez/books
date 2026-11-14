# Technical Architecture & Context Continuity Blueprint: project "books"

**Duplicate book fusion SQL fix (2026-11-14):** Changed tag transfer to `INSERT ... SELECT ... ON CONFLICT DO NOTHING`, the valid PostgreSQL form for preserving existing keeper tags while moving tags from duplicate books.

**Recommendation refresh behavior (2026-11-14):** Recommendation generation now runs only when the user explicitly selects the generate/refresh button. It appends up to five new recommendations without changing any existing status; reading, discarding, starting a recommendation, completing books, and opening stats do not generate recommendations. No code automatically sets `OLD_DISMISSED`.

**Recommendation list updates (2026-11-14):** Marking a recommendation read, discarding it, or starting it as a reading book changes only that recommendation to `DELETED`; remaining recommendations stay unchanged. The recommendations panel can show full history, including deleted rows. Starting one adds it to the user's `READING` books. Open Library recommendations search for Spanish works first.

**Recommendation Prisma browser error (2026-11-13):** Moved recommendation book lookups and read-status updates from the client component into authenticated server actions. Multi-book selection now targets the clicked recommendation, and server actions verify user ownership and completed-book status before updating.

**Tag query mapping (2026-11-09):** Updated `getUsedTags()` to query the PostgreSQL `tags` table name declared by `Tag @@map("tags")`, avoiding a raw-query reference to the nonexistent `"Tag"` relation.

**Prisma schema alignment (2026-11-09):** Kept `Book.userId` mapped to the existing PostgreSQL `userId` column and restored missing inverse relations so Prisma Client generation validates against the current schema.

**Unauthenticated password reset (2026-11-09):** Added public `/forgot-password` and `/reset-password` routes. Recovery emails use a one-hour, one-time token stored only as a SHA-256 hash; successful resets revoke all sessions. Responses do not disclose whether an email is registered. Configure `APP_URL` and SMTP for delivery.

**Mobile-first responsive layout (2026-11-02):** Updated dashboard shell for viewport-height scrolling, compact mobile gutters, touch-sized navigation, mobile overlay drawer, Geist font, reduced-motion preferences, narrowed spacing on search/statistics/saga pages. Dashboard book lists retain horizontal scroll on narrow screens. Login/signup use responsive split desktop/mobile layouts.

**Logo integration (2026-11-11):** Added `books-logo.png` to the public folder and integrated it into the login page (`src/app/login/page.tsx`) and dashboard header (`src/components/DashboardShell.tsx`). Login page displays the logo in the desktop layout; dashboard header includes the logo alongside the "Books" title.

**Document Purpose:** Current project architecture and implementation status for the `books` reading analytics platform.

**System:** Full-Stack Reading Analytics Application (Next.js 16 + TypeScript)

**Key constraints:** PostgreSQL only supported database (local dev via PostgreSQL, production via Neon/managed PostgreSQL). MariaDB decommissioned. Reading year comes from worksheet/tab name, not `Año` column. Only tabs starting with `Leidos/Leídos` are read records.
## 2. Technical Stack Specifications

**Framework:** Next.js 16.4, App Router, React 19, TypeScript strict

**Database:** Prisma 6 + PostgreSQL (`postgresql` provider)

**Visualizations:** Recharts 3, Tailwind CSS 4

**Core libraries:** ExcelJS (Streamed, non-blocking asynchronous workbook interpreter), Recharts 3

## 3. Data Schema & Spreadsheet Contract

**Workbook shape:** 25 worksheets. Only tabs starting with `Leidos/Leídos` are "read books" data: `Leidos antes` (pre-2008) + `Leidos/Leídos 2008` … `Leídos 2026` (20 read tabs). Other tabs skipped: `Pendientes` (to-read), `Descartados` (discarded), `Proxima Visita`, `kindle`, `Gráficos` (charts).

**Reading year:** Comes from tab name, not `Año` column (publication year).

**Key tables:** Book (userId, ano, status, genreId, publicationYear, ...), book_tags (book_id, source, deleted, tag).

**Indexes:** `Book_userId_idx`, `Book_userId_ano_status_idx`, `Book_userId_status_idx` verified optimal.
**Commands:** `npm run dev`, `npm run build`, `npm run start`, `npm test`, `npm run lint`, `npm run validate:ingestion`, `npm run check:encapsulation`, `npm run switch-db <local|cloud|neon>`
## 4. Ingestion Pipeline

**Parser:** ExcelJS, streamed, non-blocking asynchronous

**Read records:** From worksheet tabs starting with `Leidos/Leídos`

**Key behaviors:**
- Multiple data sources per book (Open Library, Google Books, ISBN fallback)
- Tag retrieval from Open Library with manual deletion capability
- Language tag filtering
## 5. Phase Implementation Status

**Phase 3 (2026-10-15):** Implemented. Dashboard render correction: fixed default-year prerender error using latest recorded `readingYear` with `PRE_TAB_READING_YEAR_SENTINEL` (2007) fallback for empty ledger.

**Phase 5 (2026-10-14):** Executed. Phase 5 features implemented.

**Phase 6 (ongoing):** Features 6.1, 6.2, 6.3 implemented.

**Recent additions (2026-11):**
- **Author nationality pie chart (2026-11-23):** Recharts PieChart visualizing author distribution by nationality using `getCountryStats()` from `analytics.ts`. Updated `src/app/stats/page.tsx`.
- **Preference profile builder (2026-11-23):** Added `buildPreferenceProfileAction` server action in `src/app/actions/personalizedRecommendationsActions.ts` that builds a user preference profile from high-rated completed books and saves it to the `user_preference_vectors` PostgreSQL table. Updated `src/app/account/page.tsx` with a "Build Preference Profile" button in the user's account section.
## 6. Performance Optimization Delta (2026-11-11)

**Objective:** Improve main page load performance from 56s/35s to target <5s.

**Changes Made:**
1. **Baseline JavaScript Optimization:** Configured `next.config.ts` and `tsconfig.json` to target ES2017 + Node 20, avoiding unnecessary polyfill transpilation. Reduces bundle size and improves first-load parse time.
2. **Database Index Verification:** Verified all necessary indexes exist on Book and book_tags tables for dashboard queries.
3. **Performance Analysis:** Identified 3 Prisma queries on every dashboard render (`getAvailableReadingYears`, `getYearKpis`, `getUsedTags`). No caching implemented between requests.

**Validation Results:**
## 7. Plan (ordered by impact)
## Author Nationality Pie Chart (2026-11-23)

Added `src/components/charts/NationalityChart.tsx` — Recharts PieChart visualizing author distribution by nationality using `getCountryStats()` from `analytics.ts`. Updated `src/app/stats/page.tsx` — Integrated NationalityChart into the main stats page alongside other charts. Fetches data server-side via `getCountryStats()` and passes it as a prop to the client-side chart component.

---

1. **Database query optimization** - indexes verified optimal
2. **JavaScript Baseline optimization** - ES2017 target, minimal polyfills
3. **ISR caching implementation** - would require config adjustment (incompatible with cacheComponents: true)
## Dashboard sort+filter controls (2026-11-08)

Recreated `src/components/dashboard/DashboardSortAndFilterControls.tsx` (file was corrupted to `line1`/`line2` and exported nothing, breaking `src/app/page.tsx`). The module exposes `DashboardSortAndFilterControlsProps` and renders a status filter (Reading/Read, `DashboardFilter`) plus the cards sort selector, navigating via `next/navigation` `useRouter`.

`src/app/page.tsx` now imports `parseDashboardFilter` from `@/lib/dashboard` and passes `filter={parseDashboardFilter(filter)}` instead of the `filter as string` cast; `onFilterChange` is typed as `(filter: DashboardFilter) => void`.

Deleted stray zero-extension file `src/components/dashboard/DashboardSortAndFilterControls` that would have shadowed module resolution.

**Runtime fix (2026-11-08):** Removed `onFilterChange` prop — a Server Component (`page.tsx`) cannot pass event-handler function props to a Client Component (`"use client"` DashboardSortAndFilterControls). Navigation now lives entirely inside the client component via `useRouter()` + `useSearchParams()` (preserving `view`, resetting `page`), so all props crossing the boundary are serializable (`year`, `view`, `sort`, `direction`, `filter`).

---
4. **Image/asset optimization** - lazy-load covers, font preloading
5. **Code splitting & lazy loading** - lazy-load non-critical components
- `npm run build`: Compiles successfully
- `npm test`: 71/73 pass (2 pre-existing open-library-images failures)
- `npm run lint`: 47 warnings + 4 pre-existing errors (no new issues)
- `npm run check:encapsulation`: OK

**Assumptions:** 813 books, 20 reading years, 1921 tags per user (marino). PostgreSQL via Neon/managed provider. Next.js 16 App Router with React 19, Tailwind CSS 4.

---
- **Dashboard sort+filter controls (2026-11-08):** Recreated corrupted `DashboardSortAndFilterControls.tsx`. Added 'All' filter option. Fixed runtime prop passing issue between Server/Client components.
- **Metadata ops group (2026-11-12):** Left panel menu reorganization with 4 new metadata features: Duplicate books finder, Find books without pub year, Delete orphan authors, Orphan books maintenance.
- **Logout button (2026-11-12):** Placed in users panel within DashboardShell, moved from floating bottom-right placement (2026-10-25).
- **Image caching (2026-11-05):** Added `getBookCounts()` helper in `src/lib/analytics.ts`, consolidated 5 `prisma.book.count()` calls. Set up `.env.local` with local PostgreSQL dev URL.
- **Open Library tag report performance (2026-11-05):** Added composite index `book_tags_book_id_source_deleted_idx`. Reduced report load time from 10+ seconds to under 100ms.
- **Local PostgreSQL development (2026-11-05):** Set up `.env.local` with `DATABASE_URL="postgresql://book:password@127.0.0.1:5432/reading_tracker_local"`. MariaDB migration script decommissioned.
- **Author nationality & country features (2026-11-02):** Fixed root cause of "no authors loaded" issue. Added `src/app/actions/authorNationalityActions.ts` with `getAuthorsWithoutNationality()` server action. Added orphan author deletion/view features.
- **Mobile-first responsive layout (2026-11-02):** Updated dashboard shell, compact mobile gutters, touch-sized navigation, reduced-motion preferences, Geist font.

**Earlier phases (2026-10):** PostgreSQL/Neon migration, ISBN fallback to Google Books, tag management, recommendation matching, transaction timeout hardening, stats expansion, backup scripts.
- Recommendation same-book matching

- **Book recommendation engine (2026-11-23):** New feature - personalized book recommendations combining internal tag/genre/author similarity with Open Library external search. Implements `getPersonalizedRecommendations()` server action and `RecommendationsList` component. Updates `DiscoveryMetrics` to include recommendation source data.
- **Author portrait `next/image` error (2026-11-24):** Found and fixed the real root cause of missing portraits. `trustedPortraitUrl()` in `src/components/AuthorPortrait.tsx` had a broken regex on line 41 (`/^\\/a\\/id\\/\\d+-[SML]\\\\.jpg$/`) where `\\/` was parsed as an escaped backslash followed by `/` closing the regex literal, so it rejected every Open Library portrait URL and returned `null`. Fixed to `/^\/a\/id\/\d+-[SML]\.jpg$/`. The component renders `portraitUrl` directly — Open Library URLs via `images.remotePatterns` and local `/portraits/...` paths — which works cross-browser without `images.localPatterns`. Also removed the dead `effectivePortraitUrl`/`portraitCacheUrl` code that passed `/api/cache-portrait?authorId=Q...` (a local URL with a query string) to `<Image>`, which triggered the `localPatterns` error; that route also 404s for Wikidata IDs (`Number("Q...")` → `NaN`) and `localPatterns.search` matches literals only. Wikidata authors without a stored `portrait_url` show initials until their `Author` record is enriched with an Open Library photo ID.
- **Linked orphaned local portrait files (2026-11-24):** 62 `public/portraits/*.webp` files whose filenames match an `Author.id` but had no `portrait_url` were linked via `UPDATE "Author" SET portrait_url = '/portraits/<id>.webp'`. Eduard Punset (`7b2c9e85-...`) was linked earlier. Result: 63 authors now reference local `/portraits/` files (was 0), 227 authors have any portrait (was 165), 199 authors still lack a portrait (data gap). One file (`1181099f`, C. W. Ceram) remains unlinked only because that author already has a working Open Library portrait.
- **Local dev DB tag table alignment (2026-11-10):** Fixed `npm run dev` failing in the browser with `PrismaClientKnownRequestError 42P01: no existe la relación «tags»` at `getUsedTags()` (src/lib/tags.ts:49). The local PostgreSQL database had the table `Tag` (created by migration `0_init`) while `prisma/schema.prisma` declares `Tag @@map("tags")`, so the raw `FROM "tags"` query resolved against a nonexistent relation. Renamed `Tag` → `tags` in the dev database and added idempotent migration `prisma/migrations/20261110120000_align_tag_table_name/` (DO block guarded by `information_schema`, safe to re-apply). Also cleaned up corrupted `.env.local` (duplicated/concatenated `DATABASE_URL` and `channel_binding` lines); dev now targets `postgresql://book:password@127.0.0.1:5432/reading_tracker_local`. Verified end-to-end: dashboard renders (`GET /` 200, tag links present, zero Prisma errors); `npm test`/`npm run lint` show only pre-existing issues.

**Scripts:** `src/scripts/`, `npm run validate:ingestion` (parse source workbook without DB)

**Stack status:** Phase 4 (cloud deployment) planned but not executed. Phase 5 stretch goals open (origin donut, publication-era histogram, CSV export, analytics caching). Phase 6 features 6.1, 6.2, 6.3 implemented.

---
## 2026-11-26

### Recommendation buttons update
- **Delete button**: Changed to "Dismissed" - marks recommendation as OLD_DISMISSED status instead of deleting from database
- **Refresh button**: Renamed to "Recalculate" - marks existing recommendations as OLD_DISMISSED and generates 5 new recommendations one-by-one
- **Mark as read button**: Now finds all books by the recommendation's author in the database and allows user to mark which one was read, excluding already-read books from future recommendations

### Left panel button size reduction
