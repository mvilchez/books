"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getOpenLibraryAuthorProfile,
  getOpenLibraryAuthorPhotoUrl,
  getOpenLibraryAuthorUrl,
  getOpenLibraryWorkUrl,
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
