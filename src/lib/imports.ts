/**
 * Workbook import persistence service (PLAN.md — Encapsulation Validation).
 *
 * The HTTP layer parses and validates the upload, then hands the parsed
 * workbook to `importWorkbookBooks`, which writes everything in ONE Prisma
 * interactive transaction (atomic: every valid row lands or nothing does).
 */
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildLibraryBookTags, replaceManyBookTags } from "@/lib/book-tags";
import {
  editionKeyFromMetadata,
  normalize,
  PRE_TAB_READING_YEAR_SENTINEL,
  type ParsedBook,
  type ParsedWorkbook,
} from "@/lib/ingestion/workbook-parser";

/** The transactional client handed to a Prisma interactive transaction callback. */
type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

interface LegacyBook {
  id: string;
  title: string;
  authorId: string;
  readingYear: number;
  publicationYear: number | null;
  totalPages: number | null;
}

/**
 * Bulk imports can far exceed the 5s default transaction budget: an ~812-row
 * workbook performs over 1,200 round-trips. Raise both the Prisma transaction
 * budget and the platform execution limit well above that.
 */
const PRISMA_TRANSACTION_TIMEOUT_MS = 120_000;
const PRISMA_TRANSACTION_MAX_WAIT_MS = 15_000;

/** Type guard that narrows `string | null` for the genre-name set. */
function isPresent(value: string | null): value is string {
  return typeof value === "string" && value.trim() !== "";
}

const KEY_SEPARATOR = String.fromCharCode(0);

function legacyEditionLookupKey(
  title: string,
  authorId: string,
  readingYear: number,
  editionKey: string,
): string {
  return [normalize(title), authorId, readingYear, editionKey].join(
    KEY_SEPARATOR,
  );
}

/**
 * Upsert one parsed row onto the relational schema.
 *
 * `readingYear` is NOT NULL and part of the composite unique key, but the
 * "Leidos antes" tab has no year in its name. That pre-2008 back-catalogue is
 * preserved via a documented sentinel year rather than being silently dropped.
 */
async function persistBook(
  tx: PrismaTransactionClient,
  book: ParsedBook,
  authorIds: Map<string, string>,
  genreIds: Map<string, string>,
  legacyBooks: Map<string, LegacyBook[]>,
  userId: string,
): Promise<string> {
  const authorId = authorIds.get(book.authorName);
  if (!authorId) {
    throw new Error(
      `Author "${book.authorName}" was not resolved before persisting its books.`,
    );
  }

  const readingYear = book.readingYear ?? PRE_TAB_READING_YEAR_SENTINEL;
  const genreName = book.genreName?.trim() || null;
  const genreId = genreName ? (genreIds.get(genreName) ?? null) : null;
  const legacyKey = legacyEditionLookupKey(
    book.title,
    authorId,
    readingYear,
    editionKeyFromMetadata(book.publicationYear, book.totalPages),
  );
  const legacyMatch = legacyBooks.get(legacyKey)?.shift();

  // Both branches carry identical field values; this natural key makes
  // re-imports idempotent without merging rereads or distinct editions.
  const fields = {
    totalPages: book.totalPages,
    rating: book.rating,
    publicationYear: book.publicationYear,
    editionKey: book.editionKey,
    origin: book.origin,
    startDate: book.startDate,
    finishDate: book.finishDate,
    genreId,
    status: book.finishDate ? "COMPLETED" : "READING",
  } as const;

  if (legacyMatch) {
    const updatedBook = await tx.book.update({
      where: { id: legacyMatch.id },
      data: fields,
      select: { id: true },
    });
    return updatedBook.id;
  }

  const savedBook = await tx.book.upsert({
    where: {
      title_authorId_readingYear_editionKey: {
        title: book.title,
        authorId,
        readingYear,
        editionKey: book.editionKey,
      },
    },
    update: fields,
    create: { ...fields, title: book.title, readingYear, authorId, userId },
    select: { id: true },
  });
  return savedBook.id;
}

export type WorkbookImportResult = {
  created: number;
  updated: number;
  authors: { total: number; created: number };
  genres: { total: number; created: number };
  backfilledReadingYear: number;
};

/**
 * Persist every parsed workbook row atomically. Throws on any failure so the
 * caller can report the rollback; nothing is written unless everything is.
 */
export async function importWorkbookBooks(
  workbook: ParsedWorkbook,
): Promise<WorkbookImportResult> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;
  const authorIds = new Map<string, string>();
  const genreIds = new Map<string, string>();
  const authorsBefore = await prisma.author.count();
  const genresBefore = await prisma.genre.count();
  const booksBefore = await prisma.book.count({ where: { userId } });
  let backfilledReadingYear = 0;

  await prisma.$transaction(
    async (tx) => {
      // Authors — upsert each UNIQUE name once, then reuse the id.
      for (const name of new Set(workbook.books.map((b) => b.authorName))) {
        const author = await tx.author.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        authorIds.set(name, author.id);
      }

      // Genres — derived from the "Tipo" column; untyped rows stay NULL.
      for (const name of new Set(
        workbook.books.map((b) => b.genreName).filter(isPresent),
      )) {
        const genre = await tx.genre.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        genreIds.set(name, genre.id);
      }

      // Upgrade existing rows written before edition fingerprints were added.
      const legacyBooks = new Map<string, LegacyBook[]>();
      const legacyRows = await tx.book.findMany({
        where: { userId, editionKey: "" },
        select: {
          id: true,
          title: true,
          authorId: true,
          readingYear: true,
          publicationYear: true,
          totalPages: true,
        },
      });
      for (const legacyBook of legacyRows) {
        const key = legacyEditionLookupKey(
          legacyBook.title,
          legacyBook.authorId,
          legacyBook.readingYear,
          editionKeyFromMetadata(legacyBook.publicationYear, legacyBook.totalPages),
        );
        legacyBooks.set(key, [...(legacyBooks.get(key) ?? []), legacyBook]);
      }

      // Books — upsert on title, author, reading year, and edition.
      const importedBookTags: {
        bookId: string;
        tags: ReturnType<typeof buildLibraryBookTags>;
      }[] = [];
      for (const book of workbook.books) {
        const bookId = await persistBook(tx, book, authorIds, genreIds, legacyBooks, userId);
        importedBookTags.push({
          bookId,
          tags: buildLibraryBookTags(book.genreName, book.origin),
        });
        if (book.readingYear === null) backfilledReadingYear++;
      }
      await replaceManyBookTags(tx, importedBookTags, "LIBRARY");
    },
    { timeout: PRISMA_TRANSACTION_TIMEOUT_MS, maxWait: PRISMA_TRANSACTION_MAX_WAIT_MS },
  );

  // created = net row growth, updated = the remainder. Two COUNT queries beat
  // per-row existence checks just to label each row.
  const created = (await prisma.book.count({ where: { userId } })) - booksBefore;
  return {
    created,
    updated: workbook.books.length - created,
    authors: {
      total: authorIds.size,
      created: (await prisma.author.count()) - authorsBefore,
    },
    genres: {
      total: genreIds.size,
      created: (await prisma.genre.count()) - genresBefore,
    },
    backfilledReadingYear,
  };
}

