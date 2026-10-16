## Books — Reading Analytics Platform

A lightweight web app that replaces a multi-year Excel
reading tracker, preserving the historical ledger while unlocking server-side
statistics and interactive dashboards.

- **Stack:** Next.js 16 (App Router, React Server Components, Server Actions) · TypeScript (strict) · Tailwind CSS 4 · Prisma 6 + MariaDB (via the `mysql` provider) · ExcelJS · Recharts 3.
- **Source data:** a multi-tab `.xlsx` workbook (25 tabs). Only tabs named `Leidos/Leídos` are "read" records; the reading year comes from the tab name.

## Capabilities

- **Browse the reading ledger:** Select a reading year and switch between the default card view and a table list. Choose reading start date, author, or title sorting in either view, with ascending or descending direction. Cards default to start-date descending; the list defaults to ascending, with undated books last. Sorting and view selections stay in the URL. Cards and list rows include available reading dates, genre, rating, publication year, origin, and page information.
- **Search the library:** Use the dashboard autocomplete to find books by title or author across all reading years. Search is debounced, accepts 2–100 characters, and shows up to eight results with keyboard navigation and clear loading/error/no-match states.
- **Find book covers and author photos:** On a book's detail page, use **Find book cover** or **Find author photo** to search Open Library on demand. Author lookup checks up to ten matching author records for actual photo IDs, prioritizes exact name matches, and displays image previews before saving. Explicitly choose **Use this cover/photo** to save a selection. Search responses are cached for one day; images load directly and lazily from Open Library. Saved cover IDs and source records are shared across cards, list rows, and details. Missing or failed images keep the existing title/initials fallback. Open Library image availability does not establish a blanket reuse license; verify selections and link back to the source record.
- **See yearly reading stats:** The dashboard shows books completed, pages read, active reads, average rating, and average pages per book for the selected year.
- **Inspect, edit, and delete a book:** Open a book from a card or list row. The detail page lets you edit its title, author, status, rating (0–10), reading year, publication year, total/current pages, start/finish dates, genre, origin, and edition key. Delete books from the detail page or dashboard cards/list after confirming.
- **Explore book metadata and tags:** The dashboard tag cloud aggregates genres and metadata across the library. Book details show each book's tags, publication year, page count, format, ISBN-13, and optional series name/position. Existing genre data is stored as library tags; only unambiguous e-book origins are tagged as e-books (other origin values are not assumed to mean physical format). On the first detail-page visit, the app makes one cached Open Library search and saves metadata only for a close title match and at least one close author match. Lookup errors remain retryable on a later visit, while a book with no matching metadata is recorded to avoid repeating the same lookup on every visit. Series details can be maintained in the book editor when online metadata does not provide them.
- **Review and manually fill tag gaps:** Open **Open Library tag report** from the dashboard to see books with no saved Open Library tags. The report distinguishes books not checked yet from books checked without tag results; it does not perform a bulk API lookup. Download its CSV, fill the `manual_tags` column using semicolons between tags, then upload the CSV on the report page to update tags in a batch. You can also edit tags on an individual book detail page; the tag entry autocompletes existing subjects and prevents duplicate spellings after normalization. Open **Review similar tags** to review likely spelling/word-order duplicates and merge confirmed pairs; merging moves book links to the retained tag. The 20 most frequent tags appear in the dashboard cloud; selecting a tag opens the books carrying it. The dashboard autocomplete also searches tags and links to the same book list.
- **Discover books online:** Click **Find recommendations** on a book's detail page to search Open Library for more books by the same author. The on-demand search tries Spanish first and falls back to English when it finds no unread suggestions. Up to five results are shown, excluding completed titles and matching Open Library work IDs already in your library. Use **Start reading** on a suggestion to open the new-book form with its title and author prefilled, or **Add to library** to save it as pending without a start date.
- **Start a book:** Use **Start a book** on the dashboard or visit `/books/new`. Enter its title, author, start date, and optionally total pages and genre. The start date determines the reading year, and the book is created with `READING` status.
- **Track an active read:** Use **+10 Pages** on an in-progress book to record reading progress. Progress is clamped between zero and the known total page count. Completed books are displayed as finished and cannot be incremented.
- **Import and update books:** Upload a `.xlsx` workbook from the dashboard. The importer reads `Leidos/Leídos` tabs, matches columns by header, ignores footer/summary rows, and imports valid rows in one transaction. Re-importing matching records updates them rather than creating duplicates; distinct reading years and editions remain separate. Invalid rows are reported and skipped.
- **Author statistics:** The `/stats` top-five author ranking expands to show each author's completed books, reading year, and rating; book titles link to their detail pages.
- **Complete a book:** Reading-book cards and list rows require a personal rating from 0 to 10 (in 0.1 increments) before marking a book completed; the action records today's finish date.
- **Resume reading:** The book editor's **Still reading** action sets status to `READING` and clears the finish date and rating.
- **Book status styling:** Cards and dashboard rows use distinct colors for read, reading, not-started, and wishlist books. The stats author-book list highlights completed titles.
- **Explore reading statistics:** The `/stats` page includes all-time yearly completion and page trends; year-filtered KPIs (books completed, pages read, averages, rating, and active reads) and monthly finish pace; rating and genre distributions; author rankings; top genres; and up to three wishlist suggestions from the two most-read genres when matching wishlist records exist.
- **In progress:** Dashboard sorting and global autocomplete are implemented. Open Library image lookup is available as an explicit, per-book action; there is no bulk backfill or Goodreads scraping. See [Phase 6 in PLAN.md](PLAN.md#phase-6-library-discovery--author-profiles--in-progress).
- **Run tests:** `npm test` runs dashboard, search, ingestion, and Open Library response-validation tests.
- **Validate a workbook locally:** Run the ingestion parser against a workbook without connecting to the database (see [Ingestion Sandbox](#ingestion-sandbox-step-12)).
- **Clean imported data:** A CLI cleanup tool can identify known summary rows and certain duplicate reading entries. It defaults to a dry run; deletion requires the explicit `--execute` flag (see [Remove imported summary rows](#remove-imported-summary-rows)).

**Book management limits:** Wishlist suggestions are displayed when matching wishlist records exist, but the dashboard does not provide a dedicated wishlist-management view. Open Library metadata is incomplete and edition-dependent; missing fields stay blank rather than being inferred. The tag-gap CSV is a database report, not a bulk Open Library search. The cleanup command is for the specific summary/duplicate cases described below, not general-purpose deletion.

## Getting Started

First, run the development server:

```bash
npm install
npx prisma generate
npx prisma db push
npm run backfill:book-tags
npm run dev
```

Configure `DATABASE_URL` in `.env` for a MariaDB database before running Prisma
or the app. `db push` synchronizes the Prisma schema with the configured
development database; do not point it at production. Run the tag backfill once
after applying the schema to turn existing genres and known e-book origins into
database-backed tags. New books, edits, and workbook imports maintain these tags.

Open [http://localhost:3000](http://localhost:3000) after `npm run dev`.
Dashboard source is in `src/app/page.tsx`; book creation, details, and statistics
are in `src/app/books/` and `src/app/stats/`.

## Ingestion Sandbox (Step 1.2)

A decoupled, browser-free CLI that parses the source workbook and validates the
ingestion layer against the real schema — **no database required**. It iterates
every `Leidos/Leídos` tab, matches columns by header name, coerces ExcelJS cell
types defensively (dates, rich-text, formulas), and skips footer/summary rows.

```bash
# Parse the default workbook at telemetry_sandbox/source.xlsx
npm run validate:ingestion

# Or point it at a specific .xlsx file
npm run validate:ingestion -- /path/to/your.xlsx
```

Requirements / notes:
- The workbook must be a genuine OOXML **`.xlsx`** (a ZIP starting with `PK\x03\x04`). Legacy `.xls` files are **not** supported by ExcelJS — re-save as `.xlsx`.
- Runs on Node via [`tsx`](https://github.com/privatenumber/tsx) (esbuild-based TypeScript runner).
- Exits non-zero on fatal errors (missing/invalid file) or when no records parse.

## Remove imported summary rows

The importer skips named footer labels and aggregate count rows. The cleanup
script also detects duplicate reading entries by normalized title, author,
reading year, and edition fingerprint. It keeps the oldest row in each duplicate
group, so rereads in other years and editions with different fingerprints are
preserved. The spreadsheet has no ISBN/edition column today; the fingerprint
uses ISBN/edition columns if present, otherwise publication year and page count.
Rows lacking edition metadata are not deleted as duplicates. Without an ISBN or
edition identifier, two editions with the same publication year and page count
cannot be distinguished from this workbook alone.

Before running the importer or cleanup script on an existing database, apply the
schema change for the edition fingerprint:

```bash
npx prisma db push
```

To inspect the records that would be deleted, run the cleanup in dry-run mode:

```bash
npm run cleanup:books
```

It targets known footer labels, numeric aggregate rows, and exact same-year
edition matches. Nothing is deleted unless explicitly requested:

```bash
npm run cleanup:books -- --execute
```

## Deployment

Production database and hosting are not configured yet. The deployment plan is
to use managed MariaDB and Render; see [Phase 4 in PLAN.md](PLAN.md#phase-4-cloud-engine-provisioning--production-pipelines).
