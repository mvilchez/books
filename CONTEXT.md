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

**Status:** Phase 1 is **complete** — Step 1.1 (workspace bootstrap) and Step 1.2 (multi-tab ingestion sandbox CLI, `src/scripts/validate-ingestion.ts`) are done. The sandbox parses all 20 `Leidos/Leídos` tabs of the real workbook with **0 validation errors** (830 records, 447 authors). The system is now ready to execute the **relational data modeling layer** (Phase 2 / Step 2.1), which must be revised per the §3 schema notes above (multi-tab iteration, decimal 1–10 rating, `readingYear` from tab name vs `publicationYear` from the `Año` column).
