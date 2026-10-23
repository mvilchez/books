<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Books — LLM bootstrap (read this first)

## Read order
1. `AGENTS.md` (this file) — bootstrap and constraints.
2. `CONTEXT.md` — current implementation status and recent deltas.
3. Only the relevant module + its test (`src/lib/*.test.ts`, etc.).
4. `README.md` — only for setup, scripts, or deployment tasks.
5. `PLAN.md` — historical/spec reference; do not load it for routine code changes.

## Project status (from CONTEXT.md)
- Next.js 16 App Router app replacing a multi-year Excel reading tracker.
- Prisma 6 + MariaDB via the `mysql` provider; local MariaDB for dev.
- Phase 4 (cloud deployment) is planned but not executed.
- Phase 5 stretch goals remain open (origin donut, publication-era histogram, CSV export, analytics caching).
- Phase 6 features 6.1, 6.2, 6.3 are implemented.

## Stack
- Next.js 16.4, React 19, TypeScript strict
- Tailwind CSS 4
- Prisma 6 + MariaDB (`mysql` provider)
- ExcelJS, Recharts 3
- Unit tests via `npm test`

## Commands
- `npm run dev` — dev server
- `npm run build` / `npm run start` — production build/start
- `npm run lint` — ESLint
- `npm test` — unit tests
- `npm run validate:ingestion` — parse source workbook without DB
- `npm run check:encapsulation` — module encapsulation check
- `npm run switch-db <local|cloud|neon>` — switch database target

## Repo map
- `src/app` — pages, layouts, route handlers, server actions
- `src/components` — React components
- `src/lib` — domain logic, analytics, Prisma helpers, tests
- `src/lib/ingestion` — workbook parser
- `src/scripts` — CLI maintenance/enrichment scripts
- `prisma/schema.prisma` — database schema
- `scripts/` — shell helpers (backup, DB switching, encapsulation)
- `public/` — static assets

## Important gotchas
- MariaDB is accessed through Prisma's `mysql` provider; there is no `mariadb` provider.
- Reading year comes from the worksheet/tab name, not the `Año` column (that is publication year).
- Only tabs whose names start with `Leidos/Leídos` are read records.
- Avoid computing “today” during render to prevent hydration mismatches.
- Do not read `.next/`, `node_modules/`, DB dumps, or lockfiles for context.

## Working style for changes
- Prefer targeted reads and `search_codebase`/grep over loading whole docs.
- Read the relevant `src/lib/*.test.ts` before editing domain logic.
- Run `npm test` and `npm run lint` after changes.
- Update `CONTEXT.md` with a dated delta when behavior changes.
