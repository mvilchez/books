export function getBookCoverUrl(editionKey: string): string | null {
  const isbn = editionKey.match(/^isbn:([0-9a-z]{10,13})$/i)?.[1];
  if (!isbn || !/^(?:\d{9}[\dX]|\d{13})$/i.test(isbn)) return null;

  return `https://covers.openlibrary.org/b/isbn/${isbn.toUpperCase()}-M.jpg?default=false`;
}
