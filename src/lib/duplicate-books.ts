/** Pure helpers for finding duplicate book records. No database access here. */

/** Minimal book view used by duplicate detection. */
export type DuplicateBookSummary = {
  id: string;
  title: string;
  authorName: string;
  readingYear: number;
  totalPages: number | null;
  status: string;
};

/** One group of duplicate-looking records plus the display name of each side. */
export type DuplicateBookGroup = {
  title: string;
  authorName: string;
  bookCount: number;
  years: number[];
  books: DuplicateBookSummary[];
};

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Title key used to group records: accents, case and punctuation are folded. */
export function normalizeTitle(title: string): string {
  return normalize(title);
}

/** Author key used to group records: accents, case and punctuation are folded. */
export function normalizeAuthor(name: string): string {
  return normalize(name);
}

/**
 * Groups books sharing the same normalized title and author. Singletons are
 * dropped. Books within a group are ordered by reading year (descending) so
 * rereads in different years stay visible next to each other.
 */
export function buildDuplicateGroups(
  books: readonly DuplicateBookSummary[],
): DuplicateBookGroup[] {
  const byKey = new Map<string, DuplicateBookSummary[]>();
  for (const book of books) {
    const key = `${normalizeTitle(book.title)}|${normalizeAuthor(book.authorName)}`;
    const group = byKey.get(key);
    if (group) {
      group.push(book);
    } else {
      byKey.set(key, [book]);
    }
  }

  return [...byKey.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const ordered = [...group].sort(
        (left, right) =>
          right.readingYear - left.readingYear ||
          left.title.localeCompare(right.title),
      );
      return {
        title: ordered[0].title,
        authorName: ordered[0].authorName,
        bookCount: ordered.length,
        years: [...new Set(ordered.map((book) => book.readingYear))].sort(
          (left, right) => right - left,
        ),
        books: ordered,
      };
    })
    .sort(
      (left, right) =>
        left.authorName.localeCompare(right.authorName) ||
        left.title.localeCompare(right.title),
    );
}
