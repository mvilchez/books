/**
 * Books data-access service (PLAN.md — Encapsulation Validation).
 *
 * This module is the ONLY place where `Book`/`Author`/`Genre` queries live for
 * the application layer. Pages, route handlers, and server actions must call
 * these functions instead of touching the Prisma client directly.
 */
import { Prisma, ReadingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildLibraryBookTags, replaceBookTags } from "@/lib/book-tags";
import {
  BOOK_SEARCH_RESULT_LIMIT,
  escapeBookSearchWildcards,
  type BookSearchResult,
  type BookTagSearchResult,
} from "@/lib/book-search";

/** The dashboard's book projection: full `Book` rows plus their relations. */
export type DashboardBook = Prisma.BookGetPayload<{
  include: { author: true; genre: true };
}>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Distinct reading years present in the ledger, ascending. */
export async function getAvailableReadingYears(): Promise<
  { readingYear: number }[]
> {
  return prisma.book.findMany({
    select: { readingYear: true },
    distinct: ["readingYear"],
    orderBy: { readingYear: "asc" },
  });
}

/** All books of one reading year with author and genre included. */
export async function getBooksByReadingYear(year: number): Promise<
  DashboardBook[]
> {
  return prisma.book.findMany({
    where: { readingYear: year },
    include: { author: true, genre: true },
  });
}

/** A single book with author, genre, and attached tags — or `null`. */
export async function getBookDetail(id: string) {
  return prisma.book.findUnique({
    where: { id },
    include: {
      author: true,
      genre: true,
      tags: { include: { tag: true } },
    },
  });
}

/** Series/saga names represented by at least one library book. */
export async function getSagaList(): Promise<
  { name: string; bookCount: number; authors: string[] }[]
> {
  const books = await prisma.book.findMany({
    where: { seriesName: { not: null } },
    select: {
      seriesName: true,
      author: { select: { name: true } },
    },
    orderBy: [{ seriesName: "asc" }, { author: { name: "asc" } }],
  });
  const sagas = new Map<string, { authors: Set<string>; bookCount: number }>();
  for (const book of books) {
    const name = book.seriesName?.trim();
    if (!name) continue;
    const saga = sagas.get(name) ?? { authors: new Set<string>(), bookCount: 0 };
    saga.authors.add(book.author.name);
    saga.bookCount++;
    sagas.set(name, saga);
  }
  return [...sagas]
    .map(([name, saga]) => ({
      name,
      bookCount: saga.bookCount,
      authors: [...saga.authors].sort((left, right) =>
        left.localeCompare(right),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** All books assigned to a saga, with author and genre. */
export async function getSagaBooks(seriesName: string) {
  const books = await prisma.book.findMany({
    where: { seriesName },
    include: { author: true, genre: true },
  });
  return books.sort((left, right) => {
    if (left.seriesPosition === null) return right.seriesPosition === null ? left.title.localeCompare(right.title) : 1;
    if (right.seriesPosition === null) return -1;
    return left.seriesPosition - right.seriesPosition || left.title.localeCompare(right.title);
  });
}

/**
 * Title/author/tag search for the autocomplete endpoint. `query` must already
 * be validated (2–100 chars) by `parseBookSearchQuery`.
 */
export async function searchBooksAndTags(
  query: string,
): Promise<{ results: BookSearchResult[]; tags: BookTagSearchResult[] }> {
  const bookWhere = buildBookSearchWhere(query);
  const [books, tagRows] = await Promise.all([
    prisma.book.findMany({
      where: bookWhere,
      select: {
        id: true,
        title: true,
        readingYear: true,
        author: {
          select: {
            name: true,
            portraitUrl: true,
            portraitSourceUrl: true,
            portraitArtist: true,
            portraitLicense: true,
            portraitLicenseUrl: true,
          },
        },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: BOOK_SEARCH_RESULT_LIMIT,
    }),
    findMatchingTags(query, 5),
  ]);

  return {
    results: books.map(({ id, title, readingYear, author }) => ({
      id,
      title,
      author,
      readingYear,
    })),
    tags: tagRows,
  };
}

/** All matching books for the dedicated full search results page. */
export async function searchBooks(query: string): Promise<DashboardBook[]> {
  return prisma.book.findMany({
    where: buildBookSearchWhere(query),
    include: { author: true, genre: true },
    orderBy: [{ title: "asc" }, { id: "asc" }],
  });
}

/** All matching tags for the dedicated full search results page. */
export async function searchTags(query: string): Promise<BookTagSearchResult[]> {
  return findMatchingTags(query);
}

async function findMatchingTags(
  query: string,
  take?: number,
): Promise<BookTagSearchResult[]> {
  const escaped = escapeBookSearchWildcards(query);
  const tags = await prisma.tag.findMany({
    where: {
      name: { contains: escaped },
      books: { some: {} },
    },
    select: {
      id: true,
      name: true,
      category: true,
      _count: { select: { books: true } },
    },
    orderBy: [{ books: { _count: "desc" } }, { name: "asc" }],
    ...(take ? { take } : {}),
  });
  return tags.map(({ _count, ...tag }) => ({
    ...tag,
    bookCount: _count.books,
  }));
}

function buildBookSearchWhere(query: string): Prisma.BookWhereInput {
  const escaped = escapeBookSearchWildcards(query);
  const normalizedStatus = query.trim().toUpperCase();
  const numericValue = Number(query.trim());
  const hasNumericValue = query.trim() !== "" && Number.isFinite(numericValue);
  const dateMatch = parseSearchDate(query.trim());
  const fields: Prisma.BookWhereInput[] = [
    { id: { contains: escaped } },
    { title: { contains: escaped } },
    { editionKey: { contains: escaped } },
    { openLibraryWorkId: { contains: escaped } },
    { isbn13: { contains: escaped } },
    { bookFormat: { contains: escaped } },
    { synopsis: { contains: escaped } },
    { synopsisLanguage: { contains: escaped } },
    { synopsisSourceUrl: { contains: escaped } },
    { seriesName: { contains: escaped } },
    { origin: { contains: escaped } },
    { authorId: { contains: escaped } },
    { genreId: { contains: escaped } },
    { author: { name: { contains: escaped } } },
    { genre: { name: { contains: escaped } } },
    { tags: { some: { tag: { name: { contains: escaped } } } } },
    { tags: { some: { tag: { normalizedName: { contains: escaped } } } } },
  ];

  if (normalizedStatus in ReadingStatus) {
    fields.push({ status: normalizedStatus as ReadingStatus });
  }
  if (hasNumericValue) {
    fields.push(
      { totalPages: numericValue },
      { currentPages: numericValue },
      { readingYear: numericValue },
      { publicationYear: numericValue },
      { rating: numericValue },
      { seriesPosition: numericValue },
      { openLibraryCoverId: numericValue },
    );
  }
  if (dateMatch) {
    fields.push(
      { startDate: dateMatch },
      { finishDate: dateMatch },
      { metadataCheckedAt: dateMatch },
      { synopsisCheckedAt: dateMatch },
      { createdAt: dateMatch },
      { updatedAt: dateMatch },
    );
  }

  return { OR: fields };
}

function parseSearchDate(value: string): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) {
    return null;
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

/** Books with saved metadata but no Open Library tags (tag-gap report + CSV). */
export async function getBooksWithoutOpenLibraryTags() {
  return prisma.book.findMany({
    where: { tags: { none: { source: "OPEN_LIBRARY" } } },
    select: {
      id: true,
      title: true,
      author: { select: { name: true } },
      publicationYear: true,
      totalPages: true,
      metadataCheckedAt: true,
      genre: { select: { name: true } },
      tags: {
        where: {
          source: "LIBRARY",
          tag: { category: "SUBJECT" },
        },
        include: { tag: true },
      },
    },
    orderBy: [
      { metadataCheckedAt: "desc" },
      { author: { name: "asc" } },
      { title: "asc" },
    ],
  });
}

/** Checked books that still have possible Open Library matches to review. */
export async function getBooksWithMetadataCandidates() {
  return prisma.book.findMany({
    where: {
      metadataCheckedAt: { not: null },
      metadataCandidates: { some: {} },
    },
    select: {
      id: true,
      title: true,
      author: { select: { name: true } },
      metadataCheckedAt: true,
      metadataCandidates: {
        select: {
          id: true,
          workId: true,
          title: true,
          authorNames: true,
          subjects: true,
          firstPublishYear: true,
          titleSimilarity: true,
          authorSimilarity: true,
        },
        orderBy: [{ titleSimilarity: "desc" }, { authorSimilarity: "desc" }],
      },
    },
    orderBy: [{ author: { name: "asc" } }, { title: "asc" }],
  });
}

/** Lookup data for the recommendation action. */
export async function getBookForRecommendation(bookId: string) {
  return prisma.book.findUnique({
    where: { id: bookId },
    select: {
      title: true,
      openLibraryWorkId: true,
      author: { select: { name: true } },
    },
  });
}

/** Titles + Open Library work ids of every completed book. */
export async function getCompletedBookSummaries(): Promise<
  { title: string; openLibraryWorkId: string | null }[]
> {
  return prisma.book.findMany({
    where: { status: "COMPLETED" },
    select: { title: true, openLibraryWorkId: true },
  });
}

/** Title + author name used to search Open Library covers. */
export async function getBookCoverTarget(bookId: string) {
  return prisma.book.findUnique({
    where: { id: bookId },
    select: { title: true, author: { select: { name: true } } },
  });
}

/** Author name used to search Open Library author photos. */
export async function getBookAuthorName(bookId: string) {
  return prisma.book.findUnique({
    where: { id: bookId },
    select: { author: { select: { name: true } } },
  });
}

/** Snapshot consumed by the metadata-enrichment action. */
export async function getBookEnrichmentSnapshot(bookId: string) {
  return prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      totalPages: true,
      currentPages: true,
      publicationYear: true,
      metadataCheckedAt: true,
      openLibraryWorkId: true,
      openLibraryCoverId: true,
      isbn13: true,
      bookFormat: true,
      seriesName: true,
      seriesPosition: true,
      author: { select: { name: true } },
    },
  });
}

/** Author id owning a book (author-photo persistence). */
export async function getBookAuthorId(bookId: string) {
  return prisma.book.findUnique({
    where: { id: bookId },
    select: { authorId: true },
  });
}

/** Filters a set of ids down to the ones that exist (CSV import validation). */
export async function getExistingBookIds(
  ids: readonly string[],
): Promise<{ id: string }[]> {
  return prisma.book.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true },
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type BookDetailsInput = {
  bookId: string;
  title: string;
  authorName: string;
  genreName: string | null;
  origin: string | null;
  editionKey: string | null;
  seriesName: string | null;
  seriesPosition: number | null;
  status: ReadingStatus;
  readingYear: number;
  publicationYear: number | null;
  totalPages: number | null;
  currentPages: number;
  rating: number | null;
  startDate: Date | null;
  finishDate: Date | null;
};

/**
 * Persist edited book details. Upserts the author/genre, updates the book, and
 * rebuilds its LIBRARY tags — clearing the Open Library tags and synopsis when
 * the book's identity (title/author) changed. Throws the underlying Prisma
 * errors so the caller can map P2025/P2002 onto user-facing messages.
 */
export async function saveBookDetails(input: BookDetailsInput): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const existingBook = await transaction.book.findUnique({
      where: { id: input.bookId },
      select: { title: true, authorId: true },
    });
    const author = await transaction.author.upsert({
      where: { name: input.authorName },
      create: { name: input.authorName },
      update: {},
    });
    const identityChanged =
      existingBook !== null &&
      (existingBook.title !== input.title ||
        existingBook.authorId !== author.id);
    const genre = input.genreName
      ? await transaction.genre.upsert({
          where: { name: input.genreName },
          create: { name: input.genreName },
          update: {},
        })
      : null;

    await transaction.book.update({
      where: { id: input.bookId },
      data: {
        title: input.title,
        status: input.status,
        rating: input.rating,
        readingYear: input.readingYear,
        publicationYear: input.publicationYear,
        totalPages: input.totalPages,
        currentPages: input.currentPages,
        editionKey: input.editionKey ?? "",
        origin: input.origin || null,
        startDate: input.startDate,
        finishDate: input.finishDate,
        seriesName: input.seriesName || null,
        seriesPosition: input.seriesPosition,
        openLibraryWorkId: identityChanged ? null : undefined,
        openLibraryCoverId: identityChanged ? null : undefined,
        isbn13: identityChanged ? null : undefined,
        bookFormat: identityChanged ? null : undefined,
        metadataCheckedAt: identityChanged ? null : undefined,
        synopsis: identityChanged ? null : undefined,
        synopsisLanguage: identityChanged ? null : undefined,
        synopsisSourceUrl: identityChanged ? null : undefined,
        synopsisCheckedAt: identityChanged ? null : undefined,
        authorId: author.id,
        genreId: genre?.id ?? null,
      },
    });
    if (identityChanged) {
      await replaceBookTags(transaction, input.bookId, "OPEN_LIBRARY", []);
    }
    await replaceBookTags(
      transaction,
      input.bookId,
      "LIBRARY",
      buildLibraryBookTags(input.genreName, input.origin),
    );
  });
}

export type ReadingBookInput = {
  title: string;
  authorName: string;
  genreName: string | null;
  startDate: Date;
  totalPages: number | null;
  readingYear: number;
  seriesName?: string | null;
  seriesPosition?: number | null;
  /** Optional Open Library metadata resolved from an ISBN lookup. */
  isbn13?: string | null;
  openLibraryCoverId?: number | null;
  openLibraryWorkId?: string | null;
  publicationYear?: number | null;
};

/** Create a new READING book plus its LIBRARY tags in one transaction. */
export async function createReadingBookRecord(
  input: ReadingBookInput,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const author = await transaction.author.upsert({
      where: { name: input.authorName },
      create: { name: input.authorName },
      update: {},
    });
    const genre = input.genreName
      ? await transaction.genre.upsert({
          where: { name: input.genreName },
          create: { name: input.genreName },
          update: {},
        })
      : null;

    const book = await transaction.book.create({
      data: {
        title: input.title,
        readingYear: input.readingYear,
        startDate: input.startDate,
        totalPages: input.totalPages,
        status: "READING",
        seriesName: input.seriesName ?? null,
        seriesPosition: input.seriesPosition ?? null,
        // The `isbn:` edition key matches the importer's convention, so the
        // unique key dedupes this edition and `getBookCoverUrl` can fall back
        // to the ISBN cover when no cover id was saved.
        editionKey: input.isbn13 ? `isbn:${input.isbn13}` : "",
        isbn13: input.isbn13 ?? null,
        openLibraryCoverId: input.openLibraryCoverId ?? null,
        openLibraryWorkId: input.openLibraryWorkId ?? null,
        publicationYear: input.publicationYear ?? null,
        authorId: author.id,
        genreId: genre?.id ?? null,
      },
      select: { id: true },
    });
    await replaceBookTags(
      transaction,
      book.id,
      "LIBRARY",
      buildLibraryBookTags(input.genreName, null),
    );
  });
}

/** Start an existing wishlist entry as a saga book. */
export async function startSagaWishlistBook(
  bookId: string,
  seriesName: string,
  startDate: Date,
): Promise<boolean> {
  const result = await prisma.book.updateMany({
    where: {
      id: bookId,
      seriesName,
      status: { in: ["PENDING", "WISH_LIST"] },
    },
    data: {
      status: "READING",
      startDate,
      finishDate: null,
      readingYear: startDate.getUTCFullYear(),
      currentPages: 0,
      rating: null,
    },
  });
  return result.count > 0;
}

/** Create a PENDING (wishlist) book for the given reading year. */
export async function createPendingBookRecord(input: {
  title: string;
  authorName: string;
  readingYear: number;
}): Promise<string> {
  return prisma.$transaction(async (transaction) => {
    const author = await transaction.author.upsert({
      where: { name: input.authorName },
      create: { name: input.authorName },
      update: {},
    });
    const book = await transaction.book.create({
      data: {
        title: input.title,
        readingYear: input.readingYear,
        status: "PENDING",
        authorId: author.id,
      },
      select: { id: true },
    });
    await replaceBookTags(transaction, book.id, "LIBRARY", []);
    return book.id;
  });
}

/** Delete a book by id. `deleted` is false when it was already gone. */
export async function deleteBookById(
  bookId: string,
): Promise<{ deleted: boolean }> {
  const result = await prisma.book.deleteMany({ where: { id: bookId } });
  return { deleted: result.count > 0 };
}

/** Mark a book as being read again, clearing finish date and rating. */
export async function setBookStillReadingRecord(bookId: string): Promise<{
  status: string;
  finishDate: Date | null;
  rating: number | null;
}> {
  return prisma.book.update({
    where: { id: bookId },
    data: { status: "READING", finishDate: null, rating: null },
    select: { status: true, finishDate: true, rating: true },
  });
}

/**
 * Advance reading progress, clamped to `[0, totalPages]`. `totalPages` is
 * nullable for pre-2014 rows: an unknown ceiling only clamps at 0.
 */
export async function setBookProgressPages(
  bookId: string,
  nextPages: number,
): Promise<void> {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { totalPages: true },
  });
  if (!book) {
    throw new Error(`updateBookProgress: book ${bookId} not found.`);
  }

  const rounded = Math.round(nextPages);
  const ceiling = book.totalPages ?? Number.MAX_SAFE_INTEGER;
  const currentPages = Math.min(Math.max(rounded, 0), ceiling);

  await prisma.book.update({
    where: { id: bookId },
    data: { currentPages },
  });
}

/**
 * Complete a READING book with a rating. Returns how many rows changed — 0
 * means the book was missing or no longer being read.
 */
export async function completeBookRecord(
  bookId: string,
  rating: number,
  finishDate: Date,
): Promise<{ count: number }> {
  return prisma.book.updateMany({
    where: { id: bookId, status: "READING" },
    data: { status: "COMPLETED", finishDate, rating },
  });
}

/** Save the selected Open Library cover/work ids on a book. */
export async function saveBookCoverSelection(
  bookId: string,
  workId: string,
  coverId: number,
): Promise<void> {
  await prisma.book.update({
    where: { id: bookId },
    data: {
      openLibraryWorkId: workId,
      openLibraryCoverId: coverId,
    },
  });
}

/** Persist a verified author photo, replacing any previous portrait data. */
export async function updateAuthorPortrait(
  authorId: string,
  photoUrl: string,
  sourceUrl: string,
): Promise<void> {
  await prisma.author.update({
    where: { id: authorId },
    data: {
      wikidataId: null,
      portraitUrl: photoUrl,
      portraitSourceUrl: sourceUrl,
      portraitArtist: null,
      portraitLicense: null,
      portraitLicenseUrl: null,
    },
  });
}
