# Technical Architecture & Context Continuity Blueprint: project "books"

**Author / Role:** Senior Software Engineer & Team Lead  
**Document Purpose:** Contextual Safe-Guard / Session Resumption Telemetry  
**System Target:** Full-Stack Reading Analytics Application (Next.js 15 + TypeScript)

---

## 1. Executive Summary & Goals
The objective of this project, named **`books`**, is to engineer a lightweight, high-performance web platform and Progressive Web App (PWA) to completely replace a multi-year legacy Excel spreadsheet used for personal reading tracking. 

The primary business goal is to **preserve and migrate a historical ledger containing multiple years of reading data with 100% data integrity**, while unlocking advanced server-side statistical matrix calculations and real-time interactive analytical dashboards.

---

## 2. Technical Stack Specifications
If this session breaks, the incoming AI engine must strictly maintain this architectural baseline:
*   **Framework:** Next.js 15+ (App Router, React Server Components, Server Actions for mutations).
*   **Language Ecosystem:** TypeScript 5.x running under strict compiler flags (`strictNullChecks`, `noImplicitAny`).
*   **Database & ORM:** Prisma ORM communicating with a managed MariaDB engine (SkySQL in production, local Docker container for development). Prisma drives MariaDB through its `mysql` provider.
*   **File Parsing Core:** ExcelJS (Streamed, non-blocking asynchronous workbook interpreter).
*   **Visualizations:** Recharts Framework (Reactive client wrappers optimized for Tailwind CSS canvas environments).

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

**Next up:** Phase 3 — Step 3.1 (`src/app/page.tsx` server-side dashboard reading via the `prisma` singleton) and Step 3.2 (interactive components). The `Book`/`Author`/`Genre` tables contain the earlier import; clean the legacy summary rows and re-import before relying on dashboard totals.
