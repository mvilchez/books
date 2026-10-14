This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Books — Reading Analytics Platform

A lightweight, high-performance web app / PWA that replaces a multi-year Excel
reading tracker, preserving the historical ledger while unlocking server-side
statistics and interactive dashboards.

- **Stack:** Next.js 16 (App Router, RSC, Server Actions) · TypeScript (strict) · Tailwind CSS 4 · Prisma + MariaDB (SkySQL prod / Docker dev, via the `mysql` provider) · ExcelJS · Recharts.
- **Source data:** a multi-tab `.xlsx` workbook (25 tabs). Only tabs named `Leidos/Leídos` are "read" records; the reading year comes from the tab name.

## Capabilities

- **Browse the reading ledger:** View books by reading year, navigate between years, and see each book's author, genre (when present), rating, reading status, and page progress. The pre-2008 "Leídos antes" records are grouped under 2007.
- **Track an active read:** Use **+10 Pages** on an in-progress book to record reading progress. Progress is clamped between zero and the known total page count. Completed books are displayed as finished and cannot be incremented.
- **Import and update books:** Upload a `.xlsx` workbook from the dashboard. The importer reads `Leidos/Leídos` tabs, matches columns by header, ignores footer/summary rows, and imports valid rows in one transaction. Re-importing matching records updates them rather than creating duplicates; distinct reading years and editions remain separate. Invalid rows are reported and skipped.
- **Explore reading statistics:** The `/stats` page includes all-time yearly completion and page trends; year-filtered KPIs (books completed, pages read, averages, rating, and active reads) and monthly finish pace; rating and genre distributions; author rankings; top genres; and up to three wishlist suggestions from the two most-read genres when matching wishlist records exist.
- **Validate a workbook locally:** Run the ingestion parser against a workbook without connecting to the database (see [Ingestion Sandbox](#ingestion-sandbox-step-12)).
- **Clean imported data:** A CLI cleanup tool can identify known summary rows and certain duplicate reading entries. It defaults to a dry run; deletion requires the explicit `--execute` flag (see [Remove imported summary rows](#remove-imported-summary-rows)).

**Book management limits:** There is no dashboard action to manually edit a book's metadata or delete an individual book. Matching workbook imports update imported fields; title, author, reading year, and edition identify a record, so changing those values does not edit the original record. The UI's direct edit action is limited to active reading progress. Wishlist suggestions are displayed when matching wishlist records exist, but the dashboard does not provide a way to manage them. The cleanup command is for the specific summary/duplicate cases described below, not general-purpose deletion.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
