"use server";

import { revalidatePath } from "next/cache";
import {
  getBookAuthorId,
  getBookAuthorName,
  getBookCoverTarget,
  getBookEnrichmentSnapshot,
  getBookForRecommendation,
  getCompletedBookSummaries,
  saveBookCoverSelection,
  updateAuthorPortrait,
} from "@/lib/books";
import {
  deleteBookTag as removeBookTag,
  isBookTagSource,
  mergeTags,
  saveManualSubjectTags,
} from "@/lib/tags";
import {
  applyOpenLibraryCandidateMatch,
  saveOpenLibraryMetadata,
} from "@/lib/open-library-candidates";
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
      getBookForRecommendation(bookId),
      getCompletedBookSummaries(),
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
    book = await getBookCoverTarget(bookId);
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
    book = await getBookAuthorName(bookId);
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
    await saveBookCoverSelection(bookId, workId, coverId);
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

  let book: Awaited<ReturnType<typeof getBookEnrichmentSnapshot>>;
  try {
    book = await getBookEnrichmentSnapshot(bookId);
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
  try {
    await saveOpenLibraryMetadata(
      book.id,
      {
        id: book.id,
        totalPages: book.totalPages,
        currentPages: book.currentPages,
        publicationYear: book.publicationYear,
        openLibraryWorkId: book.openLibraryWorkId,
        openLibraryCoverId: book.openLibraryCoverId,
        isbn13: book.isbn13,
        bookFormat: book.bookFormat,
        seriesName: book.seriesName,
        seriesPosition: book.seriesPosition,
      },
      metadata,
      lookup.possibleMatches,
    );
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
    await applyOpenLibraryCandidateMatch(bookId, candidateId);
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
    await saveManualSubjectTags(bookId, names);
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", data: null, message: "Manual tags saved." };
}

export async function deleteBookTag(
  bookId: string,
  tagId: string,
  source: string,
): Promise<ActionResult<null>> {
  if (
    typeof bookId !== "string" ||
    !bookId ||
    typeof tagId !== "string" ||
    !tagId ||
    !isBookTagSource(source)
  ) {
    return { status: "error", message: "Invalid book tag." };
  }

  try {
    const { deleted } = await removeBookTag(bookId, tagId, source);
    if (!deleted) {
      return {
        status: "error",
        message: "Tag not found on this book.",
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
    message: "Tag removed from this book.",
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
    await mergeTags(keepTagId, mergeTagId);
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
    book = await getBookAuthorId(bookId);
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
    await updateAuthorPortrait(book.authorId, photoUrl, sourceUrl);
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", data: null, message: "Author photo saved." };
}
