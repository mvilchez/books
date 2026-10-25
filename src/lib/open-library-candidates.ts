/**
 * Open Library metadata persistence service (PLAN.md — Encapsulation
 * Validation).
 *
 * The server actions orchestrate the external Open Library lookups; this
 * module owns every database write those lookups produce (metadata snapshot,
 * candidate rows, and applying a reviewed candidate).
 */
import { BookTagCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { replaceBookTags } from "@/lib/book-tags";
import type {
  OpenLibraryBookMetadata,
  OpenLibraryMetadataCandidate,
} from "@/lib/open-library-images";

/** Fields the enrichment action already knows about the book. */
export type EnrichmentBookSnapshot = {
  id: string;
  totalPages: number | null;
  currentPages: number;
  publicationYear: number | null;
  openLibraryWorkId: string | null;
  openLibraryCoverId: number | null;
  isbn13: string | null;
  bookFormat: string | null;
  seriesName: string | null;
  seriesPosition: number | null;
};

/**
 * Persist the outcome of one metadata lookup in a single transaction:
 * matched metadata updates the book and replaces its OPEN_LIBRARY tags;
 * an unmatched lookup clears stale candidates and stores the possible
 * matches for manual review.
 */
export async function saveOpenLibraryMetadata(
  bookId: string,
  current: EnrichmentBookSnapshot,
  metadata: OpenLibraryBookMetadata | null,
  possibleMatches: readonly OpenLibraryMetadataCandidate[],
  options: { replaceWorkLink?: boolean } = {},
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const checkedAt = new Date();
  await prisma.$transaction(
    async (transaction) => {
      await transaction.book.update({
      where: { id: bookId },
      data: {
        publicationYear: current.publicationYear ?? metadata?.firstPublishYear,
        totalPages:
          current.totalPages ??
          (metadata?.pageCount !== null &&
          metadata?.pageCount !== undefined &&
          current.currentPages <= metadata.pageCount
            ? metadata.pageCount
            : undefined),
        openLibraryWorkId: options.replaceWorkLink
          ? (metadata?.workId ?? current.openLibraryWorkId)
          : (current.openLibraryWorkId ?? metadata?.workId),
        openLibraryCoverId: options.replaceWorkLink
          ? (metadata?.coverId ?? current.openLibraryCoverId)
          : (current.openLibraryCoverId ?? metadata?.coverId),
        isbn13: current.isbn13 ?? metadata?.isbn13,
        bookFormat: current.bookFormat ?? metadata?.format,
        seriesName: current.seriesName ?? metadata?.seriesName,
        seriesPosition: current.seriesPosition ?? metadata?.seriesPosition,
        metadataCheckedAt: checkedAt,
      },
    });
    if (metadata) {
      await replaceBookTags(transaction, bookId, "OPEN_LIBRARY", [
        ...metadata.subjects.map((name) => ({
          category: BookTagCategory.SUBJECT,
          name,
        })),
        ...metadata.languages.map((name) => ({
          category: BookTagCategory.LANGUAGE,
          name,
        })),
        ...(metadata.format
          ? [{ category: BookTagCategory.FORMAT, name: metadata.format }]
          : []),
      ]);
      await transaction.bookMetadataCandidate.deleteMany({
        where: { bookId },
      });
    } else {
      await transaction.bookMetadataCandidate.deleteMany({
        where: { bookId },
      });
      if (possibleMatches.length > 0) {
        await transaction.bookMetadataCandidate.createMany({
          data: possibleMatches.map((candidate) => ({
            bookId,
            workId: candidate.workId,
            title: candidate.title,
            authorNames: JSON.stringify(candidate.authors),
            subjects: JSON.stringify(candidate.subjects),
            firstPublishYear: candidate.firstPublishYear,
            coverId: candidate.coverId,
            titleSimilarity: candidate.titleSimilarity,
            authorSimilarity: candidate.authorSimilarity,
          })),
        });
      }
    }
  }, { timeout: 30_000 });
}

/**
 * Apply a reviewed metadata candidate to its book: save the Open Library ids,
 * fill a missing publication year, replace the OPEN_LIBRARY subject tags, and
 * drop the remaining candidates. Throws when the candidate or book vanished.
 */
export async function applyOpenLibraryCandidateMatch(
  bookId: string,
  candidateId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  await prisma.$transaction(async (transaction) => {
    const candidate = await transaction.bookMetadataCandidate.findFirst({
      where: { id: candidateId, bookId },
      select: {
        workId: true,
        coverId: true,
        firstPublishYear: true,
        subjects: true,
      },
    });
    if (!candidate) throw new Error("This possible match is no longer available.");
    const book = await transaction.book.findFirst({
      where: { id: bookId, userId: user.id },
      select: {
        publicationYear: true,
        openLibraryCoverId: true,
      },
    });
    if (!book) throw new Error("Book not found.");

    let subjects: unknown;
    try {
      subjects = JSON.parse(candidate.subjects);
    } catch {
      throw new Error("The saved match has invalid subject data.");
    }
    if (
      !Array.isArray(subjects) ||
      !subjects.every((subject) => typeof subject === "string")
    ) {
      throw new Error("The saved match has invalid subject data.");
    }

    await transaction.book.update({
      where: { id: bookId },
      data: {
        openLibraryWorkId: candidate.workId,
        openLibraryCoverId: candidate.coverId ?? book.openLibraryCoverId,
        publicationYear:
          book.publicationYear ?? candidate.firstPublishYear ?? undefined,
        metadataCheckedAt: new Date(),
      },
    });
    await replaceBookTags(
      transaction,
      bookId,
      "OPEN_LIBRARY",
      subjects.map((name) => ({
        category: BookTagCategory.SUBJECT,
        name,
      })),
      BookTagCategory.SUBJECT,
    );
    await transaction.bookMetadataCandidate.deleteMany({
      where: { bookId },
    });
  }, { timeout: 30_000 });
}

