"use server";

import { refresh, revalidatePath } from "next/cache";
import {
  completeBookRecord,
  createPendingBookRecord,
  createReadingBookRecord,
  deleteBookById,
  saveBookDetails,
  setBookProgressPages,
  setBookStillReadingRecord,
  startSagaWishlistBook,
} from "@/lib/books";
import {
  isRecordNotFound,
  isUniqueConstraintViolation,
} from "@/lib/prisma-errors";
import { toIsbn13 } from "@/lib/isbn";

export type BookFormState = {
  status: "idle" | "error" | "success";
  message: string;
  year?: number;
};

function formString(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : null;
}

function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

/** Today at UTC midnight — the same convention used for imported dates. */
function todayUtcDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

const readingStatuses = ["PENDING", "READING", "COMPLETED", "WISH_LIST"] as const;
type ReadingStatus = (typeof readingStatuses)[number];

function isReadingStatus(value: string | null): value is ReadingStatus {
  return readingStatuses.some((status) => status === value);
}

function optionalNumber(value: string | null): number | null {
  return value === null || value === "" ? null : Number(value);
}

export async function updateBookDetails(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const bookId = formString(formData, "bookId");
  const title = formString(formData, "title");
  const authorName = formString(formData, "author");
  const genreName = formString(formData, "genre");
  const origin = formString(formData, "origin");
  const editionKey = formString(formData, "editionKey");
  const seriesName = formString(formData, "seriesName");
  const seriesPosition = optionalNumber(formString(formData, "seriesPosition"));
  const statusValue = formString(formData, "status");
  const readingYear = Number(formString(formData, "readingYear"));
  const publicationYear = optionalNumber(formString(formData, "publicationYear"));
  const totalPages = optionalNumber(formString(formData, "totalPages"));
  const currentPages = Number(formString(formData, "currentPages"));
  const rating = optionalNumber(formString(formData, "rating"));
  const startDateValue = formString(formData, "startDate");
  const finishDateValue = formString(formData, "finishDate");
  const startDate = startDateValue ? parseDate(startDateValue) : null;
  const finishDate = finishDateValue ? parseDate(finishDateValue) : null;

  if (!bookId) return { status: "error", message: "Invalid book." };
  if (!title || title.length > 191) {
    return { status: "error", message: "Enter a title (up to 191 characters)." };
  }
  if (!authorName || authorName.length > 191) {
    return { status: "error", message: "Enter an author (up to 191 characters)." };
  }
  if (!isReadingStatus(statusValue)) {
    return { status: "error", message: "Choose a valid book status." };
  }
  if (!Number.isInteger(readingYear) || readingYear < 1 || readingYear > 9999) {
    return { status: "error", message: "Enter a valid reading year." };
  }
  if (
    publicationYear !== null &&
    (!Number.isInteger(publicationYear) || publicationYear < 1 || publicationYear > 9999)
  ) {
    return { status: "error", message: "Publication year must be a whole year." };
  }
  if (
    totalPages !== null &&
    (!Number.isInteger(totalPages) || totalPages < 0 || totalPages > 2_147_483_647)
  ) {
    return { status: "error", message: "Total pages must be a non-negative whole number." };
  }
  if (
    !Number.isInteger(currentPages) ||
    currentPages < 0 ||
    currentPages > 2_147_483_647 ||
    (totalPages !== null && currentPages > totalPages)
  ) {
    return {
      status: "error",
      message: "Current pages must be a non-negative whole number no greater than total pages.",
    };
  }
  if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) {
    return { status: "error", message: "Rating must be between 0 and 10." };
  }
  if (startDateValue && !startDate) {
    return { status: "error", message: "Enter a valid start date." };
  }
  if (finishDateValue && !finishDate) {
    return { status: "error", message: "Enter a valid finish date." };
  }
  if (
    startDate &&
    finishDate &&
    finishDate.getTime() < startDate.getTime()
  ) {
    return { status: "error", message: "The finish date cannot be before the start date." };
  }
  if (genreName && genreName.length > 191) {
    return { status: "error", message: "Genre must be 191 characters or fewer." };
  }
  if (origin && origin.length > 191) {
    return { status: "error", message: "Origin must be 191 characters or fewer." };
  }
  if (editionKey !== null && editionKey.length > 191) {
    return { status: "error", message: "Edition key must be 191 characters or fewer." };
  }
  if (seriesName !== null && seriesName.length > 191) {
    return { status: "error", message: "Series name must be 191 characters or fewer." };
  }
  if (
    seriesPosition !== null &&
    (!Number.isFinite(seriesPosition) || seriesPosition <= 0)
  ) {
    return { status: "error", message: "Series position must be a positive number." };
  }

  try {
    await saveBookDetails({
      bookId,
      title,
      authorName,
      genreName: genreName || null,
      origin,
      editionKey,
      seriesName,
      seriesPosition,
      status: statusValue,
      readingYear,
      publicationYear,
      totalPages,
      currentPages,
      rating,
      startDate,
      finishDate,
    });
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { status: "error", message: "Book not found." };
    }
    if (isUniqueConstraintViolation(error)) {
      return {
        status: "error",
        message: "A book with this title, author, reading year, and edition already exists.",
      };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", message: "Book details saved." };
}

export type DeleteBookFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

export async function deleteBook(
  _previousState: DeleteBookFormState,
  formData: FormData,
): Promise<DeleteBookFormState> {
  const bookId = formString(formData, "bookId");
  if (!bookId) return { status: "error", message: "Invalid book." };

  const { deleted } = await deleteBookById(bookId);
  if (!deleted) {
    return { status: "error", message: "Book not found; it may already be deleted." };
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", message: "Book deleted." };
}

export async function setBookStillReading(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const bookId = formString(formData, "bookId");
  if (!bookId) return { status: "error", message: "Invalid book." };

  let updatedBook: { status: string; finishDate: Date | null; rating: number | null };
  try {
    updatedBook = await setBookStillReadingRecord(bookId);
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { status: "error", message: "Book not found." };
    }
    throw error;
  }

  if (updatedBook.status !== "READING" || updatedBook.finishDate !== null || updatedBook.rating !== null) {
    throw new Error(`Book ${bookId} could not be marked as still reading.`);
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  refresh();
  return {
    status: "success",
    message: "Book set to still reading; finish date and rating were cleared.",
  };
}

export async function createReadingBook(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const title = formString(formData, "title");
  const authorName = formString(formData, "author");
  const genreName = formString(formData, "genre");
  const seriesName = formString(formData, "seriesName");
  const seriesPositionValue = formString(formData, "seriesPosition");
  const seriesPosition =
    seriesPositionValue === null || seriesPositionValue === ""
      ? null
      : Number(seriesPositionValue);
  const startDateRaw = formString(formData, "startDate");
  // An empty start date means "start today" (UTC midnight, the project's
  // convention); a non-empty value must still parse to a real date.
  const startDate = startDateRaw ? parseDate(startDateRaw) : todayUtcDate();
  const totalPagesValue = formString(formData, "totalPages");
  const totalPages =
    totalPagesValue === null || totalPagesValue === ""
      ? null
      : Number(totalPagesValue);
  const isbn13 = toIsbn13(formString(formData, "isbn13") ?? "");
  const openLibraryCoverIdValue = optionalNumber(
    formString(formData, "openLibraryCoverId"),
  );
  const openLibraryCoverId =
    openLibraryCoverIdValue !== null &&
    Number.isSafeInteger(openLibraryCoverIdValue) &&
    openLibraryCoverIdValue > 0
      ? openLibraryCoverIdValue
      : null;
  const openLibraryWorkId = formString(formData, "openLibraryWorkId");
  if (openLibraryWorkId && !/^OL\d+W$/.test(openLibraryWorkId)) {
    return { status: "error", message: "Invalid Open Library work reference." };
  }
  const publicationYearValue = optionalNumber(
    formString(formData, "publicationYear"),
  );
  if (
    publicationYearValue !== null &&
    (!Number.isInteger(publicationYearValue) ||
      publicationYearValue < 1 ||
      publicationYearValue > 9999)
  ) {
    return { status: "error", message: "Publication year must be a whole year." };
  }

  if (!title || title.length > 191) {
    return { status: "error", message: "Enter a title (up to 191 characters)." };
  }
  if (!authorName || authorName.length > 191) {
    return { status: "error", message: "Enter an author (up to 191 characters)." };
  }
  if (genreName && genreName.length > 191) {
    return { status: "error", message: "Genre must be 191 characters or fewer." };
  }
  if (seriesName && seriesName.length > 191) {
    return { status: "error", message: "Saga name must be 191 characters or fewer." };
  }
  if (
    seriesPosition !== null &&
    (!Number.isFinite(seriesPosition) || seriesPosition <= 0)
  ) {
    return { status: "error", message: "Saga position must be a positive number." };
  }
  if (!startDate || startDate.getUTCFullYear() < 1) {
    return { status: "error", message: "Enter a valid start date." };
  }
  if (
    totalPages !== null &&
    (!Number.isSafeInteger(totalPages) ||
      totalPages < 1 ||
      totalPages > 2_147_483_647)
  ) {
    return { status: "error", message: "Pages must be a positive whole number within the supported range." };
  }

  const readingYear = startDate.getUTCFullYear();
  try {
    await createReadingBookRecord({
      title,
      authorName,
      genreName: genreName || null,
      startDate,
      totalPages,
      readingYear,
      seriesName: seriesName || null,
      seriesPosition,
      isbn13,
      openLibraryCoverId,
      openLibraryWorkId: openLibraryWorkId || null,
      publicationYear: publicationYearValue,
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return {
        status: "error",
        message: "This author already has a book with that title in the selected year.",
      };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/sagas");
  if (seriesName) revalidatePath(`/sagas/${encodeURIComponent(seriesName)}`);
  return {
    status: "success",
    message: "Book added to your reading list.",
    year: readingYear,
  };
}

export async function startSagaWishlistBookAction(
  formData: FormData,
): Promise<void> {
  const bookId = formString(formData, "bookId");
  const seriesName = formString(formData, "seriesName");
  if (!bookId || !seriesName) {
    throw new Error("Invalid saga book.");
  }
  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const started = await startSagaWishlistBook(bookId, seriesName, startDate);
  if (!started) {
    throw new Error("This saga book is no longer available to start.");
  }
  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath("/sagas");
  revalidatePath(`/sagas/${encodeURIComponent(seriesName)}`);
  revalidatePath(`/books/${bookId}`);
}

export type PendingBookFormState = {
  status: "idle" | "error" | "success";
  message: string;
  bookId?: string;
};

export async function addPendingBook(
  _previousState: PendingBookFormState,
  formData: FormData,
): Promise<PendingBookFormState> {
  const title = formString(formData, "title");
  const authorName = formString(formData, "author");

  if (!title || title.length > 191) {
    return { status: "error", message: "Enter a title (up to 191 characters)." };
  }
  if (!authorName || authorName.length > 191) {
    return { status: "error", message: "Enter an author (up to 191 characters)." };
  }

  const readingYear = new Date().getUTCFullYear();
  let bookId: string;
  try {
    bookId = await createPendingBookRecord({
      title,
      authorName,
      readingYear,
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return {
        status: "error",
        message: "This book is already in your library for the current year.",
      };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/stats");
  return {
    status: "success",
    message: "Book added to your library without starting it.",
    bookId,
  };
}

/**
 * Server Action — advance a book's reading progress (PLAN.md Step 3.2).
 *
 * Server Actions are reachable via direct POST requests, not just through the
 * UI (Next.js "Mutating Data" docs), so every argument is validated here and
 * the final value is clamped against the persisted `totalPages` — a tampered
 * payload can never write negative or out-of-range page counts.
 *
 * `totalPages` is nullable for pre-2014 rows: an unknown ceiling only clamps
 * at the lower bound of 0.
 */
export async function updateBookProgress(
  bookId: string,
  nextPages: number,
): Promise<void> {
  if (typeof bookId !== "string" || bookId.length === 0) {
    throw new Error("updateBookProgress: invalid book id.");
  }
  if (typeof nextPages !== "number" || !Number.isFinite(nextPages)) {
    throw new Error("updateBookProgress: nextPages must be a finite number.");
  }

  await setBookProgressPages(bookId, nextPages);

  // The dashboard is an uncached Server Component tree — revalidate so the
  // incremented progress bar is visible on the very next render.
  revalidatePath("/");
}

export async function completeReadingBook(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const bookId = formString(formData, "bookId");
  const ratingValue = formString(formData, "rating");
  if (!bookId) return { status: "error", message: "Invalid book." };
  if (!ratingValue || !/^(?:\d|10)(?:\.\d)?$/.test(ratingValue)) {
    return {
      status: "error",
      message: "Enter a rating from 0 to 10 with no more than one decimal place.",
    };
  }

  const rating = Number(ratingValue);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    return { status: "error", message: "Rating must be between 0 and 10." };
  }

  const now = new Date();
  const finishDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const result = await completeBookRecord(bookId, rating, finishDate);

  if (result.count === 0) {
    return {
      status: "error",
      message: "Book not found or it is no longer being read.",
    };
  }

  revalidatePath("/");
  revalidatePath("/stats");
  revalidatePath(`/books/${bookId}`);
  return { status: "success", message: "Book marked as completed." };
}
