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

**Start-a-book ISBN/barcode intake (2026-10-18):**
* **`src/lib/isbn.ts`** — pure ISBN helpers: normalization (hyphens/spaces/dots), ISBN-10/ISBN-13 check-digit validation, ISBN-10 → ISBN-13 conversion, and `toIsbn13` (returns `null` for non-book EAN-13 codes, so a random retail barcode never reaches Open Library). Covered by `src/lib/isbn.test.ts` (in `npm test`).
* **Open Library ISBN lookup** — `lookupOpenLibraryBookByIsbn`/`parseOpenLibraryIsbnLookup` in `src/lib/open-library-images.ts` use `GET /api/books?bibkeys=ISBN:<isbn13>&jscmd=data&format=json` (the books API, not `search.json`, which cannot query by ISBN). A missing key parses to `null` ("no record"), not an error. The parser extracts title, first author, page count, publication year, cover ID (from the cover URL), and work ID (from the entry `url`). Shared `fetchJson` caching (one day) and timeout apply.
* **Server action `lookupBookByIsbn`** (`src/app/actions/openLibraryImageActions.ts`) validates/canonicalizes the input with `toIsbn13` before contacting Open Library and returns typed `IsbnLookupData`.
* **`/books/new` UI** (`src/components/NewReadingBookForm.tsx`) — the form fields are now controlled state so a successful lookup can prefill them. An "Add by ISBN or barcode" panel offers: typed ISBN + Look up, live camera scanning (`@zxing/browser`/`@zxing/library`, lazily imported, restricted to EAN-13/EAN-8/UPC-A/UPC-E, rear camera via `facingMode: environment`), and local photo decoding of an uploaded barcode image. Camera use requires HTTPS and permission; failures degrade to the manual form. Editing the prefilled title/author/pages clears the resolved metadata so a stale cover/ISBN is never saved with mismatched details.
* **Persistence** — `createReadingBook` accepts hidden `isbn13`/`publicationYear`/`openLibraryCoverId`/`openLibraryWorkId` fields, validated server-side; `createReadingBookRecord` stores them and sets `editionKey = isbn:<isbn13>` (the importer's convention), so `getBookCoverUrl` can render the ISBN cover and the composite unique key dedupes the same edition within a reading year. No schema change was needed — the `Book` columns already existed. A front-cover photo cannot be reverse-looked-up (Open Library has no image search); all inputs converge on extracting an ISBN, with the manual form as fallback.
* **Optional start date (defaults to today)** — the start-date field is no longer required (the label says "defaults to today"); the input stays empty and `createReadingBook` treats an empty date as today at UTC midnight (the importer's date convention). The field is deliberately not prefilled client-side: computing "today" during render would make the prerendered shell and the client disagree (hydration mismatch), and the repo lint bans `setState` in effects. A non-empty but invalid value is still rejected; the reading year comes from whichever date applies.

**Tag-gaps retry + Open Library creation-gap report (2026-10-18):**
* **Fresh lookups on retry** — `fetchJson` in `src/lib/open-library-images.ts` accepts `{ fresh: true }` (→ `cache: "no-store"`), threaded through `searchOpenLibraryBookLookup`. Auto-enrichment keeps the one-day `force-cache`; only explicit retries bypass it, so a retry can pick up Open Library records created after the original cached check.
* **Retry actions** (`src/app/actions/openLibraryImageActions.ts`) — `enrichBookMetadata` was refactored around a shared `runBookMetadataEnrichment(book, { fresh })` core (lookup → `saveOpenLibraryMetadata` → revalidate; `saveOpenLibraryMetadata` always rewrites candidates and `metadataCheckedAt`, so no flag reset is needed). `retryBookMetadataLookup(bookId)` runs the core uncached for one book; `retryOpenLibraryTagGaps(limit)` re-checks up to ten already-checked tag-gap books (oldest `metadataCheckedAt` first, via `getOpenLibraryTagGapsForRetry`), pausing 750 ms between requests and stopping at the first lookup failure so transient errors don't burn the batch. Both revalidate the reports pages.
* **Report UI** (`src/app/reports/open-library-tags/page.tsx` + `src/components/MetadataRetryButtons.tsx`) — a **Retry** button per table row and a header **Retry up to 10 checked books** button, both `useTransition`-based with inline result messages and `router.refresh()`.
* **Creation-gap report** — `getOpenLibraryCreationGaps()` selects books with `metadataCheckedAt` set and no `openLibraryWorkId` (confirmed searched-and-missing). `GET /api/v1/reports/open-library-create-gaps` exports them as CSV: title/author/year/pages/genre/manual tags, `suggested_subjects` (genre + manual tags), an Open Library search URL, the `https://openlibrary.org/add` form link, and the local detail URL. The intended workflow: create the book on Open Library by hand, then hit **Retry** so the app links the new work and saves its tags. The page shows a "Confirmed Open Library creation gaps" count card.
* **CSV helpers** — `csvCell`/`buildCsvDocument` moved into `src/lib/csv.ts` (with tests) and reused by both report routes, keeping formula-defusing quoting in one place.

**Remaining / planned:**
* **Phase 4:** Deployment plan written — Render free tier, SkySQL/Neon/Aiven managed database options, and a MariaDB → PostgreSQL migration script (`scripts/backup-to-postgresql.sh`); not yet executed against production.
* **Phase 5 stretch goals:** Origin donut, publication-era histogram, CSV export route, and analytics caching with invalidation after imports remain open.
* **Phase 6 implementation:** Features 6.1 (richer dashboard cards/list and URL-backed sorting) and 6.2 (global title/author autocomplete) are implemented. Feature 6.3 uses explicit, on-demand Open Library searches from a book detail page. Each search returns at most five candidates; no image is saved until its result and preview are manually selected. Successful API responses are cached for one day, and selected cover/portrait images load directly and lazily from Open Library. Selected cover/work IDs are stored additively on `Book`; existing `Author` portrait/source fields store the chosen photo and author profile URL. No bulk lookups or image downloads occur. Existing Commons portraits and title/initial fallbacks remain supported. The new Book image columns were applied to the local database with `npx prisma db push`. See `PLAN.md`.

**PostgreSQL/Neon migration (2026-10-23):**
* Dev target switched with `npm run switch-db neon`; `prisma/schema.prisma` now uses `provider = "postgresql"` and Prisma client regenerated.
* `prisma/migrations/migration_lock.toml` removed to avoid P3019; schema applied to Neon with `npx prisma db push`.
* Local MariaDB data migrated to Neon with `scripts/backup-to-postgresql.sh`; row counts matched for Book (809), Author (432), Genre (25), Tag (937), book_tags (3782), and book_metadata_candidates (1).
* Migration script fixes: removed unsupported `--no-password`, added `--default-character-set=utf8mb4` and `--complete-insert`, and corrected table names to the actual MySQL/PostgreSQL table names.
* Validation: `npm test` passed (61/61), `npm run lint` passed (0 errors, 17 pre-existing warnings), and `npm run build` succeeded when `DATABASE_URL` points to Neon. A plain `npm run build` still sees the MariaDB `DATABASE_URL` in `.env.production` because that file is a registry; override `DATABASE_URL` for PostgreSQL builds or deploy with the Neon URL.
* PostgreSQL follow-up: fixed raw SQL in `src/lib/tags.ts` (`getUsedTags` quoted `

* PostgreSQL follow-up: fixed raw SQL in src/lib/tags.ts (getUsedTags quoted Tag table; mergeTags uses ON CONFLICT upsert). Validated with a live Neon query.

**ISBN fallback to Google Books (2026-10-23):**
* **`src/lib/open-library-images.ts`** — added `lookupGoogleBooksBookByIsbn`/`parseGoogleBooksIsbnLookup` (plus naming aliases) using the Google Books volumes API (`/books/v1/volumes?q=isbn:<isbn13>`). The parser accepts both search (`{ items }`) and single-volume (`{ volumeInfo }`) responses, extracts title, authors, page count, and publication year, and reports missing volumes as `null`. `GOOGLE_BOOKS_API_KEY` (or `GOOGLE_API_KEY`) is appended when present; otherwise the unauthenticated endpoint is used.
* **`src/app/actions/openLibraryImageActions.ts`** — `lookupBookByIsbn` now tries Open Library first and falls back to Google Books when Open Library has no record, so ISBNs such as 9788410025233 that only exist in Google Books still prefill the new-book form.
**Manual deletion of retrieved tags (2026-10-23):**
* **Soft delete for Open Library tags** — `BookTag` now carries `deleted`/`deletedAt`. `deleteBookTag` soft-deletes `OPEN_LIBRARY` rows (keeping the row as memory) instead of removing them; `LIBRARY` tags remain hard-deleted.
* **Preservation on refresh** — `replaceBookTags`/`replaceManyBookTags` only delete active (`deleted = false`) rows, so soft-deleted retrieved tags are not removed and `createMany(..., skipDuplicates)` does not reactivate them when metadata is refreshed or retried.
* **Query filtering** — book detail, tag search, tag options, used tags, and tag-gap reports ignore soft-deleted rows (`deleted = false`), so a manually removed retrieved tag stays removed from the UI while preventing re-retrieval.
**Language tag filtering (2026-10-23):**
* **Library cleanup** — removed all `LANGUAGE` tags except Spanish and English from the Neon database (56 tags and 267 book links), because the library only contains Spanish/English reads.
* **Retrieval filtering** — `parseOpenLibraryBookMetadata` now discards Open Library languages other than Spanish/English (`ALLOWED_OPEN_LIBRARY_LANGUAGES`), so future metadata enrichment cannot re-add them. Existing `saveOpenLibraryMetadata` and enrichment flows inherit the filtered language list.

**Recommendation same-book matching (2026-10-23):**
* **UI** — `BookRecommendations` now shows a **Same book** button (sparkle icon) on each recommendation. Clicking it tells the app that the retrieved Open Library work is the same book currently being viewed.
* **Action** — `markRecommendationAsSameBook` (plus aliases) fetches the recommended work's Open Library record, then reuses `saveOpenLibraryMetadata` with `replaceWorkLink: true` to update the current book's Open Library work link, cover, subjects/tags, languages, and publication year without replacing existing book details.
* **Validation** — `npm test` 61/61, `npm run lint` 0 errors, `npm run build` compiled successfully.

**Recommendation same-book UI polish (2026-10-23):**
* **Cover** — after a successful **Same book** match, the recommendation card now shows the Open Library cover thumbnail for the matched work.
* **Related book link** — the same success state now includes a small **Related book →** link to the currently viewed book.
* **Validation** — `npm test` 61/61, `npm run lint` 0 errors, `npm run build` compiled successfully.

**Transaction timeout hardening (2026-10-23):**
* **Prisma client** — default interactive transaction timeout raised from 5s to 30s (maxWait 10s) for remote/cloud databases.
* **Slow transactions** — explicit 30s timeouts added to `saveOpenLibraryMetadata`, `applyOpenLibraryCandidateMatch`, `saveManualSubjectTags`, and `saveBookDetails` (tag-heavy paths).
* **Validation** — `npm test` 61/61, `npm run build` compiled successfully.

**Saga link on book detail (2026-10-25):**
* **UI** — `src/app/books/[id]/page.tsx` now shows a **View saga: {name} →** link to `/sagas/{name}` when the book has a non-empty `seriesName`, so a book that belongs to a saga can jump to that saga's list of books.
* **Validation** — `npm test` 61/61, `npm run lint` 0 errors, `npm run build` compiled successfully.

**Local PostgreSQL backup + MariaDB decommission plan (2026-10-25):**
* **Backup script** — added `scripts/backup-postgresql-local.sh` (plus aliases) to dump a PostgreSQL source (Neon by default) and restore it into a local PostgreSQL database, with row-count verification.
* **Local PostgreSQL URL** — documented `postgresql://book:password@127.0.0.1:5432/reading_tracker_local` in `.env.example` and `switch-db.sh` (`local-postgres` target).
* **switch-db** — new `local-postgres`/`local-pg` target sets the local PostgreSQL URL and `postgresql` provider.
* **Decommission plan** — added `MYSQL_MARIADB_DECOMMISSION_PLAN.md` with phased MySQL/MariaDB retirement steps, rollback, and validation checklist.
* **npm/README** — added `backup:postgresql:local` script and documentation.

**Local PostgreSQL restore from Neon (2026-10-25):**
* **Restore** — ran `scripts/backup-postgresql-local.sh` (source: Neon `reading_tracker`, target: local `reading_tracker_local`); all row counts match (Author 433, Genre 25, Tag 1189, Book 809, book_tags 4163, book_metadata_candidates 0).
* **Compatibility fix** — restore now filters the PG18-only `SET transaction_timeout` line so dumps from newer servers load into local PostgreSQL 16.
* **App config** — switched dev `.env` to `local-postgres`; Prisma client regenerated.
* **Validation** — `npm test` 61/61, `npm run lint` 0 errors.



**Stats expansion (2026-10-25):**
* **Analytics** — added origin shares, publication-era buckets, all-time KPIs, cumulative trend, most-valuable-books ranking, top authors by pages/rating, series progress, top subjects, metadata coverage, average rating by year, and rereads; plus `getSimilarBooks` internal recommender.
* **Pure modules** — `src/lib/book-value.ts` and `src/lib/similar-books.ts` with unit tests (67 tests total).
* **Charts** — `OriginChart`, `PublicationEraChart`, `CumulativeTrendChart`.
* **UI** — `/stats` now renders all-time KPIs, new charts, top-10 most valuable books, and expanded rankings; book detail shows similar books.
* **Export** — `GET /api/v1/stats/export` CSV download (optional `?year=`).

**Step 2026-11-05 — Excel export feature:**
* Added `GET /api/v1/books/export` route handler (`src/app/api/v1/books/export/route.ts`) that exports the user's book library to an Excel workbook organized by reading year, using ExcelJS. One worksheet per reading year with columns matching the import format (Titulo, Autor, Paginas, Fecha Inicio, Fecha Fin, Tipo, Puntuación, Num leídos, Año, Origen).
* Added `getBooksForExport(year?)` domain function in `src/lib/books.ts` that fetches books grouped by reading year, optionally filtered by year.
* Added "Export to Excel" button to the left collapsible menu in `src/components/DashboardShell.tsx`.
* **Validation** — `npm test` 67/67, `npm run lint` 0 errors, `npm run build` compiled successfully.

**Authentication + per-user ownership (2026-10-25):**
* **Schema** — added `User` (email, passwordHash, role) and `Session` (hashed token, expiry) models; `Book.userId` FK with cascade; backfilled 809 existing books to a default owner.
* **Auth** — custom cookie-session auth (scrypt password hashing, SHA-256 session tokens, httpOnly cookies) in `src/lib/auth.ts` + `src/lib/password.ts`; `src/proxy.ts` optimistic guard; login/signup pages + Server Actions.
* **Ownership** — all book/tag/analytics/import/export service reads and mutations scoped by the signed-in user; DAL re-verifies on every action/route.
* **Validation** — `npm test` 67/67, `npm run lint` 0 errors, `npm run build` compiled successfully, `npm run validate:ingestion` 0 errors.

**FK repair helper (2026-10-25):**
* **Script** — `npm run repair:user-ownership` ensures the `marino` owner exists and reassigns any orphaned `Book.userId` rows before adding the `Book_userId_fkey` constraint (fixes P3005/FK violations on existing DBs).

**Default owner "marino" (2026-10-25):**
* **DB** — default user changed to `marino` (id `marino`, email `marino@books.local`, ADMIN role); all 809 books reassigned; old Owner removed; `Book.userId` now defaults to `'marino'` at DB level. Password is not stored in repo; set via `DEFAULT_OWNER_PASSWORD` (see `.env.example` if present) or the repair script.
* **Backfill script** — defaults to marino id/email/password; can be overridden via env vars.
* **Password handling** — no admin password is committed; the migration seeds an unusable placeholder (`!`); set a real password via `DEFAULT_OWNER_PASSWORD` + `npm run repair:user-ownership` (or accept a generated one printed to the console).
**Tags query fix (2026-10-25):**
* **Bug** — `getUsedTags()` raw SQL referenced `b.user_id`, but `Book.userId` has no `@map`, so the actual column is `"userId"` (camelCase) → Postgres error `42703 column b.user_id does not exist`.
* **Fix** — updated raw query to `b."userId"`; verified against local Postgres.

**Logout button (2026-10-25):**
* **Feature** — added `LogoutButton` client component (`src/components/LogoutButton.tsx`) wired to existing `logoutAction` (destroys session + redirects to `/login`).
* **Placement** — in `DashboardShell` menu and globally via `LogoutSlot` (Suspense-gated) in the root layout, so it appears on every authenticated page as a floating bottom-right button.
* **Update (2026-10-29)** — changed 'Change password' left-panel link to a button with matching style to the left panel buttons (`inline-flex items-center rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white`). Added "Import books" button to left panel dashboard menu with same styling as "Export to Excel" (`primary: true`, `PlusIcon`, `href: "/import"`), and removed `IngestionWidget` from the dashboard body so it now only appears in the left panel menu.
* **Update (2026-11-05)** — moved to top-left user menu profile alongside logout option; floating buttons removed from main dashboard view.

**Account/password change (2026-10-25):**
* **Feature** — added `/account` page with `ChangePasswordForm` allowing authenticated users to change their own password (verifies current password, min 8 chars, confirmation match); server action `changePasswordAction` + `findUserById`/`updateUserPassword` helpers in `lib/auth.ts`.
* **Navigation** — "My account"/"Account" links added to DashboardShell menu and global LogoutSlot.
* **Update (2026-11-05)** — moved to top-left user menu profile alongside logout option; floating buttons removed from main dashboard view.
**Performance pass (2026-10-25):**
* **Stats page** — removed a duplicate `getTopAuthors` round-trip by reusing the top-10 result sliced to top-5 for discovery metrics; parallelized publication-era bucket count with its findMany; narrowed `getTopSubjects` tag projection.
* **Book detail recommender** — `getSimilarBooks` now selects only the columns it consumes instead of full `Author`/`Genre`/`Tag` rows.
**Performance pass v2 (2026-10-25):**
* **DB** — added composite indexes on `Book(userId, readingYear, status)`, `Book(userId, status)`, `Book(userId, rating)`, `BookTag(bookId, deleted)`, `BookTag(tagId, deleted)`; applied via `prisma db push`.
* **Stats page** — converted all 8 chart imports to `next/dynamic` (code-split Recharts bundle).
* **Rendering** — removed `unoptimized` from `BookCover` to enable Next image optimization for Open Library covers.
* **Micro-opt (2026-11-05):** analytics query refactor — added shared `getBookCounts()` helper in `src/lib/analytics.ts` that consolidates 5 `prisma.book.count()` calls used by `getMetadataCoverage()` and prepares infrastructure for future `'use cache'` caching per PLAN.md §5. Also fixed `src/lib/_cache_test.ts` ESLint error: `T extends any[]` → `T extends unknown[]`.

* **Micro-opts** — hoisted `Intl.DateTimeFormat` instances in `BookCard` and dashboard table to module scope.
* **Validation** — `npm test` 67/67, `npm run lint` 0 errors, `npm run build` compiled successfully.
* **Deferred** — cross-request analytics caching (`'use cache'`) left as stretch goal due to user-scoped cache-key/isolation concerns; DB-side dashboard pagination and SQL aggregation rewrites deferred to next pass.

* **Validation** — `npm test` 67/67, `npm run lint` 0 errors, `npm run build` compiled successfully.


**Image caching (2026-11-05):**
* `next.config.ts` — added /a/id/** remote pattern for covers.openlibrary.org to enable Next.js image optimization and caching for Open Library author photos (previously only /b/id/** and /b/isbn/ were covered).
* `src/components/AuthorPortrait.tsx` — removed unoptimized prop from next/Image component to allow automatic image optimization and caching for author portraits.
* `src/components/SagaCardCover.tsx` — removed unoptimized prop from next/Image component to allow automatic image optimization and caching for saga cover collages.
* Validation — `npm test` 67/67, `npm run build` compiled successfully.
