import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";
import { parseWorkbook, type ParsedBook } from "@/lib/ingestion/workbook-parser";

/**
 * Step 1.2 — Ingestion Sandbox (CLI Engine) · MULTI-TAB
 *
 * A decoupled, browser-free Node utility that parses a multi-tab reading
 * spreadsheet and proves the ingestion layer can read the real source schema
 * with zero telemetry failures. Read-only proof-of-concept: NO database work.
 *
 * All parsing lives in `src/lib/ingestion/workbook-parser.ts`, which is the same
 * module the Step 2.3 import route uses — so this sandbox validates exactly the
 * contract the API enforces, and the two can never drift.
 *
 * Run:  npm run validate:ingestion [optionalPath]
 */

const SOURCE_PATH =
  process.argv[2] ??
  process.env.INGESTION_SOURCE ??
  path.resolve(process.cwd(), "telemetry_sandbox", "source.xlsx");

async function main(): Promise<void> {
  console.log("====================================================");
  console.log(" books · Ingestion Sandbox (CLI) — Step 1.2 · multi-tab");
  console.log("====================================================");
  console.log(`Source workbook: ${SOURCE_PATH}`);

  if (!fs.existsSync(SOURCE_PATH)) {
    console.error(`\n[FATAL] Source workbook not found at: ${SOURCE_PATH}`);
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(SOURCE_PATH);
  } catch (err) {
    console.error(
      "\n[FATAL] Failed to parse workbook. It is most likely NOT a valid " +
        "OOXML .xlsx file.\n" +
        "        Legacy .xls / .xlsb (OLE2) are NOT supported by ExcelJS — " +
        "re-save the file as .xlsx first.\n" +
        `        Underlying error: ${(err as Error).message}`,
    );
    process.exit(1);
  }

  console.log(`Worksheets found: ${workbook.worksheets.length}\n`);

  const parsed = parseWorkbook(workbook);

  // --- Per-tab report ---
  for (const r of parsed.sheets) {
    if (!r.matched) {
      console.log(`[skip] "${r.name}" — ${r.skipReason}`);
      continue;
    }
    const yearLabel = r.readingYear ?? "?";
    console.log(
      `[read] "${r.name}" (year ${yearLabel}) — ${r.books.length} records, ` +
        `${r.errors.length} error(s), ${r.footerRows} footer row(s) skipped, cols=[${r.headers.join(", ")}]`,
    );
    for (const rec of r.books) {
      console.log(formatBookLine(rec));
    }
    for (const e of r.errors) console.log(`    ! ${e}`);
  }

  // --- Global summary ---
  const t = parsed.totals;
  const avgRating = t.averageRating === null ? "n/a" : `${t.averageRating.toFixed(2)}`;

  console.log("\n====================================================");
  console.log("INGESTION SUMMARY (all tabs)");
  console.log("====================================================");
  console.log(`Worksheets total    : ${t.worksheets}`);
  console.log(`Worksheets matched  : ${t.matched}`);
  console.log(`Worksheets skipped  : ${t.skipped}`);
  console.log(`Records parsed      : ${t.rows}`);
  console.log(`  · with page count : ${t.rows - t.rowsWithoutPages}`);
  console.log(`Footer rows skipped : ${t.footerRows}`);
  console.log(`Validation errors   : ${parsed.errors.length}`);
  console.log(`Total pages         : ${t.totalPages}`);
  console.log(`Rated books         : ${t.ratedBooks} (avg ${avgRating}/10)`);
  console.log(`Unique authors      : ${t.uniqueAuthors}`);

  for (const e of parsed.errors) console.log(`  ! ${e}`);

  if (t.rows === 0) {
    console.log("\n[WARN] No valid records parsed from any read tab.");
    process.exit(1);
  }
  console.log("\n[OK] Multi-tab ingestion validation completed successfully.");
}

/** Render one parsed row as a compact, human-readable log line. */
function formatBookLine(rec: ParsedBook): string {
  const rating = rec.rating === null ? "unrated" : `${rec.rating}/10`;
  const pp = rec.totalPages === null ? "? pp" : `${rec.totalPages} pp`;
  const extraAutor = rec.extraAuthors.length
    ? ` (+${rec.extraAuthors.length} autor col)`
    : "";
  const dates =
    rec.startDate || rec.finishDate
      ? ` | ${rec.startDate?.toISOString().slice(0, 10) ?? "?"}→${rec.finishDate?.toISOString().slice(0, 10) ?? "?"}`
      : "";
  return (
    `    Row ${rec.rowNumber}: "${rec.title}" by ${rec.authorName}${extraAutor} ` +
    `(${pp}) | ${rating} | tipo=${rec.genreName || "-"}` +
    ` | origen=${rec.origin || "-"}${dates} | año=${rec.publicationYear ?? "-"}`
  );
}

main().catch((err) => {
  console.error("\n[FATAL] Unexpected error during ingestion:", err);
  process.exit(1);
});
