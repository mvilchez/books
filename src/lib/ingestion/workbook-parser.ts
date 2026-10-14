import ExcelJS from "exceljs";

/**
 * Shared multi-tab workbook parser — Step 1.2 (sandbox) + Step 2.3 (import route)
 *
 * Single source of truth for turning the legacy reading ledger into typed rows.
 * Both the read-only CLI sandbox (`src/scripts/validate-ingestion.ts`) and the
 * transactional import route (`src/app/api/v1/import/route.ts`) call into this
 * module, so the parsing contract can never drift between them.
 *
 * Source contract (see CONTEXT.md §3):
 *   · Only tabs whose name starts with "Leidos/Leídos" hold read books. Other
 *     tabs (Pendientes, Descartados, kindle, Proxima Visita, Gráficos) are skipped.
 *   · Row 1 is a header row; data starts at row 2. Footer/summary rows at the
 *     bottom of each tab ("Libros Leídos", "Estadísticas", aggregates) are NOT books.
 *   · Columns are matched BY HEADER NAME (diacritic/case/space-insensitive) and
 *     never by fixed position, because the column set varies per tab and
 *     "Autor" appears twice on some tabs.
 *
 * This module is pure parsing: it touches no database and performs no persistence
 * policy. Mapping parsed rows onto the relational schema is the caller's job.
 */

/** A data tab is recognised by this prefix in its (normalised) sheet name. */
export const READ_SHEET_PREFIX = "leidos";

/** Core columns every read tab MUST expose (by normalised header name). */
export const CORE_HEADERS = ["titulo", "autor", "paginas"] as const;

/**
 * `Book.readingYear` is NOT NULL and part of the composite unique key, but the
 * "Leidos antes" tab carries no year in its name. Rather than silently dropping
 * that pre-2008 back-catalogue (data loss) or crashing on NULL, callers apply
 * this documented sentinel: the last year BEFORE the first yearly tab (2008).
 */
export const PRE_TAB_READING_YEAR_SENTINEL = 2007;

/**
 * Footer / summary-row labels that appear at the bottom of the yearly tabs and
 * are NOT books (e.g. "Libros Leídos", "Estadísticas", aggregate rows). Matched
 * against the normalised title; an empty title is also treated as a footer.
 */
export const FOOTER_TITLES = new Set([
  "estadisticas",
  "libros leidos",
  "media paginas por libro",
  "autor mas leido",
  "tipo mas leido",
  "[object object]",
  "libros leidos.",
]);
/** A single parsed ledger row, normalised and validated. */
export interface ParsedBook {
  /** Sheet the row came from. */
  sheetName: string;
  /** Reading year from the tab name, or `null` for the "Leidos antes" back-catalogue. */
  readingYear: number | null;
  /** 1-based worksheet row number (useful for error reporting back to the user). */
  rowNumber: number;
  title: string;
  /** Primary author (first "Autor" column). */
  authorName: string;
  /** Any additional "Autor" columns present on the tab. */
  extraAuthors: string[];
  /** Total pages — nullable: many pre-2014 rows have no page count. */
  totalPages: number | null;
  /** Decimal rating on the 0–10 scale, or `null` when unrated. */
  rating: number | null;
  /** Publication year from the optional "Año" column (NOT the reading year). */
  publicationYear: number | null;
  /** "Origen" column, or `null` when absent/empty. */
  origin: string | null;
  /** "Fecha Inicio" column as a UTC-midnight Date, or `null`. */
  startDate: Date | null;
  /** "Fecha Fin" column as a UTC-midnight Date, or `null`. */
  finishDate: Date | null;
  /** "Tipo" column — the loose genre label, or `null` when absent/empty. */
  genreName: string | null;
  /** Every remaining column, keyed by normalised header name. */
  extras: Record<string, string>;
}

/** Per-worksheet parse outcome. */
export interface ParsedSheet {
  name: string;
  /** `true` when the tab was recognised as a read-books tab with a usable header. */
  matched: boolean;
  /** Why a tab was not matched, when `matched` is `false`. */
  skipReason?: string;
  readingYear: number | null;
  headers: string[];
  rowCount: number;
  footerRows: number;
  books: ParsedBook[];
  /** Row-level validation failures, formatted as `Row <n>: <reason>`. */
  errors: string[];
}

/** Whole-workbook parse outcome. */
export interface ParsedWorkbook {
  sheets: ParsedSheet[];
  matchedSheets: ParsedSheet[];
  skippedSheets: ParsedSheet[];
  books: ParsedBook[];
  /** Every validation error, prefixed with its sheet name. */
  errors: string[];
  totals: {
    worksheets: number;
    matched: number;
    skipped: number;
    rows: number;
    footerRows: number;
    uniqueAuthors: number;
    totalPages: number;
    ratedBooks: number;
    averageRating: number | null;
    rowsWithoutPages: number;
  };
}


/** Tokens that mean "no rating recorded" in the `Puntuación (del 1 al 10)` column. */
export const UNRATED_TOKENS = new Set(["", "-", "--", "\u2014", "n/a", "na", "s/c", "0"]);

/** Normalise a header/label for tolerant matching (strip diacritics, casing, spaces). */
export function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Coerce any ExcelJS cell value into a trimmed string (Date -> ISO date). */
export function cellToText(value: ExcelJS.CellValue | null | undefined): string {
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
export function cellToInt(value: ExcelJS.CellValue | null | undefined): number | null {
  const text = cellToText(value);
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

/** Parse the rating cell on a 1–10 scale, PRESERVING decimals (e.g. 8.5). */
export function cellToRating(value: ExcelJS.CellValue | null | undefined): number | null {
  const text = normalize(cellToText(value));
  if (UNRATED_TOKENS.has(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** ISO `YYYY-MM-DD` shape, as produced by `cellToText` for date cells. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Coerce a date cell into a UTC-midnight `Date`, or `null`.
 *
 * MariaDB `DATETIME` columns store no timezone, so every date is pinned to
 * `T00:00:00.000Z`. That keeps imported values timezone-independent instead of
 * shifting a day depending on the server's local offset.
 */
export function cellToDate(value: ExcelJS.CellValue | null | undefined): Date | null {
  const text = cellToText(value);
  if (!ISO_DATE.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Build a map of normalised-header -> column index from the first row.
 * Handles DUPLICATE headers (e.g. two "Autor" columns) by collecting all their
 * column indices into an array, so callers can read every occurrence.
 */
export function buildHeaderMap(headerRow: ExcelJS.Row): Map<string, number[]> {
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
export function isReadSheet(sheetName: string): boolean {
  return normalize(sheetName).startsWith(READ_SHEET_PREFIX);
}

/** Extract the 4-digit reading year from a tab name like "Leídos 2013"; else null. */
export function yearFromSheetName(sheetName: string): number | null {
  const match = sheetName.match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

/** Read a column by header key, returning the first occurrence's text. */
export function colText(row: ExcelJS.Row, headerMap: Map<string, number[]>, key: string): string {
  const cols = headerMap.get(key);
  if (!cols || cols.length === 0) return "";
  return cellToText(row.getCell(cols[0]).value);
}

/**
 * Safely read a cell's value by 1-based column index. Returns null when the
 * column does not exist (index <= 0), avoiding ExcelJS's "out of bounds" throw
 * for sheets that lack a given optional column (e.g. no "ano" column).
 */
export function cellValueAt(
  row: ExcelJS.Row,
  colNumber: number | undefined,
): ExcelJS.CellValue | null {
  if (colNumber === undefined || colNumber < 1) return null;
  return row.getCell(colNumber).value;
}

/** True when a title is blank or is a known footer/summary label. */
export function isFooterTitle(title: string): boolean {
  const normalized = normalize(title);
  return normalized === "" || FOOTER_TITLES.has(normalized);
}

/** Parse a single worksheet into validated book rows + row-level errors. */
export function parseSheet(worksheet: ExcelJS.Worksheet): ParsedSheet {
  const sheetName = worksheet.name;
  const result: ParsedSheet = {
    name: sheetName,
    matched: false,
    readingYear: yearFromSheetName(sheetName),
    headers: [],
    rowCount: worksheet.rowCount,
    footerRows: 0,
    books: [],
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
    : ([...headerMap.keys()].find((k) => k.startsWith("puntuacion")) ?? "");

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const titulo = colText(row, headerMap, "titulo");
    const autor = colText(row, headerMap, "autor");
    const extraAuthors = autorCols
      .slice(1)
      .map((c) => cellToText(cellValueAt(row, c)))
      .filter((t) => t !== "");
    const paginasRaw = colText(row, headerMap, "paginas");
    const paginas = paginasRaw === "" ? null : Number(paginasRaw);
    const puntuacion = ratingKey
      ? cellToRating(cellValueAt(row, headerMap.get(ratingKey)?.[0]))
      : null;
    const anoPublicacion = cellToInt(cellValueAt(row, headerMap.get("ano")?.[0]));

    // Skip footer / summary rows (aggregate stats at the bottom of each tab):
    // an empty title, or a known stats label. These are not books.
    if (isFooterTitle(titulo)) {
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
      rowErrors.push(
        `'puntuacion' must be 0–10 or empty (got "${colText(row, headerMap, ratingKey)}")`,
      );
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

    result.books.push({
      sheetName,
      readingYear: result.readingYear,
      rowNumber,
      title: titulo,
      authorName: autor,
      extraAuthors,
      totalPages: paginas,
      rating: puntuacion,
      publicationYear: anoPublicacion,
      origin: colText(row, headerMap, "origen") || null,
      startDate: cellToDate(cellValueAt(row, headerMap.get("fecha inicio")?.[0])),
      finishDate: cellToDate(cellValueAt(row, headerMap.get("fecha fin")?.[0])),
      genreName: colText(row, headerMap, "tipo") || null,
      extras,
    });
  });

  return result;
}

/** Parse every worksheet of an already-loaded workbook. */
export function parseWorkbook(workbook: ExcelJS.Workbook): ParsedWorkbook {
  const sheets = workbook.worksheets.map(parseSheet);
  const matchedSheets = sheets.filter((s) => s.matched);
  const skippedSheets = sheets.filter((s) => !s.matched);
  const books = matchedSheets.flatMap((s) => s.books);
  const errors = matchedSheets.flatMap((s) => s.errors.map((e) => `${s.name} — ${e}`));

  const rated = books.filter((b) => b.rating !== null);
  const averageRating =
    rated.length > 0 ? rated.reduce((sum, b) => sum + (b.rating ?? 0), 0) / rated.length : null;

  return {
    sheets,
    matchedSheets,
    skippedSheets,
    books,
    errors,
    totals: {
      worksheets: sheets.length,
      matched: matchedSheets.length,
      skipped: skippedSheets.length,
      rows: books.length,
      footerRows: matchedSheets.reduce((n, s) => n + s.footerRows, 0),
      uniqueAuthors: new Set(books.map((b) => b.authorName)).size,
      totalPages: books.reduce((sum, b) => sum + (b.totalPages ?? 0), 0),
      ratedBooks: rated.length,
      averageRating,
      rowsWithoutPages: books.filter((b) => b.totalPages === null).length,
    },
  };
}

/**
 * Load and parse a `.xlsx` buffer.
 *
 * ExcelJS cannot read legacy `.xls`/OLE2 workbooks, so a parse failure is
 * surfaced with an actionable message instead of the raw ZIP error.
 */
export async function parseWorkbookBuffer(
  input: Buffer | Uint8Array | ArrayBuffer,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  // Normalise whatever the caller holds into a Node Buffer (what JSZip expects
  // at runtime), preserving any byteOffset/byteLength window on a view.
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    // The cast is required because ExcelJS 4.4 ships an incorrect `Buffer`
    // declaration in its .d.ts (`interface Buffer extends ArrayBuffer`), which
    // shadows Node's real `Buffer`. At runtime JSZip accepts a Node Buffer.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch (err) {
    throw new Error(
      "The uploaded file could not be parsed as an .xlsx workbook. Legacy .xls/.xlsb " +
        "(OLE2) files are NOT supported — re-save the file as .xlsx first. " +
        `Underlying error: ${(err as Error).message}`,
    );
  }
  return parseWorkbook(workbook);
}
