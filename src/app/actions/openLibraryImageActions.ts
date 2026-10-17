"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getOpenLibraryAuthorProfile,
  getOpenLibraryAuthorPhotoUrl,
  getOpenLibraryAuthorUrl,
  getOpenLibraryWorkUrl,
  searchOpenLibraryBookLookup,
  searchOpenLibraryAuthorPhotos,
  searchOpenLibraryBooks,
  searchOpenLibraryRecommendations,
  type OpenLibraryAuthorPhotoCandidate,
  type OpenLibraryBookCandidate,
  type OpenLibraryRecommendationResult,
} from "@/lib/open-library-images";
import { BookTagCategory } from "@prisma/client";
import { replaceBookTags } from "@/lib/book-tags";

type ActionResult<T> =
  | { status: "success"; data: T; message?: string }
  | { status: "error"; message: string };

export type BookMetadataEnrichmentResult = {
  matched: boolean;
  message: string;
};

function actionError(error: unknown): string {
  return error instanceof Error ? error.message : "Open Library lookup failed.";
}

export async function findBookRecommendations(
  bookId: string,
): Promise<ActionResult<OpenLibraryRecommendationResult>> {
  if (typeof bookId !== "string" || bookId.length === 0) {
    return { status: "error", message: "Invalid book." };
  }

  let book: {
    title: string;
    openLibraryWorkId: string | null;
    author: { name: string };
  } | null;
  let readBooks: { title: string; openLibraryWorkId: string | null }[];
  try {
    [book, readBooks] = await Promise.all([
      prisma.book.findUnique({
        where: { id: bookId },
        select: {
          title: true,
          openLibraryWorkId: true,
          author: { select: { name: true } },
        },
      }),
      prisma.book.findMany({
        where: { status: "COMPLETED" },
        select: { title: true, openLibraryWorkId: true },
      }),
    ]);
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!book) return { status: "error", message: "Book not found." };

  try {
    const result = await searchOpenLibraryRecommendations(
      book.author.name,
      readBooks.map(({ title, openLibraryWorkId }) => ({
        title,
        workId: openLibraryWorkId,
      })),
      { title: book.title, workId: book.openLibraryWorkId },
    );
    return {
      status: "success",
      data: result,
      message: result.books.length
        ? `Showing unread ${result.language === "spa" ? "Spanish" : "English"} books by ${book.author.name}.`
        : `No unread Spanish or English books by ${book.author.name} were found.`,
    };
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
}

export async function searchBookCoverCandidates(
  bookId: string,
): Promise<ActionResult<OpenLibraryBookCandidate[]>> {
  if (!bookId) return { status: "error", message: "Invalid book." };
  let book: { title: string; author: { name: string } } | null;
  try {
    book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true, author: { select: { name: true } } },
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!book) return { status: "error", message: "Book not found." };

  try {
    const candidates = await searchOpenLibraryBooks(book.title, book.author.name);
    return {
      status: "success",
      data: candidates,
      message: candidates.length
        ? "Review the title, author, and cover before choosing one."
        : "Open Library found no matching book covers.",
    };
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
}

export async function searchAuthorCandidates(
  bookId: string,
): Promise<ActionResult<OpenLibraryAuthorPhotoCandidate[]>> {
  if (!bookId) return { status: "error", message: "Invalid book." };
  let book: { author: { name: string } } | null;
  try {
    book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { author: { select: { name: true } } },
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!book) return { status: "error", message: "Book not found." };

  try {
    const candidates = await searchOpenLibraryAuthorPhotos(book.author.name);
    return {
      status: "success",
      data: candidates,
      message: candidates.length
        ? "Photos are shown only for matching Open Library author records that have an image."
        : "No Open Library author photo was found among the best matching records.",
    };
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
}

export async function saveBookCover(
  bookId: string,
  workId: string,
  coverId: number,
): Promise<ActionResult<null>> {
  const sourceUrl = getOpenLibraryWorkUrl(workId);
  if (!bookId || !sourceUrl || !Number.isSafeInteger(coverId) || coverId <= 0) {
    return { status: "error", message: "Invalid Open Library cover selection." };
  }

  try {
    await prisma.book.update({
      where: { id: bookId },
      data: {
        openLibraryWorkId: workId,
        openLibraryCoverId: coverId,
      },
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", data: null, message: "Book cover saved." };
}

export async function enrichBookMetadata(
  bookId: string,
): Promise<ActionResult<BookMetadataEnrichmentResult>> {
  if (typeof bookId !== "string" || bookId.length === 0) {
    return { status: "error", message: "Invalid book." };
  }

  let book: {
    id: string;
    title: string;
    totalPages: number | null;
    currentPages: number;
    publicationYear: number | null;
    metadataCheckedAt: Date | null;
    openLibraryWorkId: string | null;
    openLibraryCoverId: number | null;
    isbn13: string | null;
    bookFormat: string | null;
    seriesName: string | null;
    seriesPosition: number | null;
    author: { name: string };
  } | null;
  try {
    book = await prisma.book.findUnique({
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
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!book) return { status: "error", message: "Book not found." };
  if (book.metadataCheckedAt) {
    return {
      status: "success",
      data: {
        matched: false,
        message: "Metadata has already been checked for this book.",
      },
    };
  }

  let lookup: Awaited<ReturnType<typeof searchOpenLibraryBookLookup>>;
  try {
    lookup = await searchOpenLibraryBookLookup(
      book.title,
      book.author.name,
      book.totalPages,
      book.publicationYear,
    );
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  const { metadata } = lookup;
  const checkedAt = new Date();
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.book.update({
        where: { id: book.id },
        data: {
          publicationYear: book.publicationYear ?? metadata?.firstPublishYear,
          totalPages:
            book.totalPages ??
            (metadata?.pageCount !== null &&
            metadata?.pageCount !== undefined &&
            book.currentPages <= metadata.pageCount
              ? metadata.pageCount
              : undefined),
          openLibraryWorkId: book.openLibraryWorkId ?? metadata?.workId,
          openLibraryCoverId: book.openLibraryCoverId ?? metadata?.coverId,
          isbn13: book.isbn13 ?? metadata?.isbn13,
          bookFormat: book.bookFormat ?? metadata?.format,
          seriesName: book.seriesName ?? metadata?.seriesName,
          seriesPosition: book.seriesPosition ?? metadata?.seriesPosition,
          metadataCheckedAt: checkedAt,
        },
      });
      if (metadata) {
        await replaceBookTags(transaction, book.id, "OPEN_LIBRARY", [
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
            where: { bookId: book.id },
        });
      } else {
        await transaction.bookMetadataCandidate.deleteMany({
            where: { bookId: book.id },
        });
        if (lookup.possibleMatches.length > 0) {
            await transaction.bookMetadataCandidate.createMany({
              data: lookup.possibleMatches.map((candidate) => ({
                bookId: book.id,
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
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return {
    status: "success",
    data: {
      matched: metadata !== null,
      message: metadata
        ? "Book metadata was matched and saved from Open Library."
        : "No exact title-and-author match was found; no external metadata was applied.",
    },
  };
}

export async function applyOpenLibraryCandidate(
  bookId: string,
  candidateId: string,
): Promise<ActionResult<null>> {
  if (!bookId || !candidateId) {
    return { status: "error", message: "Invalid book or Open Library match." };
  }

  try {
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
      const book = await transaction.book.findUnique({
        where: { id: bookId },
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
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/reports/open-library-matches");
  revalidatePath("/reports/open-library-tags");
  revalidatePath(`/books/${bookId}`);
  return {
    status: "success",
    data: null,
    message: "The selected Open Library match was applied.",
  };
}

export async function saveManualBookTags(
  bookId: string,
  rawTags: string,
): Promise<ActionResult<null>> {
  if (
    typeof bookId !== "string" ||
    !bookId ||
    typeof rawTags !== "string" ||
    rawTags.length > 10_000
  ) {
    return { status: "error", message: "Invalid book tags." };
  }

  const names = [...new Set(
    rawTags
      .split(/[,;\n]/)
      .map((name) => name.trim())
      .filter(Boolean),
  )];
  if (names.some((name) => name.length > 191)) {
    return {
      status: "error",
      message: "Each tag must be 191 characters or fewer.",
    };
  }
  if (names.length > 100) {
    return { status: "error", message: "Enter no more than 100 tags." };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.book.findUniqueOrThrow({
        where: { id: bookId },
        select: { id: true },
      });
      await replaceBookTags(
        transaction,
        bookId,
        "LIBRARY",
        names.map((name) => ({ category: BookTagCategory.SUBJECT, name })),
        BookTagCategory.SUBJECT,
      );
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", data: null, message: "Manual tags saved." };
}

export async function deleteManualBookTag(
  bookId: string,
  tagId: string,
): Promise<ActionResult<null>> {
  if (
    typeof bookId !== "string" ||
    !bookId ||
    typeof tagId !== "string" ||
    !tagId
  ) {
    return { status: "error", message: "Invalid book tag." };
  }

  try {
    const result = await prisma.bookTag.deleteMany({
      where: {
        bookId,
        tagId,
        source: "LIBRARY",
        tag: { category: BookTagCategory.SUBJECT },
      },
    });
    if (result.count === 0) {
      return {
        status: "error",
        message: "Manual tag not found on this book.",
      };
    }
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/reports/open-library-tags");
  return {
    status: "success",
    data: null,
    message: "Manual tag removed from this book.",
  };
}

export async function mergeSimilarTags(
  keepTagId: string,
  mergeTagId: string,
): Promise<ActionResult<null>> {
  if (
    typeof keepTagId !== "string" ||
    typeof mergeTagId !== "string" ||
    !keepTagId ||
    !mergeTagId ||
    keepTagId === mergeTagId
  ) {
    return { status: "error", message: "Choose two different tags to merge." };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const [keepTag, mergeTag] = await Promise.all([
        transaction.tag.findUnique({ where: { id: keepTagId } }),
        transaction.tag.findUnique({ where: { id: mergeTagId } }),
      ]);
      if (!keepTag || !mergeTag) {
        throw new Error("One of the selected tags no longer exists.");
      }
      if (keepTag.category !== mergeTag.category) {
        throw new Error("Tags from different categories cannot be merged.");
      }

      const relationships = await transaction.bookTag.findMany({
        where: { tagId: mergeTag.id },
        select: { bookId: true, source: true },
      });
      for (const relationship of relationships) {
        const existing = await transaction.bookTag.findUnique({
          where: {
            bookId_tagId_source: {
              bookId: relationship.bookId,
              tagId: keepTag.id,
              source: relationship.source,
            },
          },
          select: { bookId: true },
        });
        if (existing) {
          await transaction.bookTag.delete({
            where: {
              bookId_tagId_source: {
                bookId: relationship.bookId,
                tagId: mergeTag.id,
                source: relationship.source,
              },
            },
          });
        } else {
          await transaction.bookTag.update({
            where: {
              bookId_tagId_source: {
                bookId: relationship.bookId,
                tagId: mergeTag.id,
                source: relationship.source,
              },
            },
            data: { tagId: keepTag.id },
          });
        }
      }
      await transaction.tag.delete({ where: { id: mergeTag.id } });
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath("/reports/open-library-tags");
  revalidatePath("/tags");
  return {
    status: "success",
    data: null,
    message: "Similar tags merged successfully.",
  };
}

export async function saveAuthorPhoto(
  bookId: string,
  authorId: string,
  photoId: number,
): Promise<ActionResult<null>> {
  const sourceUrl = getOpenLibraryAuthorUrl(authorId);
  const photoUrl = getOpenLibraryAuthorPhotoUrl(photoId, "M");
  if (!bookId || !sourceUrl || !photoUrl) {
    return { status: "error", message: "Invalid Open Library author photo selection." };
  }

  let book: { authorId: string } | null;
  try {
    book = await prisma.book.findUnique({
      where: { id: bookId },
      select: { authorId: true },
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!book) return { status: "error", message: "Book not found." };

  try {
    const profile = await getOpenLibraryAuthorProfile(authorId);
    const verifiedPhotoId = profile.photoId;
    if (verifiedPhotoId !== photoId) {
      return {
        status: "error",
        message: "The selected photo is not listed on this Open Library author record.",
      };
    }
    await prisma.author.update({
      where: { id: book.authorId },
      data: {
        wikidataId: null,
        portraitUrl: photoUrl,
        portraitSourceUrl: sourceUrl,
        portraitArtist: null,
        portraitLicense: null,
        portraitLicenseUrl: null,
      },
    });
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", data: null, message: "Author photo saved." };
}
