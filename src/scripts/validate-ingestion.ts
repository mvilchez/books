import path from "node:path";
import fs from "node:fs";
import ExcelJS from "exceljs";

/**
 * Step 1.2 — Ingestion Sandbox (CLI Engine) · MULTI-TAB
 *
 * A decoupled, browser-free Node utility that parses a multi-tab reading
 * spreadsheet and proves the ingestion layer can read the real source schema
 * with zero telemetry failures. Read-only proof-of-concept: NO database work.
 *
 * Real source columns (by header name, matched tolerantly):
 *   Titulo · Autor · Origen · Fecha Inicio · Fecha Fin · Paginas · Tipo ·
 *   Puntuación (del 1 al 10) · Num leídos · Autor (duplicate) · Año
 *
 * Tab selection: a sheet is treated as a "read books" tab when its name starts
 * with "Leidos/Leídos" (diacritic-insensitive). The reading year is taken from
 * the tab name (e.g. "Leídos 2013" -> 2013); historical tabs have no Año column.
 * The optional "Año" column, when present, holds the book's PUBLICATION year.
 * Non-read tabs (Pendientes, Descartados, kindle, Proxima Visita, Gráficos)
 * are skipped and reported.
 *
 * Run:  npm run validate:ingestion [optionalPath]
 */

const SOURCE_PATH =
  process.argv[2] ??
  process.env.INGESTION_SOURCE ??
  path.resolve(process.cwd(), "telemetry_sandbox", "source.xlsx");

/** A data tab is recognised by this prefix in its (normalised) sheet name. */
const READ_SHEET_PREFIX = "leidos";

/** Core columns every read tab MUST expose (by normalised header name). */
const CORE_HEADERS = ["titulo", "autor", "paginas"] as const;

/**
 * Footer / summary-row labels that appear at the bottom of the yearly tabs and
 * are NOT books (e.g. "Libros Leídos", "Estadísticas", aggregate rows). Matched
 * against the normalised title; an empty title is also treated as a footer.
 */
const FOOTER_TITLES = new Set([
  "estadisticas",
  "libros leidos",
  "media paginas por libro",
  "autor mas leido",
  "tipo mas leido",
  "[object object]",
  "libros leidos.",
]);

interface BookRecord {
  sheet: string;
  readingYear: number | null;
  rowNumber: number;
  titulo: string;
  autor: string;
  autoresExtra: string[];
  paginas: number | null;
  puntuacion: number | null;
  anoPublicacion: number | null;
  origen: string;
  fechaInicio: string;
  fechaFin: string;
  tipo: string;
  numLeidos: string;
  extras: Record<string, string>;
}

interface SheetResult {
  sheet: string;
  readingYear: number | null;
  matched: boolean;
  skipReason?: string;
  headers: string[];
  rowCount: number;
  footerRows: number;
  records: BookRecord[];
  errors: string[];
}

const results: SheetResult[] = [];

/** Normalise a header/label for tolerant matching (strip diacritics, casing, spaces). */
function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const UNRATED_TOKENS = new Set(["", "-", "--", "\u2014", "n/a", "na", "s/c", "0"]);

/** Coerce any ExcelJS cell value into a trimmed string (Date -> ISO date). */
function cellToText(value: ExcelJS.CellValue | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const obj = value as {
      text?: unknown;
      richText?: Array<{ text?: string }>;
      result?: unknown;
      error?: unknown;
    };
    if (typeof obj.text === "string") return obj.text.trim();
    // Rich-text runs: concatenate every run's text (fixes "[object Object]").
    if (Array.isArray(obj.richText)) {
      return obj.richText.map((r) => r.text ?? "").join("").trim();
    }
    if (obj.result instanceof Date) {
      return Number.isNaN(obj.result.getTime()) ? "" : obj.result.toISOString().slice(0, 10);
    }
    if (typeof obj.result === "number") return String(obj.result);
    if (typeof obj.result === "string") return obj.result.trim();
    if (typeof obj.error === "string") return obj.error;
    return String(value).trim();
  }
  return String(value).trim();
}

/** Coerce a cell into a finite integer, `null` when blank, or `NaN` when non-numeric. */
function cellToInt(value: ExcelJS.CellValue | null | undefined): number | null {
  const text = cellToText(value);
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

/** Parse the rating cell on a 1–10 scale, PRESERVING decimals (e.g. 8.5). */
function cellToRating(value: ExcelJS.CellValue | null | undefined): number | null {
  const text = normalize(cellToText(value));
  if (UNRATED_TOKENS.has(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Build a map of normalised-header -> column index from the first row.
 * Handles DUPLICATE headers (e.g. two "Autor" columns) by collecting all their
 * column indices into an array, so callers can read every occurrence.
 */
function buildHeaderMap(headerRow: ExcelJS.Row): Map<string, number[]> {
  const map = new Map<string, number[]>();
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const key = normalize(cell.text);
    if (key === "") return;
    const existing = map.get(key);
    if (existing) existing.push(colNumber);
    else map.set(key, [colNumber]);
  });
  return map;
}

/** True when the sheet name marks it as a read-books tab. */
function isReadSheet(sheetName: string): boolean {
  return normalize(sheetName).startsWith(READ_SHEET_PREFIX);
}

/** Extract the 4-digit reading year from a tab name like "Leídos 2013"; else null. */
function yearFromSheetName(sheetName: string): number | null {
  const match = sheetName.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

/** Read a column by header key, returning the first occurrence's text. */
function colText(
  row: ExcelJS.Row,
  headerMap: Map<string, number[]>,
  key: string,
): string {
  const cols = headerMap.get(key);
  if (!cols || cols.length === 0) return "";
  return cellToText(row.getCell(cols[0]).value);
}

/**
 * Safely read a cell's value by 1-based column index. Returns null when the
 * column does not exist (index <= 0), avoiding ExcelJS's "out of bounds" throw
 * for sheets that lack a given optional column (e.g. no "ano" column).
 */
function cellValueAt(row: ExcelJS.Row, colNumber: number | undefined): ExcelJS.CellValue | null {
  if (colNumber === undefined || colNumber < 1) return null;
  return row.getCell(colNumber).value;
}

/** Parse a single worksheet into records + validation errors. */
function parseSheet(worksheet: ExcelJS.Worksheet): SheetResult {
  const sheetName = worksheet.name;
  const result: SheetResult = {
    sheet: sheetName,
    readingYear: yearFromSheetName(sheetName),
    matched: false,
    headers: [],
    rowCount: worksheet.rowCount,
    footerRows: 0,
    records: [],
    errors: [],
  };

  if (!isReadSheet(sheetName)) {
    result.skipReason = "tab name is not a 'Leidos/Leídos' read tab";
    return result;
  }

  const headerRow = worksheet.getRow(1);
  if (!headerRow || headerRow.cellCount === 0) {
    result.skipReason = "no header row found";
    return result;
  }

  const headerMap = buildHeaderMap(headerRow);
  result.headers = [...headerMap.keys()];

  // Verify the required core columns exist (by header name).
  const missing = CORE_HEADERS.filter((h) => !headerMap.has(h));
  if (missing.length > 0) {
    result.skipReason = `missing required column(s): ${missing.join(", ")}`;
    return result;
  }

  result.matched = true;

  // Read duplicate "Autor" columns (primary + any extras).
  const autorCols = headerMap.get("autor") ?? [];
  const ratingKey = headerMap.has("puntuacion (del 1 al 10)")
    ? "puntuacion (del 1 al 10)"
    : [...headerMap.keys()].find((k) => k.startsWith("puntuacion")) ?? "";

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const titulo = colText(row, headerMap, "titulo");
    const autor = colText(row, headerMap, "autor");
    const autoresExtra = autorCols
      .slice(1)
      .map((c) => cellToText(cellValueAt(row, c)))
      .filter((t) => t !== "");
    const paginasRaw = colText(row, headerMap, "paginas");
    const paginas = paginasRaw === "" ? null : Number(paginasRaw);
    const puntuacion = ratingKey
      ? cellToRating(cellValueAt(row, headerMap.get(ratingKey)?.[0]))
      : null;
    const anoPublicacion = cellToInt(cellValueAt(row, headerMap.get("ano")?.[0]));

    const normTitulo = normalize(titulo);

    // Skip footer / summary rows (aggregate stats at the bottom of each tab):
    // an empty title, or a known stats label. These are not books.
    if (normTitulo === "" || FOOTER_TITLES.has(normTitulo)) {
      result.footerRows++;
      return;
    }

    // Skip rows that are entirely blank apart from the title.
    if (autor === "" && paginasRaw === "" && puntuacion === null) {
      result.footerRows++;
      return;
    }

    const rowErrors: string[] = [];
    if (autor === "") rowErrors.push("missing 'autor'");
    // paginas may be legitimately null in historical tabs (data gap) — allow it,
    // but reject non-numeric text or negative values.
    if (paginas !== null && (!Number.isInteger(paginas) || paginas < 0)) {
      rowErrors.push(`'paginas' must be a non-negative integer or empty (got "${paginasRaw}")`);
    }
    if (puntuacion !== null && (Number.isNaN(puntuacion) || puntuacion < 0 || puntuacion > 10)) {
      rowErrors.push(`'puntuacion' must be 0–10 or empty (got "${colText(row, headerMap, ratingKey)}")`);
    }

    if (rowErrors.length > 0) {
      result.errors.push(`Row ${rowNumber}: ${rowErrors.join("; ")}`);
      return;
    }

    const extras: Record<string, string> = {};
    for (const [key, cols] of headerMap) {
      if (key === "titulo" || key === "autor" || key === "paginas") continue;
      if (key === ratingKey) continue;
      extras[key] = cellToText(row.getCell(cols[0]).value);
    }

    result.records.push({
      sheet: sheetName,
      readingYear: result.readingYear,
      rowNumber,
      titulo,
      autor,
      autoresExtra,
      paginas,
      puntuacion,
      anoPublicacion,
      origen: colText(row, headerMap, "origen"),
      fechaInicio: colText(row, headerMap, "fecha inicio"),
      fechaFin: colText(row, headerMap, "fecha fin"),
      tipo: colText(row, headerMap, "tipo"),
      numLeidos: colText(row, headerMap, "num leidos"),
      extras,
    });
  });

  return result;
}

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

  for (const worksheet of workbook.worksheets) {
    results.push(parseSheet(worksheet));
  }

  // --- Per-tab report ---
  for (const r of results) {
    if (!r.matched) {
      console.log(`[skip] "${r.sheet}" — ${r.skipReason}`);
      continue;
    }
    const yearLabel = r.readingYear ?? "?";
    console.log(
      `[read] "${r.sheet}" (year ${yearLabel}) — ${r.records.length} records, ` +
        `${r.errors.length} error(s), ${r.footerRows} footer row(s) skipped, cols=[${r.headers.join(", ")}]`,
    );
    for (const rec of r.records) {
      const rating = rec.puntuacion === null ? "unrated" : `${rec.puntuacion}/10`;
      const pp = rec.paginas === null ? "? pp" : `${rec.paginas} pp`;
      const extraAutor = rec.autoresExtra.length ? ` (+${rec.autoresExtra.length} autor col)` : "";
      console.log(
        `    Row ${rec.rowNumber}: "${rec.titulo}" by ${rec.autor}${extraAutor} ` +
          `(${pp}) | ${rating} | tipo=${rec.tipo || "-"} | año=${rec.anoPublicacion ?? "-"}`,
      );
    }
    for (const e of r.errors) console.log(`    ! ${e}`);
  }

  // --- Global summary ---
  const matched = results.filter((r) => r.matched);
  const allRecords = matched.flatMap((r) => r.records);
  const allErrors = results.reduce((n, r) => n + r.errors.length, 0);
  const allFooters = matched.reduce((n, r) => n + r.footerRows, 0);
  const totalPages = allRecords.reduce((s, b) => s + (b.paginas ?? 0), 0);
  const withPages = allRecords.filter((b) => b.paginas !== null).length;
  const rated = allRecords.filter((b) => b.puntuacion !== null);
  const avgRating =
    rated.length > 0
      ? (rated.reduce((s, b) => s + (b.puntuacion ?? 0), 0) / rated.length).toFixed(2)
      : "n/a";

  console.log("\n====================================================");
  console.log("INGESTION SUMMARY (all tabs)");
  console.log("====================================================");
  console.log(`Worksheets total    : ${results.length}`);
  console.log(`Worksheets matched  : ${matched.length}`);
  console.log(`Worksheets skipped  : ${results.length - matched.length}`);
  console.log(`Records parsed      : ${allRecords.length}`);
  console.log(`  · with page count : ${withPages}`);
  console.log(`Footer rows skipped : ${allFooters}`);
  console.log(`Validation errors   : ${allErrors}`);
  console.log(`Total pages         : ${totalPages}`);
  console.log(`Rated books         : ${rated.length} (avg ${avgRating}/10)`);

  const uniqueAuthors = new Set(allRecords.map((b) => b.autor)).size;
  console.log(`Unique authors      : ${uniqueAuthors}`);

  if (allRecords.length === 0) {
    console.log("\n[WARN] No valid records parsed from any read tab.");
    process.exit(1);
  }
  console.log("\n[OK] Multi-tab ingestion validation completed successfully.");
}

main().catch((err) => {
  console.error("\n[FATAL] Unexpected error during ingestion:", err);
  process.exit(1);
});
