/**
 * Open Library series view for one saga (PLAN.md — Encapsulation
 * Validation).
 *
 * Open Library is the only external series source: Goodreads offers no
 * documented public series API, so saga data must never be scraped from
 * Goodreads (pages link out to a Goodreads search instead). This module
 * merges one cached Open Library series search with the local library so
 * the saga pages can show a representative cover plus a complete,
 * read/unread-marked installment list.
 */
import {
  openLibraryAuthorMatches,
  openLibraryTitleMatches,
  searchOpenLibrarySeriesBooksWithFallback,
  type OpenLibrarySeriesBook,
} from "@/lib/open-library-images";

/** A library book projection consumed by the saga series view. */
export type SagaLibraryBook = {
  id: string;
  title: string;
  authorName: string;
  seriesPosition: number | null;
  status: string;
  openLibraryCoverId: number | null;
};

/** One Open Library series installment annotated with library state. */
export type SagaSeriesEntry = {
  seriesPosition: number;
  title: string;
  authors: string[];
  coverId: number | null;
  firstPublishYear: number | null;
  workUrl: string;
  libraryBookId: string | null;
  libraryStatus: string | null;
  inLibrary: boolean;
  isRead: boolean;
};

export type SagaSeriesView = {
  entries: SagaSeriesEntry[];
  /** First Open Library series cover — the representative saga image. */
  representativeCoverId: number | null;
  readCount: number;
  libraryCount: number;
};

function isReadStatus(status: string): boolean {
  return status === "COMPLETED" || status === "READING";
}

/**
 * Match one Open Library series installment against local books of the same
 * saga. Position-first: both sides carry a series position (yours saved with
 * the book, theirs from Open Library), which is language-independent — this
 * is what makes Spanish library titles ("Juego de tronos") match English
 * series works ("A Game of Thrones"). Title match (which also accepts
 * edition titles) is the fallback for books without a saved position.
 */
export function matchSagaLibraryBook(
  entry: Pick<OpenLibrarySeriesBook, "title" | "authors" | "seriesPosition">,
  libraryBooks: readonly SagaLibraryBook[],
): SagaLibraryBook | null {
  const byPosition =
    libraryBooks.find(
      (book) =>
        book.seriesPosition !== null &&
        book.seriesPosition === entry.seriesPosition,
    ) ?? null;
  if (byPosition) return byPosition;
  return (
    libraryBooks.find(
      (book) =>
        openLibraryAuthorMatches(book.authorName, entry.authors) &&
        openLibraryTitleMatches(book.title, entry.title),
    ) ?? null
  );
}

/** Merge Open Library series results with local books (pure, testable). */
export function buildSagaSeriesView(
  seriesBooks: readonly OpenLibrarySeriesBook[],
  libraryBooks: readonly SagaLibraryBook[],
): SagaSeriesView {
  const entries: SagaSeriesEntry[] = seriesBooks.map((book) => {
    const match = matchSagaLibraryBook(book, libraryBooks);
    const inLibrary = match !== null;
    return {
      seriesPosition: book.seriesPosition,
      title: book.title,
      authors: book.authors,
      coverId: book.coverId ?? match?.openLibraryCoverId ?? null,
      firstPublishYear: book.firstPublishYear,
      workUrl: `https://openlibrary.org/works/${book.workId}`,
      libraryBookId: match?.id ?? null,
      libraryStatus: match?.status ?? null,
      inLibrary,
      isRead: match ? isReadStatus(match.status) : false,
    };
  });
  return {
    entries,
    representativeCoverId:
      entries.find((entry) => entry.coverId !== null)?.coverId ?? null,
    readCount: entries.filter((entry) => entry.isRead).length,
    libraryCount: entries.filter((entry) => entry.inLibrary).length,
  };
}

/**
 * Fetch the full Open Library series for a saga and merge it with local
 * books. `fallbackTitle` (usually the first local book title) is used when
 * the saga name itself is a translation Open Library does not index. Never
 * throws: on lookup failure the view is empty and the page falls back to the
 * library-only listing plus the collage cover.
 */
export async function getSagaSeriesView(
  sagaName: string,
  authorName: string,
  libraryBooks: readonly SagaLibraryBook[],
  fallbackTitle: string | null = null,
): Promise<SagaSeriesView> {
  try {
    return buildSagaSeriesView(
      await searchOpenLibrarySeriesBooksWithFallback(
        sagaName,
        authorName,
        fallbackTitle,
      ),
      libraryBooks,
    );
  } catch {
    return buildSagaSeriesView([], libraryBooks);
  }
}
