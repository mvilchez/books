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
- **Explore book metadata and tags:** The dashboard tag cloud aggregates genres and metadata across the library. Book details show each book's tags, publication year, page count, format, ISBN-13, and optional series name/position. Existing genre data is stored as library tags; only unambiguous e-book origins are tagged as e-books (other origin values are not assumed to mean physical format). On the first detail-page visit, the app makes one cached Open Library search and saves metadata only for a close title match and at least one close author match. Lookup errors remain retryable on a later visit, while a book with no accepted match is recorded to avoid repeating the same lookup on every visit. Plausible near matches are retained for review on **Possible Open Library matches**; use **Apply this match** after review to save the Open Library link, cover, available publication year, and subjects without replacing existing book details. Series details can be maintained in the book editor when online metadata does not provide them.
- **Browse book sagas:** Open **Book sagas** from the dashboard to group saved series, inspect their books by series position, start an existing wishlist entry, or enter and start the next book with saga details prefilled. Title and author fields suggest values already recorded for the saga. Goodreads search is linked for checking series order; the app does not scrape Goodreads or rely on an undocumented API.
- **Review and manually fill tag gaps:** Open **Open Library tag report** from the dashboard to see books with no saved Open Library tags. The report distinguishes books not checked yet from books checked without tag results. Download its CSV, fill the `manual_tags` column using semicolons between tags, then upload the CSV on the report page to update tags in a batch. You can also edit tags on an individual book detail page; the tag entry autocompletes existing subjects and prevents duplicate spellings after normalization. Open **Review similar tags** to review likely spelling/word-order duplicates and merge confirmed pairs; merging moves book links to the retained tag. The 20 most frequent tags appear in the dashboard cloud; selecting a tag opens the books carrying it. The dashboard autocomplete also searches tags and links to the same book list.
- **Discover books online:** Click **Find recommendations** on a book's detail page to search Open Library for more books by the same author. The on-demand search tries Spanish first and falls back to English when it finds no unread suggestions. Up to five results are shown, excluding completed titles and matching Open Library work IDs already in your library. Use **Start reading** on a suggestion to open the new-book form with its title and author prefilled, or **Add to library** to save it as pending without a start date.
- **Start a book:** Use **Start a book** on the dashboard or visit `/books/new`. You can type an ISBN-10/ISBN-13, scan the book's barcode with the camera, or upload a photo of the barcode; the app validates the ISBN, looks it up on Open Library, and prefills title, author, page count, publication year, and cover for review. Camera scanning needs HTTPS and browser camera permission; photo decoding runs locally in the browser. If no Open Library record exists, fill in the form manually. Then enter or adjust the start date and optionally total pages and genre. The start date determines the reading year, and the book is created with `READING` status; looked-up books are saved with their ISBN-13, an `isbn:` edition key (so re-imports and duplicates dedupe per edition), and the Open Library cover/work references.
- **Track an active read:** Use **+10 Pages** on an in-progress book to record reading progress. Progress is clamped between zero and the known total page count. Completed books are displayed as finished and cannot be incremented.
- **Import and update books:** Upload a `.xlsx` workbook from the dashboard. The importer reads `Leidos/Leídos` tabs, matches columns by header, ignores footer/summary rows, and imports valid rows in one transaction. Re-importing matching records updates them rather than creating duplicates; distinct reading years and editions remain separate. Invalid rows are reported and skipped.
- **Author statistics:** The `/stats` top-five author ranking expands to show each author's completed books, reading year, and rating; book titles link to their detail pages.
- **Complete a book:** Reading-book cards and list rows require a personal rating from 0 to 10 (in 0.1 increments) before marking a book completed; the action records today's finish date.
- **Resume reading:** The book editor's **Still reading** action sets status to `READING` and clears the finish date and rating.
- **Book status styling:** Cards and dashboard rows use distinct colors for read, reading, not-started, and wishlist books. The stats author-book list highlights completed titles.
- **Explore reading statistics:** The `/stats` page includes all-time yearly completion and page trends; year-filtered KPIs (books completed, pages read, averages, rating, and active reads) and monthly finish pace; rating and genre distributions; author rankings; top genres; and up to three wishlist suggestions from the two most-read genres when matching wishlist records exist.
- **Enrich Open Library metadata in batches:** `npm run enrich:open-library` is a dry run that lists unchecked books without contacting Open Library. Add `-- --execute` to perform sequential lookups and save accepted metadata/tags plus plausible unmatched candidates. Requests are separated by two seconds by default; optionally pass `-- --execute --limit=20 --delay-ms=3000` to process a smaller batch more slowly. Progress is saved book by book, so a failed run can be rerun and continues with unchecked books. Do not run multiple copies concurrently. Review unmatched suggestions at **Possible Open Library matches** on the dashboard. This operation makes one API search per unchecked book; it is opt-in and should be run in controlled batches.
- **In progress:** Dashboard sorting and global autocomplete are implemented. Open Library image lookup is available as an explicit, per-book action; there is no Goodreads scraping. See [Phase 6 in PLAN.md](PLAN.md#phase-6-library-discovery--author-profiles--in-progress).
- **Run tests:** `npm test` runs dashboard, search, ingestion, and Open Library response-validation tests.
- **Validate a workbook locally:** Run the ingestion parser against a workbook without connecting to the database (see [Ingestion Sandbox](#ingestion-sandbox-step-12)).
- **Clean imported data:** A CLI cleanup tool can identify known summary rows and certain duplicate reading entries. It defaults to a dry run; deletion requires the explicit `--execute` flag (see [Remove imported summary rows](#remove-imported-summary-rows)).

**Book management limits:** Wishlist suggestions are displayed when matching wishlist records exist, but the dashboard does not provide a dedicated wishlist-management view. Open Library metadata is incomplete and edition-dependent; missing fields stay blank rather than being inferred. The tag-gap CSV is a database report, not an API search. Similarity suggestions can be incorrect and should be reviewed before applying metadata. The cleanup command is for the specific summary/duplicate cases described below, not general-purpose deletion.

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

## Scripts

All scripts live under `scripts/` and most are also exposed as npm scripts.

### Database scripts

**`scripts/connect-skysql.sh`** — Open an interactive MariaDB client session to the
production SkySQL instance.

```bash
./scripts/connect-skysql.sh
# with an extra argument, e.g. select a database:
./scripts/connect-skysql.sh reading_tracker
```

Connects to `serverless-us-east1.sysp0000.db2.skysql.com:4014` as user
`dbpgf14648016`, verifies the server certificate, and prompts for the database
password. Requires the `mariadb` CLI client. This is a separate connection from
the app's Prisma `DATABASE_URL` and does not change the app's configuration.

**`scripts/backup-local.sh`** (npm: `backup:local`) — One-shot backup of the local
MariaDB database to `db/backups/` as a timestamped, gzipped SQL dump.

```bash
npm run backup:local
# or, with explicit credentials:
DATABASE_URL="mysql://book:password@127.0.0.1:3306/reading_tracker_local" \
  ./scripts/backup-local.sh
```

Writes `db/backups/reading_tracker_YYYYMMDD_HHMMSS.sql.gz` and keeps the newest
10 backups (override with `KEEP_COUNT`). Set `COMPRESS=0` to skip gzip. Read-only
for the source database; safe to run before schema changes or deploys.

**`scripts/backup-cloud-local.sh`** (npm: `backup:cloud-local`) — Dump a MariaDB
cloud instance (SkySQL / Aiven / any managed MariaDB) to a local SQL file under
`db/backups/`. Read-only for the cloud database; never writes to the source.

```bash
# Preferred: pass the full cloud URL (must start with mysql://)
CLOUD_DB_URL="mysql://USER:PASS@HOST:PORT/DB?sslaccept=strict" \
  npm run backup:cloud-local

# Or with individual variables (defaults match scripts/connect-skysql.sh):
CLOUD_DB_HOST=serverless-us-east1.sysp0000.db2.skysql.com \
CLOUD_DB_PORT=4014 CLOUD_DB_USER=dbpgf14648016 \
CLOUD_DB_NAME=reading_tracker CLOUD_DB_PASSWORD=... \
  npm run backup:cloud-local
```

Writes `db/backups/reading_tracker_cloud_YYYYMMDD_HHMMSS.sql.gz` and keeps the
newest 10 backups (override with `KEEP_COUNT`). Set `COMPRESS=0` to skip gzip.
The cloud password must be supplied via `CLOUD_DB_URL` or `CLOUD_DB_PASSWORD` —
it is never hard-coded in the script. Pair this with
`scripts/connect-skysql.sh` when you need an interactive cloud session instead
of a file backup.

**`scripts/backup-to-postgresql.sh`** (npm: `backup:postgresql`) — One-way migration
of the reading-tracker ledger from MariaDB (local or SkySQL) to PostgreSQL
(Neon DB, Aiven PostgreSQL, or any managed Postgres). See Phase 4, Step 4.4 in
[PLAN.md](PLAN.md#phase-4-cloud-engine-provisioning--production-pipelines).

```bash
MARIADB_URL="mysql://book:password@127.0.0.1:3306/reading_tracker_local" \
PG_DATABASE_URL="postgresql://user:pass@host.region.neon.tech/db?sslmode=require&pgbouncer=true&connection_limit=1" \
npm run backup:postgresql
```

1. Requires `prisma/schema.prisma` to use `provider = "postgresql"` (run
   `npx prisma generate` first).
2. Runs `prisma db push` against PostgreSQL to create the schema.
3. Dumps **data only** from MariaDB in foreign-key-safe order
   (Author → Genre → Tag → Book → BookTag → BookMetadataCandidate).
4. Normalizes the dump for PostgreSQL and loads it inside a single transaction.
5. Verifies per-table row counts on both databases.

Read-only for MariaDB (never writes to the source); the PostgreSQL target is
loaded into, so back it up before running.

Writes `db/backups/reading_tracker_cloud_YYYYMMDD_HHMMSS.sql.gz` and keeps the
newest 10 backups (override with `KEEP_COUNT`). Set `COMPRESS=0` to skip gzip.
The cloud password must be supplied via `CLOUD_DB_URL` or `CLOUD_DB_PASSWORD` —
it is never hard-coded in the script. Pair this with
`scripts/connect-skysql.sh` when you need an interactive cloud session instead
of a file backup.

### Restoring a backup into the local database

Backups under `db/backups/` are plain SQL dumps (gzipped). To restore one into
a local MariaDB database, pipe the dump through the `mariadb` client. The dumps
are produced with `--skip-add-drop-table` and without `CREATE DATABASE`/`USE`
statements, so the target database must exist and be **empty** — restore into a
fresh database, not on top of an existing one.

```bash
# 1. Create an empty target database (skip if it already exists and is empty)
mariadb --host=127.0.0.1 --port=3306 --user=book \
  -e "CREATE DATABASE IF NOT EXISTS reading_tracker_local;"

# 2. Load the dump into it (.sql.gz is piped straight through gunzip)
gunzip -c db/backups/reading_tracker_cloud_20261018_122349.sql.gz | \
  mariadb --host=127.0.0.1 --port=3306 --user=book reading_tracker_local
```

The client prompts for the password (never pass it on the command line). Both
local (`reading_tracker_*.sql.gz`) and cloud (`reading_tracker_cloud_*.sql.gz`)
dumps restore the same way — they share the same schema, so a cloud dump can
seed or replace the local database.

Because the dumps contain no `DROP TABLE` statements, restoring into a
non-empty database fails with "table already exists". In that case drop and
recreate the target first (this deletes its data):

```bash
mariadb --host=127.0.0.1 --port=3306 --user=book \
  -e "DROP DATABASE reading_tracker_local; CREATE DATABASE reading_tracker_local;"
```

Verify the restore by counting tables and rows:

```bash
mariadb --host=127.0.0.1 --port=3306 --user=book -e "
  SELECT COUNT(*) AS tables FROM information_schema.tables
    WHERE table_schema = 'reading_tracker_local';
  SELECT COUNT(*) AS books FROM reading_tracker_local.Book;"
```

After restoring, run `npx prisma migrate deploy` if the dump predates recent
schema migrations, then start the app with `npm run dev`.

### Switching databases

**`scripts/switch-db.sh`** (npm: `switch-db`) — Toggle the app's active
`DATABASE_URL` (in `.env`, the dev config) between a local database and a
remote database. `.env.production` is treated as a read-only registry that
holds both remote URLs and is never overwritten:

*   `DATABASE_URL` → MariaDB cloud (SkySQL / Aiven)
*   `POSTGRES_URL` → NeonDB (PostgreSQL)

```bash
# Local MariaDB (dev default)
npm run switch-db local

# MariaDB cloud (SkySQL / Aiven) — reads DATABASE_URL from .env.production
npm run switch-db cloud

# NeonDB (PostgreSQL) — reads POSTGRES_URL from .env.production
npm run switch-db neon

# Show current configuration
npm run switch-db status
```

You can also pass an explicit URL as the second argument to override:

```bash
npm run switch-db cloud  "mysql://user:pass@host:4014/db?sslaccept=strict"
npm run switch-db neon   "postgresql://user:pass@host.region.neon.tech/db?sslmode=require"
```

The script switches the Prisma provider in `prisma/schema.prisma` (`mysql` ↔
`postgresql`) in place and runs `npx prisma generate` automatically when moving
between MariaDB and PostgreSQL. The connection URL is read from `DATABASE_URL`
in the environment (`.env` for dev).

After switching, apply the schema to the target database:
- Local/dev: `npx prisma db push`
- Production/cloud: `npx prisma migrate deploy`

> **Provider switch and P3019:** `prisma/migrations/` is provider-specific —
> `migration_lock.toml` records the provider the migrations were created for
> (in this repo, `mysql`). If you switch to `postgresql` and run
> `npx prisma migrate deploy`, Prisma fails with error **P3019** (provider
> mismatch). To start fresh on PostgreSQL, remove the migration lock (and
> optionally the old MySQL migrations) and use `db push` instead:
>
> ```bash
> npm run switch-db neon
> rm prisma/migrations/migration_lock.toml
> rm -rf prisma/migrations/     # optional: remove old MySQL migrations
> npx prisma db push            # creates the schema in NeonDB
> ```
>
> `switch-db.sh` prints this warning automatically when it detects a provider
> mismatch with `migration_lock.toml`.

> `.env` and `.env.production` are gitignored — credentials never reach the
> repository. `.env.production` already holds `DATABASE_URL` (SkySQL MariaDB)
> and `POSTGRES_URL` (NeonDB); use `cloud` or `neon` to activate either
> without typing the full URL.

### Data scripts

**`npm run validate:ingestion`** — Parses the source workbook (`telemetry_sandbox/source.xlsx`
by default, or pass a path) and validates the ingestion layer with no database
required. See the [Ingestion Sandbox](#ingestion-sandbox-step-12) section.

**`npm run backfill:book-tags`** — Turns existing genres and known e-book origins
into database-backed tags. Run once after applying the schema.

**`npm run enrich:open-library`** — Fetches Open Library metadata for books.

**`npm run cleanup:books`** — Detects and (optionally) removes duplicate reading
entries and imported summary/footer rows. Run `npm run cleanup:books` for a
dry-run, or add `-- --execute` to actually delete. See the
[Remove imported summary rows](#remove-imported-summary-rows) section.

### Utility scripts

**`scripts/check-encapsulation.sh`** (npm: `check:encapsulation`) — Verifies
module encapsulation rules.

### npm script reference

| npm script | What it does |
|---|---|
| `dev` | Start Next.js dev server |
| `build` | Production build |
| `start` | Production server (`next start`, loads `.env.production`) |
| `lint` | Run ESLint |
| `test` | Run the unit test suite |
| `validate:ingestion` | Parse and validate the source workbook |
| `backfill:book-tags` | Backfill database tags from genres/origins |
| `enrich:open-library` | Enrich books with Open Library metadata |
| `cleanup:books` | Remove duplicate/summary rows (add `-- --execute` to delete) |
| `backup:local` | Dump local MariaDB to `db/backups/` |
| `backup:cloud-local` | Dump MariaDB cloud (SkySQL) to `db/backups/` |
| `switch-db` | Switch between local / cloud / NeonDB database |
| `backup:postgresql` | Migrate MariaDB data to PostgreSQL |
| `check:encapsulation` | Verify module encapsulation |

## Deployment

### Connect to the SkySQL MariaDB instance

Install the MariaDB command-line client, then run:

```bash
./scripts/connect-skysql.sh
```

The script connects to `serverless-us-east1.sysp0000.db2.skysql.com` on port
`4014` as user `dbpgf14648016`, verifies the server certificate, and prompts
for the database password. It accepts additional `mariadb` client arguments,
for example `./scripts/connect-skysql.sh reading_tracker`. Do not put the
password in the script or on the command line.

This command-line connection is separate from the app's Prisma
`DATABASE_URL`; it does not change the database configuration used by the app.

Production database and hosting are not configured yet. The deployment plan is
to use managed MariaDB and Render; see [Phase 4 in PLAN.md](PLAN.md#phase-4-cloud-engine-provisioning--production-pipelines).
