import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  PRE_TAB_READING_YEAR_SENTINEL,
  parseWorkbookBuffer,
  type ParsedBook,
  type ParsedWorkbook,
} from "@/lib/ingestion/workbook-parser";

/** The transactional client handed to a Prisma interactive transaction callback. */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * POST /api/v1/import — transactional bulk ingestion (PLAN.md Step 2.3)
 *
 * Accepts a `multipart/form-data` payload with the legacy ledger under the
 * `file` field, parses every "Leidos/Leídos" tab with the shared parser, and
 * writes the whole workbook in ONE Prisma interactive transaction:
 *
 *   Author (upsert by unique name)  ── avoids duplicating author names
 *   Genre  (upsert by unique name)  ── derived from the "Tipo" column
 *   Book   (upsert by composite unique key `title + authorId + readingYear`)
 *
 * Atomicity: either every valid row lands, or nothing does — a failure anywhere
 * rolls the whole import back, so a half-imported ledger can never exist.
 *
 * Idempotency: re-uploading the same workbook upserts instead of colliding,
 * because the same title legitimately recurs across yearly tabs and
 * `readingYear` is part of the natural key.
 *
 * Runtime note (Next.js 16): Route Handlers read the body via
 * `request.formData()` — no `bodyParser` config needed. The Edge Runtime is
 * deprecated, so this route deliberately declares no `runtime` export and runs
 * on the default Node.js runtime (required by Prisma + ExcelJS).
 */

/**
 * Bulk imports can far exceed the 5s default transaction budget: a ~830-row
 * workbook performs ~1,300 round-trips. Raise both the Prisma transaction
 * budget and the platform execution limit well above that.
 */
const PRISMA_TRANSACTION_TIMEOUT_MS = 120_000;
const PRISMA_TRANSACTION_MAX_WAIT_MS = 15_000;

/** Generous ceiling for the uploaded ledger (the real file is ~150 KB). */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Only genuine OOXML workbooks are accepted. */
const ACCEPTED_EXTENSION = ".xlsx";

/** Response body contract, so callers get a stable, typed shape. */
interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  authors: { total: number; created: number };
  genres: { total: number; created: number };
  backfilledReadingYear: number;
  durationMs: number;
  workbook: {
    worksheets: number;
    matchedTabs: string[];
    skippedTabs: Array<{ name: string; reason: string }>;
    footerRowsSkipped: number;
  };
  /** Row-level validation failures. These rows were NOT imported. */
  errors: string[];
}

export async function POST(request: Request): Promise<NextResponse> {
  const startedAt = Date.now();

  // --- 1. Extract the payload -------------------------------------------
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Expected a multipart/form-data payload containing a 'file' field.");
  }

  const file = asFile(formData.get("file"));
  if (!file) {
    return badRequest("Payload missing file entity (expected a 'file' field).");
  }
  if (file.size === 0) {
    return badRequest("The uploaded file is empty.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return badRequest(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
        `Maximum accepted size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (!file.name.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
    return badRequest(
      `Unsupported file type "${file.name}". Only ${ACCEPTED_EXTENSION} workbooks are accepted.`,
    );
  }

  // --- 2. Parse the workbook (throws a descriptive error for .xls/OLE2) --
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
  } catch {
    return badRequest("The uploaded file could not be read. Please re-upload the file.");
  }

  let workbook: ParsedWorkbook;
  try {
    workbook = await parseWorkbookBuffer(buffer);
  } catch (error) {
    // A malformed workbook is the CLIENT's mistake, not a server fault: report
    // 400 with the parser's actionable message instead of letting it surface
    // as an opaque 500.
    const message = error instanceof Error ? error.message : String(error);
    return badRequest(message);
  }

  if (workbook.matchedSheets.length === 0) {
    return badRequest("No readable 'Leidos/Leídos' tabs were found in the workbook.", {
      skippedTabs: workbook.skippedSheets.map((s) => ({ name: s.name, reason: s.skipReason })),
    });
  }

  // --- 3. Persist everything in one atomic transaction -------------------
  const authorIds = new Map<string, string>();
  const genreIds = new Map<string, string>();
  const authorsBefore = await prisma.author.count();
  const genresBefore = await prisma.genre.count();
  const booksBefore = await prisma.book.count();
  let backfilledReadingYear = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // 3a. Authors — upsert each UNIQUE name once, then reuse the id.
        // Upserting per row would repeat ~830 identical lookups; the set
        // collapses the workbook's ~447 distinct authors into 447 writes.
        for (const name of new Set(workbook.books.map((b) => b.authorName))) {
          const author = await tx.author.upsert({ where: { name }, update: {}, create: { name } });
          authorIds.set(name, author.id);
        }

        // 3b. Genres — derived from the "Tipo" column; untyped rows stay NULL.
        for (const name of new Set(workbook.books.map((b) => b.genreName).filter(isPresent))) {
          const genre = await tx.genre.upsert({ where: { name }, update: {}, create: { name } });
          genreIds.set(name, genre.id);
        }

        // 3c. Books — upsert on the composite natural key.
        for (const book of workbook.books) {
          await persistBook(tx, book, authorIds, genreIds);
          if (book.readingYear === null) backfilledReadingYear++;
        }
      },
      { timeout: PRISMA_TRANSACTION_TIMEOUT_MS, maxWait: PRISMA_TRANSACTION_MAX_WAIT_MS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: `Import failed and was rolled back: ${message}`,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }

  // --- 4. Report ---------------------------------------------------------
  // created = net row growth, updated = the remainder. Two COUNT queries beat
  // ~830 extra existence checks just to label each row.
  const created = (await prisma.book.count()) - booksBefore;
  const payload: ImportResult = {
    success: true,
    processed: workbook.books.length,
    created,
    updated: workbook.books.length - created,
    authors: { total: authorIds.size, created: (await prisma.author.count()) - authorsBefore },
    genres: { total: genreIds.size, created: (await prisma.genre.count()) - genresBefore },
    backfilledReadingYear,
    durationMs: Date.now() - startedAt,
    workbook: {
      worksheets: workbook.totals.worksheets,
      matchedTabs: workbook.matchedSheets.map((s) => s.name),
      skippedTabs: workbook.skippedSheets.map((s) => ({ name: s.name, reason: s.skipReason ?? "" })),
      footerRowsSkipped: workbook.totals.footerRows,
    },
    errors: workbook.errors,
  };

  return NextResponse.json(payload, { status: 200 });
}

/** Type guard that narrows `string | null` for the genre-name set. */
function isPresent(value: string | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Upsert one parsed row onto the relational schema.
 *
 * `readingYear` is NOT NULL and part of the composite unique key, but the
 * "Leidos antes" tab has no year in its name. That pre-2008 back-catalogue is
 * preserved via a documented sentinel year rather than being silently dropped.
 */
async function persistBook(
  tx: PrismaTransactionClient,
  book: ParsedBook,
  authorIds: Map<string, string>,
  genreIds: Map<string, string>,
): Promise<void> {
  const authorId = authorIds.get(book.authorName);
  if (!authorId) {
    throw new Error(`Author "${book.authorName}" was not resolved before persisting its books.`);
  }

  const readingYear = book.readingYear ?? PRE_TAB_READING_YEAR_SENTINEL;
  const genreName = book.genreName?.trim() || null;
  const genreId = genreName ? (genreIds.get(genreName) ?? null) : null;

  // Both branches carry identical field values; the composite unique key
  // (title + authorId + readingYear) makes the upsert idempotent, so a
  // re-import refreshes the same rows instead of violating the constraint.
  const fields = {
    totalPages: book.totalPages,
    rating: book.rating,
    publicationYear: book.publicationYear,
    origin: book.origin,
    startDate: book.startDate,
    finishDate: book.finishDate,
    genreId,
    status: "COMPLETED",
  } as const;

  await tx.book.upsert({
    where: { title_authorId_readingYear: { title: book.title, authorId, readingYear } },
    update: fields,
    create: { ...fields, title: book.title, readingYear, authorId },
  });
}

/** Coerce an unknown `FormData` entry into a `File`, or `null`. */
function asFile(entry: unknown): File | null {
  if (typeof entry === "object" && entry !== null && "arrayBuffer" in entry) {
    return entry as File;
  }
  return null;
}

/** Human-readable rejection payload for client mistakes. */
function badRequest(message: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: false, error: message, ...extra }, { status: 400 });
}
