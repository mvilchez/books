import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPersonalizedRecommendationsForUser,
  refreshUserPreferenceVector,
} from "@/lib/personalized-recommendations";
import type {
  PersistedPersonalizedRecommendation,
  PersonalizedRecommendation,
} from "@/lib/analytics-types";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";

function displayRecommendation(
  recommendation: {
    id: string;
    title: string;
    author: string;
    workId: string;
    firstPublishYear: number | null;
  } & { status: PersistedPersonalizedRecommendation["status"] },
): PersistedPersonalizedRecommendation {
  return {
    ...recommendation,
    reason: "Based on your reading preferences",
    source: "open_library",
    similarityScore: 0,
    status: recommendation.status,
  };
}

async function recalculateForUser(
  userId: string,
  preserveActive = false,
): Promise<PersistedPersonalizedRecommendation[]> {
  await refreshUserPreferenceVector(userId);
  const activeCount = preserveActive
    ? await prisma.personalizedRecommendation.count({
        where: { userId, status: "ACTIVE" },
      })
    : 0;
  const limit = preserveActive ? Math.max(0, 5 - activeCount) : 5;
  if (!preserveActive) {
    await prisma.personalizedRecommendation.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "OLD_DISMISSED" },
    });
  }
  if (limit === 0) return getRecommendationHistory(userId);

  const generated = await getPersonalizedRecommendationsForUser(userId, limit);
  const recommendations = generated.recommendations.filter(
    (recommendation): recommendation is PersonalizedRecommendation & {
      workId: string;
    } => recommendation.workId !== null,
  );

  await prisma.$transaction(async (transaction) => {
    const rows = [];
    for (const recommendation of recommendations) {
      rows.push(
        await transaction.personalizedRecommendation.create({
          data: {
            userId,
            workId: recommendation.workId,
            title: recommendation.title,
            author: recommendation.author,
            firstPublishYear: recommendation.firstPublishYear,
          },
          select: {
            id: true,
            title: true,
            author: true,
            workId: true,
            firstPublishYear: true,
            status: true,
          },
        }),
      );
    }
    return rows;
  });

  return getRecommendationHistory(userId);
}

async function getRecommendationHistory(
  userId: string,
): Promise<PersistedPersonalizedRecommendation[]> {
  const rows = await prisma.personalizedRecommendation.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      author: true,
      workId: true,
      firstPublishYear: true,
      status: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return rows.map(displayRecommendation);
}

export async function getRecommendationHistoryForCurrentUser(): Promise<
  PersistedPersonalizedRecommendation[]
> {
  const user = await getCurrentUser();
  if (!user) return [];
  return getRecommendationHistory(user.id);
}

async function markAsReadAndRefresh(
  userId: string,
  recommendationId: string,
): Promise<{ success: boolean; newRecs: PersistedPersonalizedRecommendation[] }> {
  const result = await prisma.personalizedRecommendation.updateMany({
    where: { id: recommendationId, userId, status: "ACTIVE" },
    data: { status: "DELETED" },
  });
  if (result.count !== 1) return { success: false, newRecs: [] };
  return {
    success: true,
    newRecs: await recalculateForUser(userId, true),
  };
}

export async function discardRecommendationForCurrentUser(
  recommendationId: string,
): Promise<{
  success: boolean;
  recommendations: PersistedPersonalizedRecommendation[];
}> {
  const user = await getCurrentUser();
  if (!user) return { success: false, recommendations: [] };

  const result = await prisma.personalizedRecommendation.updateMany({
    where: { id: recommendationId, userId: user.id },
    data: { status: "DELETED" },
  });
  if (result.count !== 1) {
    return {
      success: false,
      recommendations: await getRecommendationHistory(user.id),
    };
  }
  return {
    success: true,
    recommendations: await recalculateForUser(user.id, true),
  };
}

export async function recalculateRecommendationsForCurrentUser(): Promise<{
  recommendations: PersistedPersonalizedRecommendation[];
}> {
  const user = await getCurrentUser();
  if (!user) return { recommendations: [] };
  return { recommendations: await recalculateForUser(user.id) };
}

export async function startRecommendedBookForCurrentUser(
  recommendationId: string,
): Promise<{ success: boolean; message: string; recommendations: PersistedPersonalizedRecommendation[] }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, message: "User not authenticated.", recommendations: [] };
  }

  const recommendation = await prisma.personalizedRecommendation.findFirst({
    where: { id: recommendationId, userId: user.id, status: "ACTIVE" },
  });
  if (!recommendation) {
    return { success: false, message: "Recommendation is no longer active.", recommendations: [] };
  }

  const now = new Date();
  const startDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const readingYear = startDate.getUTCFullYear();

  try {
    await prisma.$transaction(async (transaction) => {
      const author = await transaction.author.upsert({
        where: { name: recommendation.author },
        create: { name: recommendation.author },
        update: {},
      });
      const existingBook = await transaction.book.findFirst({
        where: {
          userId: user.id,
          OR: [
            { openLibraryWorkId: recommendation.workId },
            { title: recommendation.title, authorId: author.id },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingBook) {
        if (existingBook.status === "PENDING" || existingBook.status === "WISH_LIST") {
          await transaction.book.update({
            where: { id: existingBook.id },
            data: {
              status: "READING",
              startDate,
              finishDate: null,
              readingYear,
              currentPages: 0,
              rating: null,
            },
          });
        } else if (existingBook.status !== "READING") {
          throw new Error("This book is already completed in your library.");
        }
      } else {
        await transaction.book.create({
          data: {
            userId: user.id,
            title: recommendation.title,
            authorId: author.id,
            openLibraryWorkId: recommendation.workId,
            publicationYear: recommendation.firstPublishYear,
            status: "READING",
            startDate,
            readingYear,
          },
        });
      }

      await transaction.personalizedRecommendation.update({
        where: { id: recommendation.id },
        data: { status: "DELETED" },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "This book is already completed in your library.") {
      return {
        success: false,
        message: error.message,
        recommendations: await getRecommendationHistory(user.id),
      };
    }
    if (isUniqueConstraintViolation(error)) {
      return {
        success: false,
        message: "This book is already in your reading list.",
        recommendations: await getRecommendationHistory(user.id),
      };
    }
    throw error;
  }

  const recommendations = await recalculateForUser(user.id, true);
  return {
    success: true,
    message: "Book added to your currently reading list.",
    recommendations,
  };
}

export async function markBookAsReadByAuthorForCurrentUser(
  authorName: string,
): Promise<{ success: boolean; books: { id: string; title: string }[] }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, books: [] };

  const books = await prisma.book.findMany({
    where: { userId: user.id, author: { name: authorName } },
    select: { id: true, title: true },
  });

  if (books.length === 0) return { success: false, books: [] };

  if (books.length === 1) {
    await prisma.book.update({
      where: { id: books[0].id, userId: user.id },
      data: { status: "COMPLETED" },
    });
  }

  return { success: true, books };
}

export async function getCompletedBooksByAuthorForCurrentUser(
  authorName: string,
): Promise<{ id: string; title: string }[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.book.findMany({
    where: {
      userId: user.id,
      author: { name: authorName },
      status: "COMPLETED",
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

export async function markRecommendationAsReadForCurrentUser(
  recommendationId: string,
  readBookId: string,
): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const book = await prisma.book.findFirst({
    where: { id: readBookId, userId: user.id, status: "COMPLETED" },
    select: { id: true },
  });
  if (!book) return { success: false };

  const result = await markAsReadAndRefresh(user.id, recommendationId);
  return { success: result.success };
}

export async function markRecommendationAsDeletedForCurrentUser(
  recommendationId: string,
): Promise<{ success: boolean; newRecs: PersistedPersonalizedRecommendation[] }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, newRecs: [] };
  return markAsReadAndRefresh(user.id, recommendationId);
}
