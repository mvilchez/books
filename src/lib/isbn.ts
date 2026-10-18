/**
 * ISBN validation, normalization, and ISBN-10 ↔ ISBN-13 conversion.
 *
 * Pure functions with no I/O so both the client (barcode-scan prefill) and the
 * server (lookup action, book creation) share one contract. Book barcodes are
 * EAN-13 codes carrying an ISBN (978/979 prefix); plain EAN-13 product codes
 * are rejected by `toIsbn13` so a random retail barcode never reaches Open
 * Library.
 */

/** Strip hyphens, spaces, and dots; upper-case the ISBN-10 `X` check digit. */
export function normalizeIsbn(value: string): string {
  return value.replace(/[\s\-.]/g, "").toUpperCase();
}

/** ISBN-10 with a valid weighted check digit (last digit may be `X`). */
export function isValidIsbn10(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let index = 0; index < 9; index++) {
    sum += Number(isbn[index]) * (10 - index);
  }
  sum += isbn[9] === "X" ? 10 : Number(isbn[9]);
  return sum % 11 === 0;
}

/** ISBN-13 with a valid weighted check digit and a 978/979 book prefix. */
export function isValidIsbn13(value: string): boolean {
  const isbn = normalizeIsbn(value);
  if (!/^(?:978|979)\d{10}$/.test(isbn)) return false;
  let sum = 0;
  for (let index = 0; index < 12; index++) {
    sum += Number(isbn[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

/** Convert a valid ISBN-10 to its 978-prefixed ISBN-13, or `null`. */
export function isbn10ToIsbn13(value: string): string | null {
  const isbn = normalizeIsbn(value);
  if (!isValidIsbn10(isbn)) return null;
  const base = `978${isbn.slice(0, 9)}`;
  let sum = 0;
  for (let index = 0; index < 12; index++) {
    sum += Number(base[index]) * (index % 2 === 0 ? 1 : 3);
  }
  return `${base}${(10 - (sum % 10)) % 10}`;
}

/**
 * Accept a typed ISBN-10/ISBN-13 or a scanned book barcode and return the
 * canonical ISBN-13, or `null` when the input is not a valid book ISBN.
 */
export function toIsbn13(value: string): string | null {
  const isbn = normalizeIsbn(value);
  if (isValidIsbn13(isbn)) return isbn;
  if (isValidIsbn10(isbn)) return isbn10ToIsbn13(isbn);
  return null;
}