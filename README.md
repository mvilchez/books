This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Books — Reading Analytics Platform

A lightweight, high-performance web app / PWA that replaces a multi-year Excel
reading tracker, preserving the historical ledger while unlocking server-side
statistics and interactive dashboards.

- **Stack:** Next.js 16 (App Router, RSC, Server Actions) · TypeScript (strict) · Tailwind CSS 4 · Prisma + MariaDB (SkySQL prod / Docker dev, via the `mysql` provider) · ExcelJS · Recharts.
- **Source data:** a multi-tab `.xlsx` workbook (25 tabs). Only tabs named `Leidos/Leídos` are "read" records; the reading year comes from the tab name.

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
