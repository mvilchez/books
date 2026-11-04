import path from "path";
export type CoverSize = "S" | "M" | "L";

export function getBookCoverUrl(
  editionKey: string,
  openLibraryCoverId: number | null = null,
  size: CoverSize = "S",
): string | null {
  if (
    openLibraryCoverId !== null &&
    Number.isSafeInteger(openLibraryCoverId) &&
    openLibraryCoverId > 0
  ) {
    return `https://covers.openlibrary.org/b/id/${openLibraryCoverId}-${size}.jpg?default=false`;
  }

  const isbn = editionKey.match(/^isbn:([0-9a-z]{10,13})$/i)?.[1];
  if (!isbn || !/^(?:\d{9}\[\dX]|\d{13})$/i.test(isbn)) return null;

  return `https://covers.openlibrary.org/b/isbn/${isbn.toUpperCase()}-${size}.jpg?default=false`;
}

export function getLocalCoverPath(
  openLibraryCoverId: number,
  size: CoverSize = "S",
): string {
  return path.join("public", "covers", `ol${openLibraryCoverId}-${size}.webp`);
}

/**
 * Checks if a local cover file exists.
 * Note: This runs on the server side only (API routes).
 * For client-side use, rely on the API route's fallback logic.
 *
 * @deprecated Use inline fs.existsSync() in API routes instead.
 */
export function localCoverExists(
  openLibraryCoverId: number,
  size: CoverSize = "S",
): boolean {
  // Return false to avoid fs module resolution issues in Turbopack
  // The API route (cache-cover/route.ts) checks file existence inline
  return false;
}
