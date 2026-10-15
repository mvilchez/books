"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getOpenLibraryAuthorProfile,
  getOpenLibraryAuthorPhotoUrl,
  getOpenLibraryAuthorUrl,
  getOpenLibraryWorkUrl,
  searchOpenLibraryAuthors,
  searchOpenLibraryBooks,
  type OpenLibraryAuthorCandidate,
  type OpenLibraryBookCandidate,
} from "@/lib/open-library-images";

type ActionResult<T> =
  | { status: "success"; data: T; message?: string }
  | { status: "error"; message: string };

function actionError(error: unknown): string {
  return error instanceof Error ? error.message : "Open Library lookup failed.";
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
): Promise<ActionResult<OpenLibraryAuthorCandidate[]>> {
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
    const candidates = await searchOpenLibraryAuthors(book.author.name);
    return {
      status: "success",
      data: candidates,
      message: candidates.length
        ? "Choose the matching author to preview their photo."
        : "Open Library found no matching author records.",
    };
  } catch (error) {
    return { status: "error", message: actionError(error) };
  }
}

export async function previewAuthorPhoto(
  bookId: string,
  authorId: string,
): Promise<
  ActionResult<{
    authorId: string;
    authorName: string;
    openLibraryName: string | null;
    photoId: number;
    photoUrl: string;
    sourceUrl: string;
  }>
> {
  if (!bookId) return { status: "error", message: "Invalid book." };
  const sourceUrl = getOpenLibraryAuthorUrl(authorId);
  if (!sourceUrl) {
    return { status: "error", message: "Invalid Open Library author identifier." };
  }
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
    const profile = await getOpenLibraryAuthorProfile(authorId);
    const photoId = profile.photoId;
    if (photoId === null) {
      return {
        status: "error",
        message: "This Open Library author record has no usable photo.",
      };
    }
    const photoUrl = getOpenLibraryAuthorPhotoUrl(photoId, "M");
    if (!photoUrl) {
      return { status: "error", message: "Open Library returned an invalid photo identifier." };
    }
    return {
      status: "success",
      data: {
        authorId,
        authorName: book.author.name,
        openLibraryName: profile.name,
        photoId,
        photoUrl,
        sourceUrl,
      },
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
