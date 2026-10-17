import { NextResponse } from "next/server";
import { importWorkbookBooks } from "@/lib/imports";
import { parseWorkbookBuffer, type ParsedWorkbook } from "@/lib/ingestion/workbook-parser";

/**
 * POST /api/v1/import — transactional bulk ingestion (PLAN.md Step 2.3)
 *
 * Accepts a `multipart/form-data` payload with the legacy ledger under the
 * `file` field, parses every "Leidos/Leídos" tab with the shared parser, and
 * writes the whole workbook in ONE Prisma interactive transaction:
 *
 *   Author (upsert by unique name)  ── avoids duplicating author names
 *   Genre  (upsert by unique name)  ── derived from the "Tipo" column
 *   Book   (upsert by title + author + reading year + edition fingerprint)
 *
 * Atomicity: either every valid row lands, or nothing does — a failure anywhere
 * rolls the whole import back, so a half-imported ledger can never exist.
 *
 * Idempotency: re-uploading the same workbook upserts instead of colliding,
 * because each reading year is a distinct reading event, and the edition
 * fingerprint distinguishes editions read within the same year.
 *
 * Runtime note (Next.js 16): Route Handlers read the body via
 * `request.formData()` — no `bodyParser` config needed. The Edge Runtime is
 * deprecated, so this route deliberately declares no `runtime` export and runs
 * on the default Node.js runtime (required by Prisma + ExcelJS).
 */

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
  let stats: Awaited<ReturnType<typeof importWorkbookBooks>>;
  try {
    stats = await importWorkbookBooks(workbook);
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
  const payload: ImportResult = {
    success: true,
    processed: workbook.books.length,
    created: stats.created,
    updated: stats.updated,
    authors: stats.authors,
    genres: stats.genres,
    backfilledReadingYear: stats.backfilledReadingYear,
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
