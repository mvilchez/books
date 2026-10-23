"use server";

import { revalidatePath } from "next/cache";
import {
  getBookAuthorId,
  getBookAuthorName,
  getBookCoverTarget,
  getBookEnrichmentSnapshot,
  getBookForRecommendation,
  getCompletedBookSummaries,
  getOpenLibraryTagGapsForRetry,
  saveBookCoverSelection,
  updateAuthorPortrait,
} from "@/lib/books";
import {
  deleteBookTag as removeBookTag,
  countOpenLibrarySubjectTags,
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
  lookupOpenLibraryBookByIsbn,
  lookupGoogleBooksBookByIsbn,
  searchOpenLibraryBookLookup,
  searchOpenLibraryAuthorPhotos,
  searchOpenLibraryBooks,
  searchOpenLibraryMetadata,
  searchOpenLibraryRecommendations,
  getOpenLibraryWorkMetadata,
  shouldReplaceOpenLibraryWorkLink,
  type OpenLibraryAuthorPhotoCandidate,
  type OpenLibraryBookCandidate,
  type OpenLibraryIsbnLookup,
  type OpenLibraryRecommendationResult,
} from "@/lib/open-library-images";
import type { OpenLibraryRecommendation } from "@/lib/book-recommendations";
import { toIsbn13 } from "@/lib/isbn";

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

export type IsbnLookupData = {
  isbn13: string;
  title: string;
  author: string;
  pageCount: number | null;
  publicationYear: number | null;
  coverId: number | null;
  workId: string | null;
};

/**
 * Resolve a typed or scanned ISBN-10/ISBN-13 (or book barcode) into Open
 * Library metadata so the new-book form can be prefilled. The ISBN is
 * validated and canonicalized to ISBN-13 before contacting Open Library.
 */
export async function lookupBookByIsbn(
  rawIsbn: string,
): Promise<ActionResult<IsbnLookupData>> {
  if (typeof rawIsbn !== "string" || rawIsbn.length > 50) {
    return { status: "error", message: "Enter an ISBN to look up." };
  }
  const isbn13 = toIsbn13(rawIsbn);
  if (!isbn13) {
    return {
      status: "error",
      message:
        "Enter a valid ISBN-10 or ISBN-13, or scan the book's barcode.",
    };
  }

  let lookup: OpenLibraryIsbnLookup | null;
  try {
    lookup = await lookupOpenLibraryBookByIsbn(isbn13);
    if (!lookup) {
      lookup = await lookupGoogleBooksBookByIsbn(isbn13);
    }
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!lookup) {
    return {
      status: "error",
      message: `No Open Library record was found for ISBN ${isbn13}. Fill in the details manually.`,
    };
  }
  const author = lookup.authors[0];
  if (!author) {
    return {
      status: "error",
      message: `ISBN ${isbn13} was found, but Open Library has no author for it. Fill in the details manually.`,
    };
  }

  return {
    status: "success",
    data: {
      isbn13,
      title: lookup.title.slice(0, 191),
      author: author.slice(0, 191),
      pageCount: lookup.pageCount,
      publicationYear: lookup.publicationYear,
      coverId: lookup.coverId,
      workId: lookup.workId,
    },
  };
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

  return runBookMetadataEnrichment(book, { fresh: false });
}

type EnrichmentSnapshot = NonNullable<
  Awaited<ReturnType<typeof getBookEnrichmentSnapshot>>
>;

/**
 * Shared lookup-and-save core for the one-shot auto-enrichment and the
 * explicit retries. `fresh: true` bypasses the one-day search cache so a
 * retry can pick up records that appeared on Open Library after the first
 * (cached) check.
 */
async function runBookMetadataEnrichment(
  book: EnrichmentSnapshot,
  options: { fresh: boolean },
): Promise<ActionResult<BookMetadataEnrichmentResult>> {
  let lookup: Awaited<ReturnType<typeof searchOpenLibraryBookLookup>>;
  try {
    lookup = await searchOpenLibraryBookLookup(
      book.title,
      book.author.name,
      book.totalPages,
      book.publicationYear,
      { fresh: options.fresh },
    );
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  const { metadata } = lookup;
  // A fresh match may heal a stale work link (e.g. a subject-less duplicate
  // work) only when every guard in shouldReplaceOpenLibraryWorkLink holds:
  // the saved link differs, the fresh match brings subjects, and no
  // OPEN_LIBRARY subject tags are saved that replacement could discard.
  let replaceWorkLink = false;
  try {
    const savedSubjectCount = await countOpenLibrarySubjectTags(book.id);
    replaceWorkLink = shouldReplaceOpenLibraryWorkLink(
      book.openLibraryWorkId,
      metadata,
      savedSubjectCount,
    );
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
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
      { replaceWorkLink },
    );
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${book.id}`);
  revalidatePath("/reports/open-library-tags");
  revalidatePath("/reports/open-library-matches");
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

/**
 * Explicitly re-run the Open Library metadata lookup for one book, bypassing
 * the one-day search cache. Used by the tag-gaps report's Retry buttons; it
 * works for both already-checked books (the normal retry case) and unchecked
 * ones.
 */
export async function retryBookMetadataLookup(
  bookId: string,
): Promise<ActionResult<BookMetadataEnrichmentResult>> {
  if (typeof bookId !== "string" || bookId.length === 0) {
    return { status: "error", message: "Invalid book." };
  }

  let book: EnrichmentSnapshot | null;
  try {
    book = await getBookEnrichmentSnapshot(bookId);
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!book) return { status: "error", message: "Book not found." };

  const result = await runBookMetadataEnrichment(book, { fresh: true });
  if (result.status === "error") {
    return {
      status: "error",
      message: `Retry failed for “${book.title}”: ${result.message}`,
    };
  }
  return {
    status: "success",
    data: {
      matched: result.data.matched,
      message: result.data.matched
        ? `Retry matched “${book.title}” and saved its Open Library metadata.`
        : `Retry still found no exact match for “${book.title}”; it remains a creation gap.`,
    },
  };
}

export type TagGapsRetrySummary = {
  processed: number;
  matched: number;
  unmatched: number;
  failed: number;
  stoppedEarly: boolean;
};

/** Pause between batched Open Library requests (keeps the API crawl gentle). */
function retryDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const TAG_GAPS_RETRY_BATCH_LIMIT = 10;
const TAG_GAPS_RETRY_DELAY_MS = 750;

/**
 * Re-run fresh Open Library lookups for up to ten already-checked tag-gap
 * books, oldest check first, with a short pause between requests. Processing
 * stops at the first lookup failure so a transient network problem never
 * burns through the whole batch; rerun the action to continue.
 */
export async function retryOpenLibraryTagGaps(
  limit: number,
): Promise<ActionResult<TagGapsRetrySummary>> {
  const batchSize =
    Number.isSafeInteger(limit) && limit > 0
      ? Math.min(limit, TAG_GAPS_RETRY_BATCH_LIMIT)
      : TAG_GAPS_RETRY_BATCH_LIMIT;

  let books: Awaited<ReturnType<typeof getOpenLibraryTagGapsForRetry>>;
  try {
    books = await getOpenLibraryTagGapsForRetry(batchSize);
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  const emptySummary: TagGapsRetrySummary = {
    processed: 0,
    matched: 0,
    unmatched: 0,
    failed: 0,
    stoppedEarly: false,
  };
  if (books.length === 0) {
    return {
      status: "success",
      data: emptySummary,
      message: "No checked tag-gap books are waiting for a retry.",
    };
  }

  const summary: TagGapsRetrySummary = { ...emptySummary };
  for (const [index, book] of books.entries()) {
    if (index > 0) await retryDelay(TAG_GAPS_RETRY_DELAY_MS);
    const result = await runBookMetadataEnrichment(book, { fresh: true });
    if (result.status === "error") {
      summary.failed = 1;
      summary.stoppedEarly = true;
      break;
    }
    if (result.data.matched) summary.matched++;
    else summary.unmatched++;
    summary.processed++;
  }

  revalidatePath("/reports/open-library-tags");
  return {
    status: "success",
    data: summary,
    message: summary.stoppedEarly
      ? `Stopped after ${summary.processed} retried book(s) (${summary.matched} matched) because one lookup failed; run the retry again to continue.`
      : `Retried ${summary.processed} book(s): ${summary.matched} matched Open Library, ${summary.unmatched} still have no exact match.`,
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

export async function markRecommendationAsSameBook(
  bookId: string,
  recommendationOrWorkId: string | OpenLibraryRecommendation,
  title?: string,
  authors?: string[],
  firstPublishYear?: number | null,
): Promise<ActionResult<null>> {
  let workId: string;
  let recommendedTitle = title ?? "";
  let recommendedAuthors = authors ?? [];
  let recommendedYear = firstPublishYear ?? null;
  if (typeof recommendationOrWorkId === "string") {
    workId = recommendationOrWorkId;
  } else {
    workId = recommendationOrWorkId.workId;
    recommendedTitle = recommendationOrWorkId.title;
    recommendedAuthors = recommendationOrWorkId.authors;
    recommendedYear = recommendationOrWorkId.firstPublishYear;
  }

  if (typeof bookId !== "string" || !bookId) {
    return { status: "error", message: "Invalid book." };
  }
  if (typeof workId !== "string" || !/^OL\d+W$/.test(workId)) {
    return { status: "error", message: "Invalid Open Library work." };
  }

  let book: Awaited<ReturnType<typeof getBookEnrichmentSnapshot>>;
  try {
    const snapshot = await getBookEnrichmentSnapshot(bookId);
    if (!snapshot) return { status: "error", message: "Book not found." };
    book = snapshot;
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  let metadata: Awaited<ReturnType<typeof getOpenLibraryWorkMetadata>> = null;
  try {
    metadata = await getOpenLibraryWorkMetadata(
      workId,
      recommendedTitle,
      recommendedAuthors,
      recommendedYear,
    );
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
  if (!metadata) {
    metadata = {
      workId,
      title: recommendedTitle.trim() || book.title,
      coverId: null,
      firstPublishYear: recommendedYear,
      pageCount: null,
      format: null,
      isbn13: null,
      subjects: [],
      languages: [],
      seriesName: null,
      seriesPosition: null,
    };
  }

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
      [],
      { replaceWorkLink: true },
    );
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  revalidatePath("/reports/open-library-tags");
  revalidatePath("/reports/open-library-matches");
  return {
    status: "success",
    data: null,
    message: "Matched this recommendation to the current book.",
  };
}

export const matchRecommendationToBook = markRecommendationAsSameBook;
export const useRecommendationAsSameBook = markRecommendationAsSameBook;
export const matchBookToRecommendation = markRecommendationAsSameBook;
