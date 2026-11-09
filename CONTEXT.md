# Technical Architecture & Context Continuity Blueprint: project "books"

**Prisma schema alignment (2026-11-09):** Kept `Book.userId` mapped to the existing PostgreSQL `userId` column and restored missing inverse relations so Prisma Client generation validates against the current schema.

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

**Scripts:** `src/scripts/`, `npm run validate:ingestion` (parse source workbook without DB)

**Stack status:** Phase 4 (cloud deployment) planned but not executed. Phase 5 stretch goals open (origin donut, publication-era histogram, CSV export, analytics caching). Phase 6 features 6.1, 6.2, 6.3 implemented.

---