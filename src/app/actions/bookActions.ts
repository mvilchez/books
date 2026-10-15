"use server";

import { refresh, revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

  try {
    await prisma.$transaction(async (transaction) => {
      const author = await transaction.author.upsert({
        where: { name: authorName },
        create: { name: authorName },
        update: {},
      });
      const genre = genreName
        ? await transaction.genre.upsert({
            where: { name: genreName },
            create: { name: genreName },
            update: {},
          })
        : null;

      await transaction.book.update({
        where: { id: bookId },
        data: {
          title,
          status: statusValue,
          rating,
          readingYear,
          publicationYear,
          totalPages,
          currentPages,
          editionKey: editionKey ?? "",
          origin: origin || null,
          startDate,
          finishDate,
          authorId: author.id,
          genreId: genre?.id ?? null,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: "error", message: "Book not found." };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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

export async function setBookStillReading(
  _previousState: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const bookId = formString(formData, "bookId");
  if (!bookId) return { status: "error", message: "Invalid book." };

  let updatedBook: { status: string; finishDate: Date | null; rating: number | null };
  try {
    updatedBook = await prisma.book.update({
      where: { id: bookId },
      data: { status: "READING", finishDate: null, rating: null },
      select: { status: true, finishDate: true, rating: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
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
  const startDate = parseDate(formString(formData, "startDate"));
  const totalPagesValue = formString(formData, "totalPages");
  const totalPages =
    totalPagesValue === null || totalPagesValue === ""
      ? null
      : Number(totalPagesValue);

  if (!title || title.length > 191) {
    return { status: "error", message: "Enter a title (up to 191 characters)." };
  }
  if (!authorName || authorName.length > 191) {
    return { status: "error", message: "Enter an author (up to 191 characters)." };
  }
  if (genreName && genreName.length > 191) {
    return { status: "error", message: "Genre must be 191 characters or fewer." };
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
    await prisma.$transaction(async (transaction) => {
      const author = await transaction.author.upsert({
        where: { name: authorName },
        create: { name: authorName },
        update: {},
      });
      const genre = genreName
        ? await transaction.genre.upsert({
            where: { name: genreName },
            create: { name: genreName },
            update: {},
          })
        : null;

      await transaction.book.create({
        data: {
          title,
          readingYear,
          startDate,
          totalPages,
          status: "READING",
          authorId: author.id,
          genreId: genre?.id ?? null,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "error",
        message: "This author already has a book with that title in the selected year.",
      };
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/stats");
  return {
    status: "success",
    message: "Book added to your reading list.",
    year: readingYear,
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
  const result = await prisma.book.updateMany({
    where: { id: bookId, status: "READING" },
    data: { status: "COMPLETED", finishDate, rating },
  });

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
