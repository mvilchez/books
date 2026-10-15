export const BOOK_SEARCH_MAX_LENGTH = 100;
export const BOOK_SEARCH_MIN_LENGTH = 2;
export const BOOK_SEARCH_RESULT_LIMIT = 8;

export type BookSearchResult = {
  id: string;
  title: string;
  author: {
    name: string;
    portraitUrl: string | null;
    portraitSourceUrl: string | null;
    portraitArtist: string | null;
    portraitLicense: string | null;
    portraitLicenseUrl: string | null;
  };
  readingYear: number;
};

export type ParsedBookSearchQuery =
  | { valid: true; query: string }
  | { valid: false; reason: "missing" | "repeated" | "too_short" | "too_long" };

export function parseBookSearchQuery(values: string[]): ParsedBookSearchQuery {
  if (values.length === 0) return { valid: false, reason: "missing" };
  if (values.length !== 1) return { valid: false, reason: "repeated" };
  const query = values[0].trim();
  if (query.length < BOOK_SEARCH_MIN_LENGTH) {
    return { valid: false, reason: "too_short" };
  }
  if (query.length > BOOK_SEARCH_MAX_LENGTH) {
    return { valid: false, reason: "too_long" };
  }
  return { valid: true, query };
}

export function escapeBookSearchWildcards(query: string): string {
  return query.replace(/[\\%_]/g, "\\$&");
}

export function isBookSearchResults(value: unknown): value is BookSearchResult[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof item.id === "string" &&
        "title" in item &&
        typeof item.title === "string" &&
        "author" in item &&
        typeof item.author === "object" &&
        item.author !== null &&
        "name" in item.author &&
        typeof item.author.name === "string" &&
        "portraitUrl" in item.author &&
        (typeof item.author.portraitUrl === "string" ||
          item.author.portraitUrl === null) &&
        "portraitSourceUrl" in item.author &&
        (typeof item.author.portraitSourceUrl === "string" ||
          item.author.portraitSourceUrl === null) &&
        "portraitArtist" in item.author &&
        (typeof item.author.portraitArtist === "string" ||
          item.author.portraitArtist === null) &&
        "portraitLicense" in item.author &&
        (typeof item.author.portraitLicense === "string" ||
          item.author.portraitLicense === null) &&
        "portraitLicenseUrl" in item.author &&
        (typeof item.author.portraitLicenseUrl === "string" ||
          item.author.portraitLicenseUrl === null) &&
        "readingYear" in item &&
        typeof item.readingYear === "number",
    )
  );
}
