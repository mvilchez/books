export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell.length !== 0) throw new Error("Malformed CSV quoting.");
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

/**
 * Quote one CSV cell: doubles embedded quotes and prefixes a leading
 * spreadsheet formula trigger (`=`, `+`, `-`, `@`) with a tick so downloaded
 * reports stay inert when opened in Excel/LibreOffice.
 */
export function csvCell(value: string | number | null): string {
  const rawText = value === null ? "" : String(value);
  const text = /^[\s]*[=+\-@]/u.test(rawText) ? `'${rawText}` : rawText;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Build a UTF-8 BOM-prefixed, CRLF-delimited CSV document. */
export function buildCsvDocument(rows: readonly (readonly (string | number | null)[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
