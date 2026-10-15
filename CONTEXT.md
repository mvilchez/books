# Technical Architecture & Context Continuity Blueprint: project "books"

**Document Purpose:** Current project architecture and implementation status
**System:** Full-Stack Reading Analytics Application (Next.js 16 + TypeScript)

---

## 1. Executive Summary & Goals
The objective of this project, named **`books`**, is to engineer a lightweight web platform to replace a multi-year legacy Excel spreadsheet used for personal reading tracking.

The primary business goal is to **preserve and migrate a historical ledger containing multiple years of reading data with 100% data integrity**, while unlocking advanced server-side statistical matrix calculations and real-time interactive analytical dashboards.

---

## 2. Technical Stack Specifications
If this session breaks, the incoming AI engine must strictly maintain this architectural baseline:
*   **Framework:** Next.js 16.4 (App Router, React Server Components, Server Actions for mutations).
*   **Language Ecosystem:** TypeScript 5.x running under strict compiler flags (`strictNullChecks`, `noImplicitAny`).
*   **Database & ORM:** Prisma ORM 6 communicating with MariaDB through its `mysql` provider. Local development uses the workstation's MariaDB service; production SkySQL provisioning is not complete.
*   **File Parsing Core:** ExcelJS (Streamed, non-blocking asynchronous workbook interpreter).
*   **Visualizations:** Recharts 3 client components for statistics, styled with Tailwind CSS.

---

## 3. Data Schema & Spreadsheet Contract
> **Revised after Step 1.2.** The original blueprint assumed a single-sheet, 5-column file. The real source workbook is **multi-tab (25 sheets)** with a wider column set. The contract below reflects the file actually parsed by the ingestion sandbox (`src/scripts/validate-ingestion.ts`).

### Workbook shape
*   **25 worksheets.** Only tabs whose **name** starts with `Leidos/Leídos` are "read books" data: `Leidos antes` (pre-2008) + `Leidos/Leídos 2008` … `Leídos 2026` (20 read tabs). Other tabs are non-read and are skipped by the importer: `Pendientes` (to-read), `Descartados` (discarded), `Proxima Visita`, `kindle`, and `Gráficos` (charts).
*   **Row 1 is a header row**; data starts at row 2. Each read tab also carries **footer/summary rows** at the bottom (`Libros Leídos`, `Estadísticas`, aggregate formulas) that must be excluded — they are not books.
*   **Columns vary per tab** (older tabs have fewer). Columns are matched **by header name** (diacritic/case/space-insensitive), never by fixed position. `Autor` appears **twice** on some tabs; both occurrences are read.

### Column contract (by header name)
| Header (source) | Meaning | Type / notes |
|---|---|---|
| `Titulo` | Title | String. Composite unique key with the author. |
| `Autor` | Author (appears 1–2×) | String. Normalized into the `Author` relation (1-to-Many). |
| `Origen` | Origin/source | String (e.g. `Propio`, `Prestado`, `ebook`). |
| `Fecha Inicio` | Reading start date | `Date` cell → ISO `YYYY-MM-DD`. |
| `Fecha Fin` | Reading finish date | `Date` cell → ISO `YYYY-MM-DD`. |
| `Paginas` | Total pages | Integer, non-negative. **Nullable** — many historical rows (2008–2013) have no page count. |
| `Tipo` | Genre/type | String (e.g. `Novela`, `Ensayo`, `Historia`). Maps loosely to `Genre`. |
| `Puntuación (del 1 al 10)` | Rating | **Decimal 0–10** (e.g. `8.5`, `7.5`) or `-`/`0`/blank = unrated. **Supersedes** the old `nota personal` (1–5) assumption. |
| `Num leídos` | Times re-read | Often a formula / `#N/A`; captured as text. |
| `Año` | **Publication** year | Integer. Present only on 2014+ tabs. **This is NOT the reading year.** |

### Reading year
*   The **reading year is encoded in the tab name** (`Leídos 2013` → `2013`). `Leidos antes` has no year (pre-2008 back-catalogue).
*   The `Año` **column**, where present, is the book's original publication year — a distinct field from the reading year. The relational schema must keep both (`readingYear` vs `publicationYear`).

### Implications for the relational schema (Phase 2)
The Phase 2 `schema.prisma` sketch must be revised to match reality:
*   `rating` should be `Float?` (decimal 1–10), not `Int?` on a 1–5 scale.
*   Add fields for `origen`, `fechaInicio`, `fechaFin`, `tipo`/`genre`, and `publicationYear` (from the `Año` column), separate from `readingYear`.
*   Ingestion must iterate **all read tabs** (not just `getWorksheet(1)`), select by tab name, derive `readingYear` from the name, and skip footer rows.

---

## 4. Core Business Rules & Metrics Equations
The analytical engine must execute the following mathematical algorithms on the server side to power the visual dashboard:

> **Note (post-Step 1.2):** `readingYear` is derived from the source **tab name**, not a column. Ratings use the **1–10 decimal** scale (`Puntuación (del 1 al 10)`), not 1–5.

### Chronological Metrics & Leap-Year Control
*   **Total Books:** Count of books marked as `COMPLETED` within a given year matching the `readingYear` index.
*   **Total Volumes Read:** Cumulative pages read across both completed books (`totalPages`) and currently active items (`currentPages`). Note: `totalPages` is nullable for pre-2014 historical rows (treated as 0 in page sums).
*   **Average Pages Per Book:** `StaticPagesInYear / TotalBooksInYear` (rounded to nearest integer).
*   **Average Pages Per Day:** Computed dynamically by evaluating the target calendar year. The system checks for leap years:
    \[\text{Days} = (\text{Year} \pmod 4 === 0 \land \text{Year} \pmod{100} !== 0) \lor (\text{Year} \pmod{400} === 0) ? 366 : 365\]
    The final daily speed average is calculated as: `NetPagesRead / Days`, fixed to 2 decimal points.

### Rankings & Recommender Engine Rules
*   **Top Authors & Genres:** Aggregated count queries limited to the top 5 records sorted by volume count in descending order.
*   **Discovery Suggestions:** An automated discovery algorithm that queries items in the `WISH_LIST` status filter whose relational `genreId` matches the user's top two most consumed categories historically.

---

## 5. Next Steps for Implementation
The project is divided into 5 phases (Setup, Migration, CRUD Development, Cloud Provisioning, Analytics Framework).

**Status:** Phase 1 is **complete** — Step 1.1 (workspace bootstrap) and Step 1.2 (multi-tab ingestion sandbox CLI, `src/scripts/validate-ingestion.ts`) are done. The sandbox parses all 20 `Leidos/Leídos` tabs of the real workbook with **0 validation errors** (812 books, 430 authors, 356 footer/aggregate rows skipped).
Phase 2 is **complete** — Step 2.1 (Prisma v6 schema on MariaDB), Step 2.2 (local MariaDB engine), and Step 2.3 (transactional bulk import route) are done.

**Step 2.3 — what was built:**
* `src/lib/ingestion/workbook-parser.ts` — the Step 1.2 parsing helpers, **extracted** so the CLI sandbox and the API share one contract. Exports `parseWorkbookBuffer`, `parseWorkbook`, `parseSheet`, the cell/header helpers, and `PRE_TAB_READING_YEAR_SENTINEL = 2007`. Contains **no** database code.
* `src/lib/prisma.ts` — `PrismaClient` singleton cached on `globalThis`, so Next dev hot-reloads do not exhaust MariaDB's `max_connections`. Always import the client from here.
* `src/app/api/v1/import/route.ts` — `POST /api/v1/import`, one Prisma interactive transaction writing `Author` → `Genre` → `Book` (upserts books by title + author + reading year + edition fingerprint). Node.js runtime (the Edge runtime is deprecated in Next 16); no `runtime` export is declared.

**Historical database checks (before footer fix; the database was not changed by the parser fix):**
| Check | Result |
|---|---|
| First import (historical, before footer fix) | `200` · `processed 830` · `created 830` · `updated 0` · 443 authors · 25 genres |
| Re-import (historical, before footer fix) | `200` · `created 0` · `updated 830`; DB stayed **830 / 443 / 25** (idempotent) |
| Field parity vs the CLI baseline | 807 rows with pages, 157 unrated, avg **7.20**, **327 490** pages, 23 null `totalPages` |
| Atomicity | A forced mid-transaction error rolled back every write |
| CLI parsing after the footer fix | 25 tabs / 20 read / 5 skipped, 812 books, 0 errors, 356 footer/aggregate rows |
| `tsc --noEmit`, `eslint`, `next build` | clean; `/api/v1/import` emitted as `ƒ (Dynamic)` |

The updated parser excludes 18 additional footer/aggregate rows (812 books instead of 830). Review and delete the previously imported summary rows with the cleanup script before re-importing the corrected workbook.

**Decisions worth preserving:**
* **`Leidos antes` → `readingYear` sentinel `2007`** (not skipped). `readingYear` is `NOT NULL` and part of the composite unique key, so silently dropping the pre-2008 back-catalogue would lose data; the sentinel is exported and the API reports `backfilledReadingYear`.
* **Historical author counts** were recorded before aggregate-row filtering. `Author.name` uses MariaDB's default `utf8mb4_unicode_ci`, which folds accents/case; clean old footer rows before comparing current import counts.
* **Reading events, editions, and idempotency:** the importer upserts by title + author + reading year + edition fingerprint. The workbook has no ISBN/edition column; it uses ISBN/edition if present, otherwise publication year + page count. Different reading years and distinct edition fingerprints are retained. Without an explicit identifier, editions sharing publication year and page count cannot be distinguished. Run `npm run cleanup:books` to preview footer/aggregate rows and exact same-year duplicates; add `-- --execute` to remove only listed rows. Run `npx prisma db push` before using the updated importer or cleanup script on an existing database.
* **All modelled fields are now ingested**, not just title/author/pages: `rating` (decimal 0–10), `publicationYear` (from the `Año` column, distinct from `readingYear`), `origin`, `startDate`/`finishDate` (UTC midnight — MariaDB `DATETIME` has no timezone), and `genre` (from `Tipo`).
* **`exceljs@4.4.0` has an incorrect `.d.ts`** (`declare interface Buffer extends ArrayBuffer`). `parseWorkbookBuffer` normalises `Buffer | Uint8Array | ArrayBuffer` into a Node `Buffer` and applies one documented cast.
* Added the missing `tsx` devDependency + `validate:ingestion` npm script (Step 1.2 referenced a command that `package.json` never declared).

**Phase 3 implemented (2026-10-15):**
* **Dashboard (`src/app/page.tsx`)** — server-rendered dashboard with year navigation, newest recorded reading year as the default (2007 sentinel if there are no books), compact per-year metrics, and Cards/List display modes. View selection is URL-backed (`?view=list`); year navigation preserves it. The list sorts by start date ascending and places books without a start date last. Database reads and `searchParams` are inside `<Suspense>` for `cacheComponents`.
* **Book tracking (`src/components/BookCard.tsx`, `src/app/actions/bookActions.ts`)** — typed book cards with progress bars and a `+10 Pages` action for unfinished books. Progress is validated and clamped to `[0, totalPages]` when a total is known.
* **Create book (`src/app/books/new/page.tsx`, `src/components/NewReadingBookForm.tsx`)** — dashboard link opens a form for title, author, start date, and optional page count and genre. Server Action upserts author/genre, assigns the reading year from the UTC start date, creates the book with `READING` status, validates input, and reports duplicate reading events.
* **Edit book details (`src/app/books/[id]/page.tsx`, `src/components/BookDetailsForm.tsx`)** — detail page exposes editable title, author, status, rating (decimal 0–10), reading and publication years, total/current pages, start/finish dates, genre, origin, and edition key. Author and genre relations are upserted within the update transaction. There is no personal-note field and no individual-book delete UI. The rating uses the existing `rating`/`nota_personal` column; no schema migration was added.
* **Import and analytics** — the dashboard's workbook import remains available. `/stats` provides yearly and all-time analytics, charts, rankings, and wishlist suggestions.
* **Verification:** `npx tsc --noEmit`, targeted ESLint, `git diff --check`, and `npm run build` passed for the book-management changes. Smoke checks returned HTTP 200 for the dashboard, new-book route, and an existing book detail page; the detail response included the editable form.

**Dashboard render correction (2026-10-15):** a previous default-year implementation used `new Date()` during prerendering and caused a Next.js 16 blocking-prerender error. It was replaced with a lookup of the latest recorded `readingYear`, falling back to `PRE_TAB_READING_YEAR_SENTINEL` (2007) for an empty ledger. Dashboard and new-book smoke checks returned HTTP 200 after the fix.

**Phase 5 executed (2026-10-14):**
* **Step 5.1** — `recharts@^3.10.1` installed (React 19 peer satisfied); `src/lib/analytics-types.ts` = zero-runtime-import DTO contract shared via `import type`.
* **Step 5.2** — `src/lib/analytics.ts`: SQL-side `groupBy`/`aggregate`/`count` over the `@/lib/prisma` singleton (`getYearlyTrend`, `getYearKpis`, `getRatingDistribution`, `getGenreShares`, `getTopAuthors`, `getMonthlyPace`, `getDiscoveryMetrics`). Leap-year pages/day per §4; UTC date getters for month bucketing. One deviation from the plan snippet: the unused `PRE_TAB_READING_YEAR_SENTINEL` import was dropped (lint).
* **Step 5.3** — five `'use client'` chart leaves in `src/components/charts/` (`YearTrendChart`, `RatingChart`, `GenreChart`, `AuthorsChart`, `MonthlyPaceChart`), each with a fixed `h-[300px]` parent and empty-state guards.
* **Step 5.4** — `src/app/stats/{page.tsx,_components.tsx,loading.tsx}`: static header shell + `<Suspense>`-gated `StatsContent` (awaits the `searchParams` Promise); KPI cards, deep-linkable year pills (`/stats?year=…`, invalid falls back to newest year, 2007 renders "pre-2008"), server-rendered Top-5 authors/genres + WISH_LIST suggestions.
* **Verified live:** `tsc --noEmit`/`eslint src`/`next build` clean; `/stats` builds as **◐ Partial Prerender** (the checklist expected ƒ — ◐ is the cacheComponents-correct outcome). Smoke vs independent DB baseline: default `/stats` → active pill 2026, Books **51**, Pages **20.342** (es-ES), avg/book **399**, avg/day **55.73**, avg rating **7.8**, **139** unrated (all years), **19** finished without Fecha Fin, 20 year pills, TopList Bujold **18** / Novela **445**, suggestions empty-state, 5/5 chart captions. `?year=2019` → 26 / 12.734 / 490 / 34.89 / 8.0 / 3 without-dates. `?year=banana` → falls back to 2026. `?year=2007` → "pre-2008" pill, 1 book / 0 pages / 6.0. Not live-tested (code-guarded only): empty-database states and the 375 px layout (no browser available).

**Remaining / planned:**
* **Phase 4:** Production provisioning (managed MariaDB and deployment) is not implemented.
* **Phase 5 stretch goals:** Origin donut, publication-era histogram, CSV export route, and analytics caching with invalidation after imports remain open.
* **Phase 6 implementation:** Features 6.1 (richer dashboard cards/list and URL-backed sorting) and 6.2 (global title/author autocomplete) are implemented. Feature 6.3 uses the approved Wikidata + individually licensed/credited Wikimedia Commons approach. Optional portrait/source/license fields are in `Author` and have been applied additively to the local MariaDB with `npx prisma db push`. A dry-run sync was attempted but Wikidata returned `maxlag` twice; the command stopped without changing author records, so no portrait data is populated yet. `npm test` passes 7 unit tests; TypeScript, targeted ESLint, and production build pass. Read-only route checks validated cross-year search, malformed/repeated/wildcard queries, and dashboard rendering. See `PLAN.md`.
