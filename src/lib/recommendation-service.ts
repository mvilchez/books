import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPersonalizedRecommendations } from "@/lib/personalized-recommendations";
import type { PersonalizedRecommendation } from "@/lib/analytics-types";

export async function dismissRecommendationForCurrentUser(
  recommendationId: string,
): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const result = await prisma.personalizedRecommendation.updateMany({
    where: { id: recommendationId, userId: user.id },
    data: { status: "OLD_DISMISSED" },
  });
  return { success: result.count === 1 };
}

export async function recalculateRecommendationsForCurrentUser(): Promise<{
  recommendations: PersonalizedRecommendation[];
}> {
  const user = await getCurrentUser();
  if (!user) return { recommendations: [] };

  await prisma.personalizedRecommendation.updateMany({
    where: { userId: user.id, status: "ACTIVE" },
    data: { status: "OLD_DISMISSED" },
  });

  const newRecs = await getPersonalizedRecommendations(5);

  await prisma.personalizedRecommendation.deleteMany({
    where: { userId: user.id, status: "OLD_DISMISSED" },
  });

  return { recommendations: newRecs.recommendations };
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

  const result = await prisma.personalizedRecommendation.updateMany({
    where: { id: recommendationId, userId: user.id },
    data: { status: "MARKED_AS_READ", readBookId: book.id },
  });

  return { success: result.count === 1 };
}
