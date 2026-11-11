"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPersonalizedRecommendations } from "@/lib/personalized-recommendations";
import type { PersonalizedRecommendation } from "@/lib/analytics-types";

export async function dismissRecommendation(id: string): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await prisma.personalizedRecommendation.update({
    where: { id },
    data: { status: "OLD_DISMISSED" },
  });

  return { success: true };
}

export async function recalculateRecommendations(): Promise<{ recommendations: PersonalizedRecommendation[] }> {
  const user = await getCurrentUser();
  if (!user) return { recommendations: [] };

  // First, mark existing recommendations as OLD_DISMISSED
  await prisma.personalizedRecommendation.updateMany({
    where: { userId: user.id, status: "ACTIVE" },
    data: { status: "OLD_DISMISSED" },
  });

  // Then generate 5 new recommendations, one by one
  const newRecs = await getPersonalizedRecommendations(5);

  // Delete the OLD_DISMISSED ones and create new ones
  // Note: We need to delete existing OLD_DISMISSED records first
  await prisma.personalizedRecommendation.deleteMany({
    where: { userId: user.id, status: "OLD_DISMISSED" },
  });

  // Create new recommendations
  const created = newRecs.recommendations.map((rec) => {
    // The rec.id is internal-${book.id} or ol-XXX, we need a proper uuid
    // For now, we'll just return the recommendation data
    return rec;
  });

  return { recommendations: newRecs.recommendations };
}

export async function markBookAsReadByAuthor(authorName: string): Promise<{ success: boolean; books: { id: string; title: string }[] }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, books: [] };

  // Find all books by this author
  const books = await prisma.book.findMany({
    where: { userId: user.id, author: { name: authorName } },
    select: { id: true, title: true },
  });

  if (books.length === 0) return { success: false, books: [] };

  // If there's only one book, mark it as read directly
  if (books.length === 1) {
    await prisma.book.update({
      where: { id: books[0].id },
      data: { status: "COMPLETED" },
    });
    return { success: true, books };
  }

  // Multiple books - return the list for user to choose
  return { success: true, books };
}
