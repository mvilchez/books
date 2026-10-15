export function getBookCoverUrl(
  editionKey: string,
  openLibraryCoverId: number | null = null,
): string | null {
  if (
    openLibraryCoverId !== null &&
    Number.isSafeInteger(openLibraryCoverId) &&
    openLibraryCoverId > 0
  ) {
    return `https://covers.openlibrary.org/b/id/${openLibraryCoverId}-M.jpg?default=false`;
  }

  const isbn = editionKey.match(/^isbn:([0-9a-z]{10,13})$/i)?.[1];
  if (!isbn || !/^(?:\d{9}[\dX]|\d{13})$/i.test(isbn)) return null;

  return `https://covers.openlibrary.org/b/isbn/${isbn.toUpperCase()}-M.jpg?default=false`;
}
