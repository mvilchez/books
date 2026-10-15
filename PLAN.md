# Enterprise Engineering Specification & Implementation Plan: Books Application

**Project Identity:** `books`  
**Author / Role:** Senior Software Engineer & Team Lead  
**Target Architecture:** Full-Stack Serverless Platform  
**Target Environment:** Linux Local Engine / Production Cloud Native  

---

## 🏗️ Technical Stack & Architectural Foundations
*   **Application Framework:** Next.js 16.4 (App Router Architecture, React Server Components, Server Actions).
*   **Language Ecosystem:** TypeScript 5.x (Strict Mode enabled).
*   **Styling Engine:** Tailwind CSS 4.x / Component Isolation.
*   **Data Access Layer:** Prisma ORM (stable **v6**, type-safe query builder; `PrismaClient`). MariaDB is driven by Prisma's `mysql` provider.
*   **Production Database:** Managed Cloud **MariaDB** via **SkySQL** (MariaDB's official cloud service; free/dev tiers available). Local development uses the workstation's local **MariaDB** service (`127.0.0.1:3306`). Prisma targets MariaDB through its `mysql` provider (there is no "mariadb" provider).
*   **Data Ingestion Engine:** ExcelJS (Streamed workbook parsing).
*   **Visualization Engine:** Recharts v3 (React 19 compatible) — client-side charting used exclusively by the statistics view (Phase 5).
*   **Deployment Infrastructure:** Render Web Services (Free Tier PaaS instance).
*   **Client Distribution:** PWA with Service Workers is a future target; no service worker or installable-PWA setup is currently implemented.

---

## 📊 Core Spreadsheet Schema Definition
The ingestion module and core relational schemas are mapped tightly against your exact local spreadsheet blueprint:
*   **titulo:** Main string representation of the literary piece.
*   **autor:** Unique relational constraint matching the author entity.
*   **numero de paginas:** Integer value defining total physical target pages.
*   **nota personal:** Rating, **decimal 1–10** (e.g. `8.5`) from `Puntuación (del 1 al 10)`, or null when unrated. (Revised after Step 1.2 — the old blueprint assumed a 1–5 integer scale.)
*   **año (tab):** the **reading** year, derived from the sheet/tab name (`Leídos 2013` → `2013`); `Leidos antes` has none. The optional `Año` **column** (2014+ tabs) is the book's original **publication** year — a separate field.

---

## 🛠️ Phase-by-Phase Execution Blueprint

### PHASE 1: Monorepo Setup, Strict Configuration & Ingestion Proof of Concept
**Objective:** Establish a production-grade codebase boilerplate and engineer an isolated command-line utility to guarantee the system can parse the source `.xlsx` schema with zero telemetry failures.

```
[Development Workspace] ──> [Local File System (*.xlsx)] ──> [ExcelJS Engine] ──> [Stdout Validation Log]
```

#### Step 1.1: Standardized Workspace Provisioning
1. Launch your Linux terminal and scaffold the project using the enterprise-recommended flags. This creates a clean directory layout isolating your source code inside the `src/` directory and explicitly enabling the new Next.js App Router:
   ```bash
   npx create-next-app@latest books --typescript --tailwind --eslint --src-dir --app --import-alias "@/*"
   cd books
   ```
2. Inject `exceljs` into your runtime dependencies. This library allows us to access the worksheet rows lazily without locking the file descriptors:
   ```bash
   npm install exceljs
   ```
3. Initialize the Git repository. Implement strict configuration parameters immediately by verifying your global `.gitignore` prevents tracking local development variable files (`.env`, `.env.local`, `.tsx-cache`):
   ```bash
   git init
   git add .
   git commit -m "chore: initial bootstrap of Next.js full-stack container with strict TypeScript compilation metrics"
   git branch -M main
   git remote add origin <YOUR_GITHUB_PRIVATE_REPOSITORY_SSH_URL>
   git push -u origin main
   ```
4. Open your `tsconfig.json` file and verify that `strict` validation configurations are explicitly configured to enforce data integrity:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true
     }
   }
   ```

#### Step 1.2: Designing the Ingestion Sandbox (CLI Engine) — ✅ DONE
1. Place a sample copy of your existing tracking spreadsheet inside a temporary folder at the root: `mkdir telemetry_sandbox && cp <your-file> ./telemetry_sandbox/source.xlsx`.
   > **Note:** the file must be a genuine OOXML **`.xlsx`** (a ZIP starting with `PK\x03\x04`). Legacy `.xls`/OLE2 files are **not** supported by ExcelJS and will fail with *"Can't find end of central directory"* — re-save as `.xlsx` first.
2. Draft a decoupled script `src/scripts/validate-ingestion.ts`. It bypasses the browser and runs as a raw Node process via **`tsx`** (esbuild-based runner; `ts-node` does not cleanly support this project's `moduleResolution: "bundler"` + ESM on Node 18). Invoke with `npm run validate:ingestion [optionalPath]`.
3. **MULTI-TAB, header-name-driven parsing** (implemented). Key design decisions:
   *   Iterate **all** worksheets via `workbook.worksheets`. Treat a tab as a "read books" sheet when its **name** starts with `Leidos/Leídos`; skip non-read tabs (`Pendientes`, `Descartados`, `kindle`, `Proxima Visita`, `Gráficos`).
   *   Derive the **reading year from the tab name** (`Leídos 2013` → `2013`); the optional `Año` column is the book's **publication** year (distinct field).
   *   Match columns **by header name** (diacritic/case/space-insensitive), never by fixed index, because column sets vary per tab and `Autor` appears **twice** on some tabs.
   *   Defensive cell coercion for ExcelJS's `CellValue` union: `Date` → ISO date, **rich-text** → concatenated runs, **formula** → `.result`, `#N/A`/errors → text, null → empty.
   *   Ratings are **decimal 0–10** (`Puntuación (del 1 al 10)`); `-`/`0`/blank = unrated. Pages (`Paginas`) may be legitimately **null** for pre-2014 rows.
   *   **Skip footer/summary rows** at the bottom of each tab (`Libros Leídos`, `Estadísticas`, page-count labels, and aggregate formulas shifted into the title/author columns) — they are not books.
   *   Safe cell accessor avoids ExcelJS's *"column 0 out of bounds"* throw on sheets lacking an optional column.
   ```typescript
   worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
     if (rowNumber === 1) return; // skip header
     const titulo = colText(row, headerMap, "titulo");      // by header name
     const paginas = /* number | null */;
     const puntuacion = cellToRating(/* decimal 0–10, null if unrated */);
     if (isFooter(titulo)) { result.footerRows++; return; }  // skip stats rows
     // ...validate + collect...
   });
   ```
4. **Validation result (real workbook, 25 tabs):** 20 read tabs parsed, **812 records, 0 validation errors**, 430 unique authors, 356 footer rows skipped, 5 non-read tabs skipped. The stricter footer filter excludes numeric aggregate rows that had been counted as books.

---

### PHASE 2: Relational Data Modeling & Seed Automation Pipeline
**Objective:** Design a normalization schema to transform flat spreadsheet columns into a relational database, and build an idempotent transactional migration API route.

```
[Web UI File Upload] ──> [/api/v1/import] ──> [Prisma ORM (PrismaClient, $transaction)] ──> [MariaDB Transaction Engine]
```

#### Step 2.1: Relational Schema Design — Prisma ORM (stable v6) + MariaDB — ✅ DONE

> **Toolchain decision (stable Prisma + local MariaDB).** This workspace uses **stable Prisma v6** (`prisma@6.19.3`, `@prisma/client@6.19.3`) targeting the local **MariaDB** service through Prisma's `mysql` provider — the classic `prisma init` → `prisma/schema.prisma` → `prisma generate` → `prisma db push` flow. (An earlier attempt used the Prisma 8 RC "Prisma Next" toolchain, but that RC ships **only** a PostgreSQL target — no MySQL/MariaDB — so it was reverted in favour of stable Prisma on MariaDB, per the requirement to use a local Linux MariaDB.)
>
> **Terminology.** The schema is a single `prisma/schema.prisma`. `prisma generate` builds the typed `PrismaClient`; queries go through `new PrismaClient()` imported from `@prisma/client`.

1. Install the stable Prisma CLI (dev) and client (app), plus `dotenv`:
   ```bash
   npm install -D prisma@6            # CLI
   npm install @prisma/client@6 dotenv
   ```
   > Versions in use here: `prisma@6.19.3` and `@prisma/client@6.19.3` (keep the CLI and client on the same version).
2. Initialize Prisma. This creates `prisma/schema.prisma` and reads `DATABASE_URL` from `.env`:
   ```bash
   npx prisma init
   ```
   `prisma init` writes a starter `prisma/schema.prisma` (with a `datasource db` block) and a `.env` containing `DATABASE_URL`. Point the datasource at **`mysql`** and the local MariaDB (see Step 2.2 §3 for the exact URL).
3. Refactor the generated `prisma/schema.prisma` file to map our entity relationships cleanly. We build a one-to-many relationship (`Author` -> `Book`) to avoid duplicating author names across rows, and hook up a `Genre` table to satisfy analytics tracking:
   > **Revised after Step 1.2** to match the real multi-tab source: `rating` is a **decimal 1–10** (`Float?`, from `Puntuación (del 1 al 10)`); `totalPages` is **nullable** (pre-2014 rows lack page counts); `readingYear` comes from the **tab name** while `publicationYear` comes from the `Año` **column**; and `origen`/`fechaInicio`/`fechaFin` are captured too.
   ```prisma
   datasource db {
     provider = "mysql"   // MariaDB uses Prisma's "mysql" provider (there is no "mariadb" provider)
     url      = env("DATABASE_URL")
   }

   generator client {
     provider = "prisma-client-js"
   }

   enum ReadingStatus {
     PENDING
     READING
     COMPLETED
     WISH_LIST
   }

   model Book {
     id             String         @id @default(uuid())
     title          String
     totalPages     Int?           @map("numero_de_paginas")   // nullable: historical gaps
     currentPages   Int            @default(0)
     status         ReadingStatus  @default(PENDING)
     rating         Float?         @map("nota_personal")      // decimal 1–10
     readingYear    Int            @map("ano")                // from the TAB NAME
     publicationYear Int?          @map("ano_publicacion")    // from the "Año" COLUMN
     editionKey     String         @default("") @map("edition_key")
     origin         String?        @map("origen")
     startDate      DateTime?      @map("fecha_inicio")
     finishDate     DateTime?      @map("fecha_fin")
     authorId       String
     author         Author         @relation(fields: [authorId], references: [id], onDelete: Cascade)
     genreId        String?
     genre          Genre?         @relation(fields: [genreId], references: [id], onDelete: SetNull)
     createdAt      DateTime       @default(now())
     updatedAt      DateTime       @updatedAt

     @@unique([title, authorId, readingYear, editionKey])
   }

   model Author {
     id        String   @id @default(uuid())
     name      String   @unique
     books     Book[]
     createdAt DateTime @default(now())
   }

   model Genre {
     id        String   @id @default(uuid())
     name      String   @unique
     books     Book[]
     createdAt DateTime @default(now())
   }
   ```
   > **Idempotency and repeated-book note:** a row represents one reading event. The unique key includes reading year so rereads in other years remain separate, and `editionKey` so different editions read in the same year remain separate. The key uses ISBN/edition fields when present; otherwise the source's publication year and page count form a best-effort edition fingerprint.
   >
   > **MariaDB compatibility (moved off Supabase/PostgreSQL):** MariaDB is driven by Prisma's `mysql` provider, so the schema is unchanged apart from `provider`. Everything the model relies on is fully supported on MariaDB — `enum`, `@default(uuid())` (a Prisma-level default that makes the column `VARCHAR(191)`), `onDelete: Cascade` / `SetNull`, and the composite `@@unique(...)`. Nothing PostgreSQL-specific is used: no `?schema=public`, no `pgbouncer`, no arrays, no `dbgenerated`/extension functions.
4. Validate the schema and generate the typed `PrismaClient`:
   ```bash
   npx prisma validate        # static check of the PSL
   npx prisma generate        # emits PrismaClient into node_modules/.prisma/client (run after every schema edit)
   ```
   There is **no `prisma.config.ts`** on stable Prisma v6 — connection and the schema path are read straight from the `datasource` block in `schema.prisma` + `DATABASE_URL` in `.env`.

#### Step 2.2: Infrastructure Scaffolding (Local MariaDB Engine)
1. **Local MariaDB is already running** on this Linux workstation (system service `mariadb`, active; listening on `127.0.0.1:3306`, socket `/run/mysqld/mysqld.sock`). No container is required. If you prefer an isolated Docker engine instead, this is the equivalent compose file:
   ```yaml
   version: '3.8'
   services:
     mariadb_dev:
       image: mariadb:11-alpine
       container_name: books_db
       environment:
         MARIADB_USER: book
         MARIADB_PASSWORD: password
         MARIADB_DATABASE: reading_tracker_local
         MARIADB_RANDOM_ROOT_PASSWORD: 'yes'   # never bake a fixed root password
       ports:
         - "3306:3306"
       volumes:
         - mariadb_data:/var/lib/mysql
       healthcheck:                            # wait until the engine accepts connections
         test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
         interval: 5s
         timeout: 3s
         retries: 20

   volumes:
     mariadb_data:
   ```
   > **Note:** the official MariaDB image uses the `MARIADB_*` environment variables (not `POSTGRES_*`), listens on port **3306** (not 5432), and stores its data in `/var/lib/mysql` (not `/var/lib/postgresql/data`).
2. Verify connectivity (using the `book` app user that owns the schema; the socket-root account is locked down here):
   ```bash
   mysql -u book -p -h 127.0.0.1 -e "SELECT VERSION(); SHOW DATABASES;"
   ```
3. Configure your local runtime parameters inside the `.env` file (copy `.env.example` → `.env`; `.env` is gitignored):
   ```env
   DATABASE_URL="mysql://book:password@127.0.0.1:3306/reading_tracker_local"
   ```
   > **Note:** MariaDB/MySQL connection strings start with `mysql://` and drop the PostgreSQL-only `?schema=public` suffix.
4. Push your schema layout onto the local MariaDB instance. On stable Prisma this is **`npx prisma db push`** (it syncs the schema to the DB and runs `prisma generate`):
   ```bash
   npx prisma db push          # creates the Author/Book/Genre tables + emits PrismaClient
   # npx prisma db push --skip-generate   # schema sync only
   ```
   > `db push` reads `DATABASE_URL` from the `datasource` block in `prisma/schema.prisma` (value loaded from `.env`). It is the right tool for the dev loop on MariaDB. (If you later adopt versioned migrations, swap to `npx prisma migrate dev --name <slug>` so each change is recorded under `prisma/migrations/`.)

#### Step 2.3: Building the Transactional Bulk Ingestion Route — ✅ DONE
1. Built the Next.js Route Handler at `src/app/api/v1/import/route.ts`. It captures `multipart/form-data` (field `file`), parses the workbook with ExcelJS, and writes every row inside **one** Prisma interactive transaction, using an upsert strategy so books attach to existing authors without key-constraint violations.
   ```typescript
   export const runtime /* not set: Node.js default (Edge is deprecated) */;
   export async function POST(request: Request) {
     const data = await request.formData();          // no bodyParser needed
     const file = data.get('file') as File | null;
     if (!file) return NextResponse.json({ error: 'Payload missing file entity' }, { status: 400 });
     const workbook = await parseWorkbookBuffer(Buffer.from(await file.arrayBuffer()));
     await prisma.$transaction(async (tx) => { /* authors → genres → books */ },
       { timeout: 120_000, maxWait: 15_000 });
   }
   ```
2. **Shared parser (no duplicated logic).** Per the plan's own instruction to *"reuse the helpers proven in `src/scripts/validate-ingestion.ts`"*, those helpers were **extracted** into `src/lib/ingestion/workbook-parser.ts` (`normalize`, `cellToText`, `cellToInt`, `cellToRating`, `cellToDate`, `buildHeaderMap`, `isReadSheet`, `yearFromSheetName`, `colText`, `cellValueAt`, `isFooterTitle`, `isNumericAggregatePair`, `editionKeyFromMetadata`, `editionKeyFromExtras`, `parseSheet`, `parseWorkbook`, `parseWorkbookBuffer`). Both the CLI sandbox and the API import through it, so the parsing contract cannot drift.
3. **Writes in dependency order, one write per distinct entity:**
   * `Author` — upserted once per **unique** name (`@@unique([name])`), then the id is reused from a `Map`.
   * `Genre` — upserted once per unique `Tipo` value; rows with no `Tipo` keep `genreId = null`.
   * `Book` — upserted on `title + authorId + readingYear + editionKey`; this keeps re-imports idempotent while retaining rereads and editions.
4. **All modelled fields are now populated** (not just title/author/pages): `totalPages`, `rating`, `publicationYear`, `origin`, `startDate`, `finishDate`, `genreId`, and a status derived from `finishDate` (`COMPLETED` only when the finish date exists; otherwise `READING`). Dates are normalised to UTC midnight, since MariaDB `DATETIME` stores no timezone. Re-import the workbook to update rows already in the database.
5. **`readingYear` backfill decision (the open question in §2.3):** `Leidos antes` has no year in its tab name, so it is persisted under the documented sentinel **`PRE_TAB_READING_YEAR_SENTINEL = 2007`** (`src/lib/ingestion/workbook-parser.ts`) — the last year before the first yearly tab (2008) — instead of being silently dropped. The response reports `backfilledReadingYear` so the substitution is always visible.
6. **Error contract:** `400` for a missing/empty/oversized/non-`.xlsx` payload or an unparseable workbook (with the actionable *"re-save as .xlsx"* message); `500` **only** for a genuine persistence failure, reported as `Import failed and was rolled back: …`; `405` for non-POST verbs (Next's automatic `OPTIONS`/`Allow` handling).
7. **Existing database cleanup:** use `npx prisma db push` to apply the `editionKey` schema before running the importer/cleanup script on an existing database. The importer migrates old rows to their edition fingerprints during re-import. `npm run cleanup:books` previews footer/aggregate rows and same-year duplicate editions; `npm run cleanup:books -- --execute` removes only those rows, keeping the oldest row in each duplicate group.

> The workbook currently has no ISBN/edition column, so page count + publication year are only a best-effort edition fingerprint. Distinct editions with identical values in those fields cannot be distinguished from this source; the cleanup script avoids deleting rows without any edition metadata.

   > Prisma transaction timeouts are raised to `timeout: 120_000` / `maxWait: 15_000` because ~812 rows issue over 1,200 round-trips, far beyond the 5s default.

**Historical database validation (before the footer fix; the DB was not changed by the parser fix):**
| Check | Result |
|---|---|
| First import (empty DB) | `200`, `processed 830`, `created 830`, `updated 0`, 443 authors, 25 genres |
| Re-import (idempotency) | `200`, `processed 830`, `created 0`, `updated 830`; DB stayed **830 / 443 / 25** — no duplicates |
| DB field parity vs CLI baseline | 807 rows with pages, 157 unrated, avg **7.20**, **327 490** pages, 23 null pages, 1 sentinel row |
| Atomicity | A deliberate mid-transaction throw rolled back **all** writes (830 → 830, 0 orphan authors) |
| Current CLI parsing | `npm run validate:ingestion` reports **25 tabs / 20 read / 5 skipped, 812 books, 0 errors, 430 authors, 356 footer/aggregate rows** |
| `npx tsc --noEmit` / `eslint` | Clean for every new/changed file |
| `next build` | `BUILD_EXIT=0`; `/api/v1/import` emitted as `ƒ (Dynamic)` |

> The historical database counts above predate the footer fix and may include summary rows. Run `npm run cleanup:books` to review them, then add `-- --execute` to remove them before re-importing. `Author.name` / `Genre.name` use MariaDB's default `utf8mb4_unicode_ci`, which folds accents and case; the route reports both `total` (distinct names seen) and `created` (rows actually inserted). Use an explicit `_bin`/`_as_cs` collation if exact byte-level names are ever required.
>
> **ExcelJS typing note.** `exceljs@4.4.0` ships an incorrect `.d.ts` (`declare interface Buffer extends ArrayBuffer`), which shadows Node's real `Buffer` and makes `workbook.xlsx.load(buffer)` fail to type-check. `parseWorkbookBuffer` normalises any `Buffer | Uint8Array | ArrayBuffer` into a Node `Buffer` (preserving `byteOffset`/`byteLength`) and applies one documented `as unknown as ArrayBuffer` cast. At runtime JSZip accepts a Node `Buffer`.

**Also done:** added the `tsx` devDependency and the `validate:ingestion` npm script (`tsx --tsconfig tsconfig.json src/scripts/validate-ingestion.ts`) that Step 1.2 documented but `package.json` never declared.

<details>
<summary>Superseded pre-implementation sketch (kept for traceability)</summary>

```typescript
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Payload missing file entity' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    // MULTI-TAB (revised after Step 1.2): iterate only "read" tabs (name starts with
    // Leidos/Leidos), derive readingYear from the tab name, match columns by header
    // name, and skip footer/summary rows. Reuse the helpers proven in
    // src/scripts/validate-ingestion.ts instead of fixed column indices.
    const isReadTab = (name: string) => /^leidos/i.test(normalize(name));
    const readTabs = workbook.worksheets.filter((ws) => isReadTab(ws.name));

    let recordsIngested = 0;

    await prisma.$transaction(async (tx) => {
      for (const worksheet of readTabs) {
        const readingYear = Number(worksheet.name.match(/(\d{4})/)?.[1]);
        const headerMap = buildHeaderMap(worksheet.getRow(1)); // name -> column index(es)

        for (let i = 2; i <= worksheet.rowCount; i++) {
          const row = worksheet.getRow(i);
          const title = colText(row, headerMap, "titulo");
          if (!title || isFooter(title)) continue; // skip blank + stats rows

          const authorName = colText(row, headerMap, "autor");
          const totalPages = cellToIntNullable(row, headerMap, "paginas"); // may be null
          const rating = cellToRating(row, headerMap, "puntuacion (del 1 al 10)"); // decimal 0-10 | null
          const publicationYear = cellToIntNullable(row, headerMap, "ano");
          const editionKey = editionKeyFromMetadata(publicationYear, totalPages);
          const status = "COMPLETED";

          if (!readingYear) continue; // "Leidos antes" has no year -> skip or default

          const author = await tx.author.upsert({
            where: { name: authorName },
            update: {},
            create: { name: authorName },
          });

          await tx.book.upsert({
            where: {
              title_authorId_readingYear_editionKey: {
                title,
                authorId: author.id,
                readingYear,
                editionKey,
              },
            },
            update: { totalPages, rating, publicationYear, editionKey, status },
            create: { title, totalPages, rating, publicationYear, editionKey, readingYear, status, authorId: author.id },
          });

          recordsIngested++;
        }
      }
    });

    return NextResponse.json({ success: true, processed: recordsIngested }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

> **Reading year nuance:** `Leidos antes` has no year in its tab name, so `readingYear` is `NaN`. Because `readingYear` is `NOT NULL` and part of the composite unique key, decide explicitly how to backfill it (e.g. a sentinel like `2007`, or a dedicated pre-2008 tab) rather than skipping silently. On MariaDB the unique index that backs the composite key is limited to 191 chars per indexed `VARCHAR`; the `title`, `authorId`, and `editionKey` fields are sized to fit the target InnoDB index limit.
>
> **Resolved** by point 5 above: the `2007` sentinel was chosen, and the shared parser now returns `readingYear: null` for that tab so the decision lives in exactly one place.

</details>

---

### PHASE 3: Reactive Dashboard UI & Core Data Operations (CRUD) — ✅ IMPLEMENTED
**Objective:** Architect a fully responsive dashboard using Server Components for rapid initial rendering, paired with Server Actions to manage real-time updates smoothly.

#### Step 3.1: Building the Server-Side Data View
1. Refactor `src/app/page.tsx` to handle data retrieval directly on the server. This setup drastically reduces network roundtrips by loading data before the page reaches the client browser:
   ```typescript
   import Link from 'next/link';
   import { prisma } from '@/lib/prisma';   // Step 2.3 singleton — never `new PrismaClient()` in app code
   import BookCard from '@/components/BookCard';
   import IngestionWidget from '@/components/IngestionWidget';

   export default async function DashboardPage() {
     const books = await prisma.book.findMany({
       include: { author: true },
       orderBy: { updatedAt: 'desc' }
     });

     return (
       <main className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
         <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 border-b border-slate-800 pb-6">
           <div>
             <h1 className="text-3xl font-extrabold tracking-tight text-white">Books Tracker Workspace</h1>
             <p className="text-slate-400 mt-1">Replacing legacy spreadsheets with clean engineering metrics.</p>
           </div>
           <div className="flex items-center gap-3">
             <Link
               href="/stats"
               className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
             >
               Statistics &amp; graphs
             </Link>
             <IngestionWidget />
           </div>
         </header>

         <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
           {books.map((book) => (
             <BookCard key={book.id} book={book} />
           ))}
         </section>
       </main>
     );
   }
   ```
   **Year browsing and display modes (implemented):** the dashboard accepts `/?year=<year>` and defaults to the newest `readingYear` in the database (2007 when the ledger is empty). Previous/next links and recorded-year links navigate the ledger. The Cards/List switch is URL-backed (`?view=list`); year navigation preserves the selected mode. List rows sort by `startDate` ascending, with undated books last. The selected year also shows a compact summary: completed books, pages read, active reads, average rating, and average pages per completed book. The query-parameter and Prisma reads remain inside a `<Suspense>` boundary.

#### Step 3.2: Creating the High-Performance Interactive Components
1. Inside `src/components/BookCard.tsx`, assemble the layout logic using Tailwind utility classes.
2. The initial sketch below illustrates the card and progress interaction. The implemented component uses a typed Prisma payload (not `any`), handles null page counts, and shows the increment action only for books not marked completed:
   ```typescript
   'use client';

   import React from 'react';
   import { updateBookProgress } from '@/app/actions/bookActions';

   export default function BookCard({ book }: { book: any }) {
     const percentage = Math.min(Math.round((book.currentPages / book.totalPages) * 100), 100) || 0;

     return (
       <div className="bg-slate-800 rounded-xl border border-slate-700/60 p-5 shadow-xl transition hover:border-emerald-500/40 flex flex-col justify-between">
         <div>
           <div className="flex justify-between items-start gap-2">
             <h3 className="font-bold text-lg text-white tracking-wide truncate">{book.title}</h3>
             <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
               book.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
               book.status === 'READING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
               'bg-slate-700 text-slate-400'
             }`}>{book.status}</span>
           </div>
           <p className="text-slate-400 text-sm mt-1 mb-2 italic">by {book.author.name}</p>
           {book.rating && (
             <div className="text-amber-400 text-xs font-semibold mb-4">Rating: {book.rating}/10 ★</div>
           )}
         </div>

         <div className="mt-2">
           <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
             <span>Progress: {book.currentPages} / {book.totalPages} pages</span>
             <span>{percentage}%</span>
           </div>
           <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-950">
             <div 
               className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
               style={{ width: `${percentage}%` }}
             />
           </div>
           
           <div className="mt-4 flex gap-2">
             <button 
               onClick={async () => await updateBookProgress(book.id, book.currentPages + 10)}
               className="flex-1 bg-slate-700 text-xs py-2 rounded-lg font-semibold hover:bg-slate-600 transition text-white"
             >
               +10 Pages
             </button>
           </div>
         </div>
       </div>
     );
   }
   ```
3. **Book creation (implemented):** `/books/new` is linked from the dashboard. Its form collects title, author, start date, and optional total pages and genre. The Server Action validates submitted values, upserts author/genre, derives `readingYear` from the UTC start date, and creates a `READING` record. It returns a user-facing duplicate error when the unique reading-event key already exists.
4. **Book detail and editing (implemented):** `/books/[id]` displays the book and exposes an edit form for title, author, status, rating, reading year, publication year, total pages, pages read, start/finish dates, genre, origin, and edition key. Rating uses the existing nullable decimal `rating` field mapped to `nota_personal`; there is no personal-note field or schema migration. Author/genre records are upserted as part of the update transaction. Submitted dates, numeric ranges, status, and duplicate-key conflicts are validated.
5. **Mutation behavior:** `updateBookProgress`, `createReadingBook`, and `updateBookDetails` are Server Actions in `src/app/actions/bookActions.ts`. They validate untrusted form/action input and revalidate affected dashboard, detail, and statistics routes after successful writes. There is no individual-book delete UI.

---

### PHASE 4: Cloud Engine Provisioning & Production Pipelines
**Objective:** Deploy your local workspace configurations to enterprise cloud infrastructure by initializing a managed production database on **MariaDB** (SkySQL) and setting up automated deployments via Render.

#### Step 4.1: Managed Database Orchestration (SkySQL / MariaDB)
1. Log into your **SkySQL** console (MariaDB's official managed cloud — https://www.mariadb.com/products/skysql/) and create a new database service named `Books Application Engine`.
2. Navigate to the service's **Connection** tab and copy the Transaction-based Connection String URL (a `mysql://` URI).
3. Update your local git repository configuration by shifting target connections. Create a `.env.production` file to hold the connection string:
   ```env
   DATABASE_URL="mysql://DB_USER:[YOUR_DB_PASSWORD]@YOUR_MARIADB_HOST:PORT/reading_tracker?sslaccept=strict"
   ```
   > **Note:** managed MariaDB endpoints enforce TLS. Append `?sslaccept=strict` (paired with `sslcert`) for the SkySQL endpoint, and keep `connection_limit` modest for the pooled PaaS instance.
4. For production, apply the schema through a versioned migration (preferred over `db push`, so every change is reviewed and recorded under `prisma/migrations/`):
   ```bash
   npx prisma migrate dev --name init      # first migration against the prod DB
   npx prisma migrate deploy               # apply pending migrations in the deploy pipeline
   ```
   > `db push` (Step 2.2 §4) is fine for the local dev loop, but `migrate dev`/`migrate deploy` is the safe, auditable path for production.

---

### PHASE 5: Statistics & Graphs View — Trends, Rankings & Recommendations
**Objective:** Deliver a dedicated **statistics view** at `/stats` that turns the whole ledger into explorable analytics: KPI tiles, interactive Recharts graphs (yearly trend, rating distribution, genre mix, author leaderboard, monthly pace), per-year deep-linkable filters, and the genre-discovery recommender — all aggregated on the server by one typed module.

> **Why a dedicated route.** Phase 3's dashboard (`/`) is the CRUD/list surface; `/stats` is the analytical surface that replaces the legacy workbook's `Gráficos` tab. Keeping them separate means Recharts is only downloaded on the stats route, the list page stays light, and any year is deep-linkable (`/stats?year=2019`).

```
[GET /stats?year=2019]
        │
        ▼
src/app/stats/page.tsx ── static shell (header, back-link)
        │  <Suspense>  ← required by cacheComponents: true
        ▼
StatsContent (RSC) ── awaits searchParams (a Promise in Next 16)
        │
        ▼
src/lib/analytics.ts ── Prisma groupBy / aggregate / count (@/lib/prisma singleton)
        │
        ▼
MariaDB (Book · Author · Genre)
        │
        ▼
typed DTOs (src/lib/analytics-types.ts)
        ├──► KPI cards · year pills · rankings · suggestions (Server Components — zero client JS)
        └──► 5 Recharts graphs ('use client' leaves only)
```

**Design rules for this phase (they replace the original sketch):**
1.  **One aggregation module — `src/lib/analytics.ts`.** The original sketch used `src/services/analyticsService.ts`; the repo convention established in Step 2.3 is `src/lib/*` (`src/lib/prisma.ts`, `src/lib/ingestion/…`). It imports the **`@/lib/prisma` singleton** — `new PrismaClient()` inline is forbidden (dev hot-reload would exhaust MariaDB connections).
2.  **Aggregate in SQL** with Prisma `groupBy` / `aggregate` / `count` / filtered `_count` — never `findMany` + JS `reduce` over the full ledger.
3.  **Types live in `src/lib/analytics-types.ts`**, a module with zero runtime imports; both the service and the client charts consume it via `import type { … }`, so the Prisma client can never leak into the browser bundle.
4.  **Strict TypeScript, no `any`.** The DTOs are the server↔client contract; `tsc --noEmit` must stay clean.
5.  **Only charts are client components.** KPI cards, year pills, rankings and suggestions are plain Server Component HTML.
6.  **Cache Components–safe.** `next.config.ts` sets `cacheComponents: true`, so uncached Prisma reads and runtime-API access (`searchParams`) must sit behind `<Suspense>`, otherwise the build/dev overlay reports a blocking-route error.

#### Step 5.1: Visualization Dependency & Shared Analytics DTOs
1.  Recharts was declared in the stack but **never installed** (the original Step 5.2 imported it from nowhere). Install it now — v3.x is React 19-compatible:
    ```bash
    npm install recharts
    ```
2.  Create `src/lib/analytics-types.ts` — the single contract shared by server and client:
```typescript
/** One point of the books/pages-per-reading-year series. */
export interface YearlyTrendPoint {
  /** 2007 = PRE_TAB_READING_YEAR_SENTINEL for the "Leidos antes" back-catalogue. */
  readingYear: number;
  books: number;
  pages: number; // totalPages summed; NULL pages count as 0
}

/** KPI block for the year selected in /stats?year=. */
export interface YearKpis {
  year: number;
  booksCompleted: number;
  /** completed totalPages + in-progress currentPages (CONTEXT.md §4). */
  pagesRead: number;
  /** Math.round(pagesInYear / books); 0 when the year is empty. */
  avgPagesPerBook: number;
  /** pagesRead / (366 | 365), 2 decimals — leap-year aware (CONTEXT.md §4). */
  avgPagesPerDay: number;
  /** Arithmetic mean over RATED books only; null when none is rated. */
  avgRating: number | null;
  ratedBooks: number;
  unratedBooks: number;
  activeReads: number;
}

/** Integer rating bucket (1..10); half-point ratings (7.5) round to nearest. */
export interface RatingBucket { rating: number; books: number }

export interface RatingDistribution { buckets: RatingBucket[]; unrated: number }

/** Genre share of completed books; `genre: null` = books without a "Tipo" value. */
export interface GenreShare { genre: string | null; books: number }

export interface AuthorRank { id: string; name: string; books: number }

/** Books finished per calendar month of the selected year (1..12). */
export interface MonthPacePoint { month: number; books: number }

/** WISH_LIST books whose genre matches the reader's top-2 (CONTEXT.md §4). */
export interface Suggestion {
  id: string;
  title: string;
  author: string;
  genre: string | null;
}

export interface DiscoveryMetrics {
  topAuthors: AuthorRank[];  // top 5
  topGenres: GenreShare[];   // top 5, names resolved
  suggestions: Suggestion[]; // up to 3
}
```

#### Step 5.2: Analytics Aggregation Service (`src/lib/analytics.ts`)

```typescript
// src/lib/analytics.ts
import { prisma } from '@/lib/prisma'; // Step 2.3 singleton — NEVER `new PrismaClient()`
import { PRE_TAB_READING_YEAR_SENTINEL } from '@/lib/ingestion/workbook-parser';
import type {
  AuthorRank, DiscoveryMetrics, GenreShare, MonthPacePoint,
  RatingDistribution, Suggestion, YearKpis, YearlyTrendPoint,
} from '@/lib/analytics-types';

/**
 * Phase 5 analytics engine — every query the /stats view needs.
 * Returned Dates are UTC-midnight values (MariaDB DATETIME has no timezone),
 * so month bucketing MUST use the UTC getters, never the local ones.
 */

/** CONTEXT.md §4 leap-year rule. */
function daysInReadingYear(year: number): 366 | 365 {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

/** Books per year + pages per year in one grouped query. */
export async function getYearlyTrend(): Promise<YearlyTrendPoint[]> {
  const rows = await prisma.book.groupBy({
    by: ['readingYear'],
    where: { status: 'COMPLETED' },
    _count: { _all: true },
    _sum: { totalPages: true },
    orderBy: { readingYear: 'asc' },
  });
  return rows.map((r) => ({
    readingYear: r.readingYear,
    books: r._count._all,
    pages: r._sum.totalPages ?? 0, // NULL pages (pre-2014 rows) count as 0
  }));
}

/** KPI block for one reading year. */
export async function getYearKpis(year: number): Promise<YearKpis> {
  const [completed, unrated, active] = await Promise.all([
    prisma.book.aggregate({
      where: { readingYear: year, status: 'COMPLETED' },
      _count: { _all: true },
      _sum: { totalPages: true },
      _avg: { rating: true }, // Prisma's _avg skips NULLs = rated-only mean
    }),
    prisma.book.count({ where: { readingYear: year, status: 'COMPLETED', rating: null } }),
    prisma.book.aggregate({
      where: { readingYear: year, status: 'READING' },
      _count: { _all: true },
      _sum: { currentPages: true },
    }),
  ]);

  const pagesInYear = completed._sum.totalPages ?? 0;
  const pagesRead = pagesInYear + (active._sum.currentPages ?? 0);

  return {
    year,
    booksCompleted: completed._count._all,
    pagesRead,
    avgPagesPerBook: completed._count._all > 0 ? Math.round(pagesInYear / completed._count._all) : 0,
    avgPagesPerDay: parseFloat((pagesRead / daysInReadingYear(year)).toFixed(2)),
    avgRating: completed._avg.rating, // number | null
    ratedBooks: completed._count._all - unrated,
    unratedBooks: unrated,
    activeReads: active._count._all,
  };
}

/**
 * Rating histogram (0–10 scale). groupBy cannot express range buckets, so the
 * ~830 ratings are fetched as ONE slim column and bucketed in JS — cheaper and
 * fully type-safe (no raw SQL).
 */
export async function getRatingDistribution(): Promise<RatingDistribution> {
  const [rows, unrated] = await Promise.all([
    prisma.book.findMany({
      where: { status: 'COMPLETED', rating: { not: null } },
      select: { rating: true },
    }),
    prisma.book.count({ where: { status: 'COMPLETED', rating: null } }),
  ]);

  const buckets = new Map<number, number>();
  for (const { rating } of rows) {
    if (rating === null) continue; // narrowing guard; the filter already excludes NULLs
    const bucket = Math.min(10, Math.max(1, Math.round(rating))); // 7.5 → 8
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  return {
    buckets: Array.from({ length: 10 }, (_, i) => ({
      rating: i + 1,
      books: buckets.get(i + 1) ?? 0, // fill gaps so the X axis stays stable
    })),
    unrated,
  };
}

/**
 * Genre mix of the whole ledger. Books without a "Tipo" value keep their own
 * `null` bucket — the chart labels it "Sin género" instead of dropping it.
 */
export async function getGenreShares(): Promise<GenreShare[]> {
  const [genres, ungenred] = await Promise.all([
    prisma.genre.findMany({
      where: { books: { some: {} } }, // drop genres with zero books
      include: { _count: { select: { books: true } } },
      orderBy: { books: { _count: 'desc' } },
    }),
    prisma.book.count({ where: { status: 'COMPLETED', genreId: null } }),
  ]);

  const shares: GenreShare[] = genres.map((g) => ({ genre: g.name, books: g._count.books }));
  if (ungenred > 0) shares.push({ genre: null, books: ungenred });
  return shares.sort((a, b) => b.books - a.books);
}

/** Top-N authors by completed books (accent-insensitive names already unified on Author.name). */
export async function getTopAuthors(limit = 10): Promise<AuthorRank[]> {
  const authors = await prisma.author.findMany({
    include: { _count: { select: { books: { where: { status: 'COMPLETED' } } } } },
    orderBy: { books: { _count: 'desc' } },
    take: limit,
  });
  return authors.map((a) => ({ id: a.id, name: a.name, books: a._count.books }));
}

/**
 * Books finished per month of the selected year. Dates were ingested as UTC
 * midnight (CONTEXT.md §2.3), so use the UTC getters — `getMonth()` would
 * shift buckets under a non-UTC server timezone. Years with sparse date
 * coverage (pre-2014 rows often lack "Fecha Fin") report fewer finishes;
 * `withoutDates` lets the UI say so instead of silently lying.
 */
export async function getMonthlyPace(year: number): Promise<{ points: MonthPacePoint[]; withoutDates: number }> {
  const [rows, withoutDates] = await Promise.all([
    prisma.book.findMany({
      where: { readingYear: year, status: 'COMPLETED', finishDate: { not: null } },
      select: { finishDate: true },
    }),
    prisma.book.count({ where: { readingYear: year, status: 'COMPLETED', finishDate: null } }),
  ]);

  const byMonth = new Map<number, number>();
  for (const { finishDate } of rows) {
    if (!finishDate) continue;
    const month = finishDate.getUTCMonth() + 1; // UTC midnight → 1..12
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }

  return {
    points: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, books: byMonth.get(i + 1) ?? 0 })),
    withoutDates,
  };
}

/** Top-5 authors / genres + WISH_LIST suggestions (CONTEXT.md §4 recommender rule). */
export async function getDiscoveryMetrics(): Promise<DiscoveryMetrics> {
  const [topAuthors, topGenres] = await Promise.all([getTopAuthors(5), getGenreShares()]);

  // The recommender matches WISH_LIST books against the two most consumed
  // genres — it needs genre IDs, so re-read the top-2 with ids included.
  const topGenreRows = await prisma.genre.findMany({
    include: { _count: { select: { books: true } } },
    orderBy: { books: { _count: 'desc' } },
    take: 2,
  });

  const rows = await prisma.book.findMany({
    where: { status: 'WISH_LIST', genreId: { in: topGenreRows.map((g) => g.id) } },
    include: { author: true, genre: true },
    take: 3,
  });

  return {
    topAuthors,
    topGenres: topGenres.slice(0, 5),
    suggestions: rows.map((b): Suggestion => ({
      id: b.id,
      title: b.title,
      author: b.author.name,
      genre: b.genre?.name ?? null,
    })),
  };
}
```

> **Performance profile.** The whole `/stats` payload is ~7 grouped queries over ~830 rows — single-digit milliseconds on local MariaDB; `Promise.all` overlaps the independent ones.
> **Caching decision.** Reads are intentionally **uncached** so a re-import is visible on plain reload. If the ledger grows, add `'use cache'` + `cacheLife('hours')` inside `analytics.ts` and call `revalidatePath('/stats')` from the import route after a successful transaction.

#### Step 5.3: Chart Components (`src/components/charts/*.tsx`)

Recharts touches browser APIs, so each chart is a `'use client'` leaf whose props are **imported from `analytics-types.ts` with `import type`** (erased at build — the Prisma client never reaches the browser). Every chart obeys three rules: a **fixed-height parent** around `ResponsiveContainer` (a percentage-only height inside a CSS grid collapses to 0 px — the classic blank-chart bug), the slate/emerald palette of Phase 3, and an empty-state guard so a zeroed dataset renders a hint instead of a lying axis.

```typescript
'use client';

import {
  Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { YearlyTrendPoint } from '@/lib/analytics-types';

const nf = new Intl.NumberFormat('es-ES'); // Spanish source data: 327.490
const PRE_2008 = 2007; // PRE_TAB_READING_YEAR_SENTINEL

export default function YearTrendChart({ data }: { data: YearlyTrendPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">No books imported yet.</p>;
  }
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Books &amp; pages per reading year
      </figcaption>
      {/* Fixed height is mandatory: ResponsiveContainer measures its parent. */}
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <XAxis
              dataKey="readingYear"
              tickFormatter={(y: number) => (y === PRE_2008 ? '≤2007' : String(y))}
              stroke="#64748b"
            />
            <YAxis yAxisId="books" allowDecimals={false} stroke="#64748b" />
            <YAxis yAxisId="pages" orientation="right" stroke="#64748b" tickFormatter={(n) => nf.format(Number(n))} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(value, key) => (key === 'pages' ? nf.format(Number(value)) : value)}
            />
            <Bar yAxisId="books" dataKey="books" name="Books" fill="#34d399" radius={[3, 3, 0, 0]} />
            <Line yAxisId="pages" dataKey="pages" name="Pages" stroke="#60a5fa" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
```

The four siblings follow the same pattern; only the data and the chart primitive change:

*   **`RatingChart.tsx`** — `BarChart` over `RatingDistribution.buckets` (fixed 1–10 X axis so zeroed buckets keep the scale); the caption surfaces `unrated`; bars are green ≥ 8, amber ≥ 6, red below.
*   **`GenreChart.tsx`** — `PieChart` + `Cell` palette; groups beyond the top 6 into "Otros"; the `null` genre renders as "Sin género" — its own bucket, never silently dropped.

```typescript
'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RatingDistribution } from '@/lib/analytics-types';

export default function RatingChart({ data }: { data: RatingDistribution }) {
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Rating distribution (0–10)
        <span className="text-slate-500 font-normal"> · {data.unrated} unrated</span>
      </figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.buckets} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <XAxis dataKey="rating" stroke="#64748b" />
            <YAxis allowDecimals={false} stroke="#64748b" />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} cursor={{ fill: 'rgba(51,65,85,0.4)' }} />
            <Bar dataKey="books" name="Books" fill="#f59e0b" radius={[3, 3, 0, 0]}>
              {data.buckets.map((b) => (
                <Cell key={b.rating} fill={b.rating >= 8 ? '#34d399' : b.rating >= 6 ? '#f59e0b' : '#f87171'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
```

```typescript
'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { GenreShare } from '@/lib/analytics-types';

const PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#f472b6', '#38bdf8', '#fb923c'];

export default function GenreChart({ data, topN = 6 }: { data: GenreShare[]; topN?: number }) {
  const sorted = [...data].sort((a, b) => b.books - a.books);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN).reduce((n, g) => n + g.books, 0);
  const slices = [
    ...top.map((g) => ({ name: g.genre ?? 'Sin género', books: g.books })),
    ...(rest > 0 ? [{ name: 'Otros', books: rest }] : []),
  ];

  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">Genre mix (all completed)</figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="books" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {slices.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
```

*   **`AuthorsChart.tsx`** — horizontal `BarChart` (`layout="vertical"`, `YAxis type="category"`); long accent-normalized names truncated with `tickFormatter`.
*   **`MonthlyPaceChart.tsx`** — `LineChart` over the 12 fixed month points of the selected year; `withoutDates` appears as a caption ("N finished without Fecha Fin").

```typescript
'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AuthorRank } from '@/lib/analytics-types';

export default function AuthorsChart({ data }: { data: AuthorRank[] }) {
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">Most-read authors (top 10)</figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <XAxis type="number" allowDecimals={false} stroke="#64748b" />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              stroke="#64748b"
              tickFormatter={(n: string) => (n.length > 20 ? `${n.slice(0, 19)}…` : n)}
            />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} cursor={{ fill: 'rgba(51,65,85,0.4)' }} />
            <Bar dataKey="books" name="Books" fill="#60a5fa" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
```

```typescript
'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthPacePoint } from '@/lib/analytics-types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function MonthlyPaceChart({ data, withoutDates }: { data: MonthPacePoint[]; withoutDates: number }) {
  return (
    <figure className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <figcaption className="mb-4 text-sm font-semibold text-slate-300">
        Finishes per month
        {withoutDates > 0 && (
          <span className="text-slate-500 font-normal"> · {withoutDates} finished without Fecha Fin</span>
        )}
      </figcaption>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
            <XAxis dataKey="month" stroke="#64748b" tickFormatter={(m: number) => MONTHS[m - 1]} />
            <YAxis allowDecimals={false} stroke="#64748b" />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} />
            <Line type="monotone" dataKey="books" name="Books finished" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
```

#### Step 5.4: The Statistics View — `src/app/stats/`

Three new files:

*   **`src/app/stats/page.tsx`** — Server Component: static shell (header + back-link) wrapping the data-bound content in `<Suspense>`. `searchParams` is a **Promise in Next 16** and every Prisma read is uncached; with `cacheComponents: true` both must live inside a Suspense boundary or the prerender reports a blocking route.
*   **`src/app/stats/loading.tsx`** — skeleton streamed on **navigation** to `/stats`.
*   **`src/app/stats/_components.tsx`** — server-only presentational helpers (`nf`, `Kpi`, `TopList`, `SuggestionsList`, `StatsSkeleton`).

```typescript
// src/app/stats/page.tsx
import Link from 'next/link';
import { Suspense } from 'react';
import { PRE_TAB_READING_YEAR_SENTINEL } from '@/lib/ingestion/workbook-parser';
import {
  getDiscoveryMetrics, getGenreShares, getMonthlyPace,
  getRatingDistribution, getTopAuthors, getYearKpis, getYearlyTrend,
} from '@/lib/analytics';
import { Kpi, nf, StatsSkeleton, SuggestionsList, TopList } from './_components';
import YearTrendChart from '@/components/charts/YearTrendChart';
import RatingChart from '@/components/charts/RatingChart';
import GenreChart from '@/components/charts/GenreChart';
import AuthorsChart from '@/components/charts/AuthorsChart';
import MonthlyPaceChart from '@/components/charts/MonthlyPaceChart';

// PageProps<'/stats'> is a Next.js-generated global helper (no import needed).
type StatsSearchParams = PageProps<'/stats'>['searchParams'];

export default function StatsPage(props: PageProps<'/stats'>) {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Reading statistics</h1>
          <p className="text-slate-400 mt-1">Trends, rankings and graphs over the whole ledger.</p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
        >
          ← Dashboard
        </Link>
      </header>
      {/* cacheComponents: runtime searchParams + uncached Prisma reads must be Suspense-gated. */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function StatsContent({ searchParams }: { searchParams: StatsSearchParams }) {
  const { year: rawYear } = await searchParams;

  const trend = await getYearlyTrend();
  const availableYears = trend.map((p) => p.readingYear);
  const requested = typeof rawYear === 'string' ? Number(rawYear) : NaN;

  // Invalid or missing ?year= falls back to the newest reading year.
  const year = availableYears.includes(requested)
    ? requested
    : (availableYears[availableYears.length - 1] ?? PRE_TAB_READING_YEAR_SENTINEL);

  const [kpis, ratings, genres, authors, pace, discovery] = await Promise.all([
    getYearKpis(year),
    getRatingDistribution(),
    getGenreShares(),
    getTopAuthors(10),
    getMonthlyPace(year),
    getDiscoveryMetrics(),
  ]);

  return (
    <div className="space-y-10">
      {/* Year pills — URL state, not client state: plain Links keep everything server-rendered. */}
      <nav className="flex flex-wrap gap-2" aria-label="Reading year">
        {availableYears.map((y) => (
          <Link
            key={y}
            href={`/stats?year=${y}`}
            className={`px-3 py-1 rounded-full text-sm font-semibold border transition ${
              y === year
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
                : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {y === PRE_TAB_READING_YEAR_SENTINEL ? 'pre-2008' : y}
          </Link>
        ))}
      </nav>

      {/* KPI row — plain server HTML, zero client JS. */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <Kpi label="Books completed" value={kpis.booksCompleted} tone="emerald" />
        <Kpi label="Pages read" value={nf.format(kpis.pagesRead)} tone="blue" />
        <Kpi label="Avg pages / book" value={kpis.avgPagesPerBook} tone="amber" />
        <Kpi label="Avg pages / day" value={kpis.avgPagesPerDay} tone="purple" />
        <Kpi label="Avg rating" value={kpis.avgRating === null ? '—' : kpis.avgRating.toFixed(1)} tone="rose" />
        <Kpi label="Active reads" value={kpis.activeReads} tone="sky" />
      </section>

      {/* Graphs — the only client components on the page. */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:col-span-2"><YearTrendChart data={trend} /></div>
        <RatingChart data={ratings} />
        <GenreChart data={genres} />
        <MonthlyPaceChart data={pace.points} withoutDates={pace.withoutDates} />
        <AuthorsChart data={authors} />
      </section>

      {/* Rankings + recommender — server-rendered lists (CONTEXT.md §4). */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TopList
          title="Top 5 authors"
          items={discovery.topAuthors.map((a) => ({ id: a.id, label: a.name, value: `${a.books} books` }))}
        />
        <TopList
          title="Top 5 genres"
          items={discovery.topGenres.map((g, i) => ({ id: String(i), label: g.genre ?? 'Sin género', value: `${g.books} books` }))}
        />
        <SuggestionsList items={discovery.suggestions} />
      </section>
    </div>
  );
}
```

```typescript
// src/app/stats/_components.tsx — server-only presentational helpers (no 'use client').
import type { Suggestion } from '@/lib/analytics-types';

export const nf = new Intl.NumberFormat('es-ES');

const TONES = {
  emerald: 'border-emerald-500/30 text-emerald-400',
  blue: 'border-blue-500/30 text-blue-400',
  amber: 'border-amber-500/30 text-amber-400',
  purple: 'border-purple-500/30 text-purple-400',
  rose: 'border-rose-500/30 text-rose-400',
  sky: 'border-sky-500/30 text-sky-400',
} as const;

export function Kpi({ label, value, tone }: { label: string; value: string | number; tone: keyof typeof TONES }) {
  return (
    <div className={`bg-slate-800 p-5 rounded-xl border ${TONES[tone]}`}>
      <p className="text-slate-400 text-xs font-semibold uppercase">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${TONES[tone].split(' ')[1]}`}>{value}</p>
    </div>
  );
}

export function TopList({ title, items }: { title: string; items: { id: string; label: string; value: string }[] }) {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No completed books yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-sm">
              <span className="text-slate-300">{item.label}</span>
              <span className="bg-slate-900 px-3 py-1 rounded-md text-emerald-400 font-bold">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SuggestionsList({ items }: { items: Suggestion[] }) {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">Smart next reading suggestions</h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">
          Add items to WISH_LIST under your favorite genres to trigger recommendations.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((book) => (
            <div key={book.id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/40">
              <h4 className="font-bold text-white text-sm">{book.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">by {book.author} | {book.genre ?? 'Sin género'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="space-y-10 animate-pulse" aria-busy="true" aria-label="Loading statistics">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-full bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-[360px] rounded-xl bg-slate-800 ${i === 0 ? 'lg:col-span-2' : ''}`} />
        ))}
      </div>
    </div>
  );
}
```

```typescript
// src/app/stats/loading.tsx — streamed on navigation; reuses the same skeleton.
import { StatsSkeleton } from './_components';

export default function Loading() {
  return <StatsSkeleton />;
}
```

#### Step 5.5: Dashboard wiring & cross-cutting fixes
1.  **Navigation both ways.** The dashboard header links to `/stats`; the stats header links back to `/`.
2.  **Rating scale fix (Step 3.2).** `BookCard` displayed `Rating: {book.rating}/5`; the ledger scale is decimal **0–10** (CONTEXT.md §2.1). The snippet now shows `/10`.
3.  **Post-import freshness.** The import route needs no `revalidatePath` today: `/stats` reads are uncached, so a plain reload after `POST /api/v1/import` shows fresh numbers. Revisit only if you adopt the `'use cache'` stretch goal below.
4.  **Prisma singleton everywhere.** The Phase 3 snippet previously instantiated `new PrismaClient()` inline; it now imports the Step 2.3 singleton, exactly like `analytics.ts`.
5.  **Completion-date source of truth.** The import route sets `COMPLETED` only when `finishDate` is present; rows without an ending date are saved as `READING` and are excluded from completed-book analytics. Re-import the workbook to correct previously imported statuses.
6.  **Dashboard year navigation and views.** `/` defaults to the latest recorded `readingYear` (or 2007 for an empty database) and filters the shelf by year. `/?year=YYYY`, previous/next links, and recorded-year links provide navigation. Cards/List mode is encoded by `?view=list`; the list is sorted by start date ascending, undated books last. Year navigation preserves the selected mode.
7.  **Book creation and editing.** The dashboard links to `/books/new`; each book detail route allows editing all persisted book fields, including the existing 0–10 rating. Save operations validate data, update author/genre relations, and refresh affected views.

#### Step 5.6: Verification & Acceptance Checklist

| Check | Expected result |
| --- | --- |
| `npm install recharts` | recharts 3.x in `package.json`; React 19 peer satisfied |
| `npx tsc --noEmit` | clean — no `any` reaches a chart prop; DTOs shared via `import type` |
| `npx eslint .` | clean — every chart file starts with `"use client"` |
| `npm run build` | `/stats` is a partial-prerender route (◐) with its uncached data streamed behind Suspense; **no blocking-prerender / missing-Suspense errors** from `cacheComponents` |
| `npm run dev` → `/stats` | Completed-book KPIs exclude records without `finishDate`; verify against the re-imported workbook rather than the historical pre-correction count |
| `/stats?year=2019` | 2019 pill active; KPIs, pace chart and suggestions scoped to 2019 |
| `/stats?year=banana` | falls back to the newest reading year; no crash |
| `/stats?year=2007` | pill reads "pre-2008"; shows the "Leidos antes" back-catalogue |
| `/` | defaults to the latest recorded year (2007 for an empty ledger); year navigation updates the shelf and URL |
| `/?view=list` | renders a book table sorted by start date ascending, with undated books last |
| `/books/new` | creates a `READING` book with reading year derived from start date |
| `/books/<id>` | shows editable book fields, including the existing 0–10 rating; valid changes persist without schema changes |
| Import row without `Fecha Fin` | saved as `READING`, not `COMPLETED` |
| Trend chart | one bar per ingested reading year (≤2007 sentinel + 2008–2026) |
| Empty database | skeleton → "No books imported yet" empty states; no zero-axis lies |
| 375 px viewport | `h-[300px]` parents keep charts visible (no zero-height collapse) |

#### Stretch goals (optional, highest value first)
*   **Origin breakdown donut** — one extra `groupBy` on `Book.origin` (Propio / Prestado / ebook…).
*   **Publication-era histogram** — bucket `publicationYear` (watch the NULLs from pre-2014 tabs).
*   **CSV export per year** — `GET /api/v1/stats/export?year=…` route handler reusing `analytics.ts`.
*   **Cache the heavy day** — `'use cache'` + `cacheLife('hours')` on the analytics functions plus `revalidatePath('/stats')` in the import route.

---

### PHASE 6: Library Discovery & Author Profiles — IN PROGRESS

**Objective:** Make the ledger easier to browse and search, and add reliable, properly attributed author portraits where a permitted image source can be identified.

#### Feature 6.1: Richer cards, fields, and sorting — COMPLETE

1. Keep the existing card layout and preserve its start-date-descending default; keep the List view's start-date-ascending default.
2. Add explicit sort options usable in both Cards and List modes: reading start date, author, and title, with ascending/descending direction. Use stable title/author/ID tie-breakers; undated books stay last in either date direction.
3. Keep the selected year, view, and sort in URL query parameters so results can be bookmarked and navigation preserves the selection. Validate query values and fall back to the current default for invalid options.
4. Expand the card presentation with existing fields: genre, rating, start/finish dates, publication year, origin, and page progress, while retaining title, author, status, and its existing progress action. Expand the list with genre, publication year, origin, reading dates, pages, status, and rating.
5. Derive a shared, typed display/sort contract from the current `Book`, `Author`, and `Genre` fields; do not add schema fields for metadata already in the database.

**Acceptance:** date sorting remains the default for each view; author/title sorts work in both views; missing dates remain last and unavailable fields display as placeholders; direction and sort survive year/view navigation; book links and progress actions continue to work.

**Implementation:** `src/lib/dashboard.ts` contains validated URL sort parsing and stable sorting; `src/app/page.tsx` includes author and genre data and preserves sorting state across year/view navigation. `BookCard` and the table display existing metadata. Unit tests cover invalid/repeated sort parameters, ascending/descending dates, null dates, tie-breaks, and input immutability.

#### Feature 6.2: Global book autocomplete — COMPLETE

1. Add a dashboard-header search for book titles and author names across the whole ledger.
2. Trim and validate queries to 2–100 characters, debounce requests by 250ms, cap results at eight, and escape SQL `LIKE` wildcards as literals.
3. Return a small result projection (book ID, title, author, reading year) from the read-only `GET /api/books/search` route; each result opens `/books/[id]`.
4. Provide accessible combobox/listbox keyboard interaction (arrow keys, Enter, Escape), live status announcements, and visible loading, no-match, malformed-response, and network-error states.
5. Keep MariaDB queries parameterized through Prisma; search failures return errors instead of a successful empty result. No index or schema changes were required for the current ledger.

**Acceptance:** searches work across reading years; result count and query size are bounded; title and author matches are useful; invalid and repeated query parameters return `400`; no-match and wildcard input do not return unrelated books.

**Implementation and verification:** `src/components/BookSearch.tsx`, `src/app/api/books/search/route.ts`, and `src/lib/book-search.ts`. Live read-only production checks found author matches across multiple years, returned no matches for literal wildcard searches, and rejected short/repeated queries. Tests, type-check, targeted ESLint, and production build pass.

#### Feature 6.3: Author photos and book covers from Open Library — IMPLEMENTED

1. **Research outcome:** Open Library documents cover lookups by ISBN, Open Library ID, or cover ID and author-photo lookups by author ID or photo ID. Its usage guidance asks applications to identify themselves, cache responses, and avoid bulk API use; cover requests by ISBN and several other identifiers have a documented rate limit. Open Library's image documentation does not grant a blanket license to every image.
2. **Provider checks:** one Open Library author record (`OL23919A`) returned photo ID `5543033`; its medium photo URL returned HTTP 200. One book search for *The Cuckoo's Calling* found work `OL16806416W` with cover ID `7261207`; its medium cover URL returned HTTP 200. These were read-only checks, not database writes or a bulk scan.
3. **Manual, low-request workflow:** the book detail page offers separate **Find book cover** and **Find author photo** actions. Each search requests at most five candidates, caches successful API responses for one day, and sends a descriptive User-Agent. The user reviews provider names, source records, and image previews before explicitly saving one image. Author photo details are fetched only after selecting an author candidate. Provider errors and missing images remain visible; nothing is silently saved.
4. **Persistence and rendering:** selected book covers store the Open Library cover ID and work ID on `Book`; selected author photos reuse the existing `Author` portrait/source fields. Covers and portraits are loaded directly from the Open Library Covers host, with lazy loading and existing title/initial fallbacks. The detail page links to the source record. Existing valid Commons portraits remain supported, but the failing Wikimedia lookup/sync path has been retired. No images are downloaded, re-hosted, or bulk-populated.
5. **Database:** the two nullable `Book` image fields are additive and have been applied to the local database with `npx prisma db push`; other deployments must apply them before using the picker.

**Acceptance:** no automatic bulk requests; every result is explicitly reviewed and selected; invalid provider IDs are rejected; external lookup/image failures leave the dashboard usable; the app retains fallbacks and displays provider source links; image URLs use only the expected Open Library or existing Commons hosts.

**Research references:** [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers), [Authors API](https://openlibrary.org/dev/docs/api/authors), [API usage guidelines](https://openlibrary.org/developers/api), and [Goodreads API URL checked](https://www.goodreads.com/api) (not used; no documented image API was confirmed).

#### Phase 6 delivery order and review gates

1. Features 6.1 and 6.2 are implemented and tested.
2. Manually exercise one author and one book from a detail page. Do not run bulk image discovery.
3. Run targeted type-check, lint, tests, and production build.

**Status:** Features 6.1, 6.2, and the manual Open Library image lookup UI are implemented. The provider endpoints were verified against one author and book, and the additive Book columns are applied locally. Browser-level confirmation through the picker remains untested. No bulk lookups were run.

---

## 📈 Long-Term Operational Strategies
*   **Encapsulation Validation:** As your tracking database grows, wrap the raw database queries inside isolated service files to keep your application logic cleanly separated.
*   **Database Scaling:** Keep an eye on MariaDB's indexing (InnoDB secondary/composite indexes declared via `@@index`). The current `Book` model carries a composite unique on `title`+`authorId`+`readingYear` and FK indexes on `authorId`/`genreId`. As you scale to thousands of rows, add `@@index([status])` / `@@index([readingYear])` / `@@index([updatedAt])` to the `Book` model, then re-run `npx prisma db push` (dev) or a `migrate dev` migration (prod) to create them.
*   **Offline Support:** In the future, you can configure your PWA's Service Worker to cache network requests, allowing you to view and update your reading lists even when you're completely offline.