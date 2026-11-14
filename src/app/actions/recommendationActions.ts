"use server";

import { revalidatePath } from "next/cache";
import {
  discardRecommendationForCurrentUser,
  getRecommendationHistoryForCurrentUser,
  recalculateRecommendationsForCurrentUser,
  markBookAsReadByAuthorForCurrentUser,
  getCompletedBooksByAuthorForCurrentUser,
  markRecommendationAsReadForCurrentUser,
  markRecommendationAsDeletedForCurrentUser,
  startRecommendedBookForCurrentUser,
} from "@/lib/recommendation-service";
import type { PersistedPersonalizedRecommendation } from "@/lib/analytics-types";

export async function getRecommendationHistory(): Promise<
  PersistedPersonalizedRecommendation[]
> {
  return getRecommendationHistoryForCurrentUser();
}

export async function dismissRecommendation(id: string): Promise<{ success: boolean }> {
  const result = await discardRecommendationForCurrentUser(id);
  if (result.success) revalidatePath("/stats");
  return result;
}

export async function discardRecommendation(
  recommendationId: string,
): Promise<{ success: boolean; recommendations: PersistedPersonalizedRecommendation[] }> {
  const result = await discardRecommendationForCurrentUser(recommendationId);
  if (result.success) revalidatePath("/stats");
  return result;
}

export async function recalculateRecommendations(): Promise<{ recommendations: PersistedPersonalizedRecommendation[] }> {
  const result = await recalculateRecommendationsForCurrentUser();
  revalidatePath("/stats");
  return result;
}

export async function markBookAsReadByAuthor(authorName: string): Promise<{ success: boolean; books: { id: string; title: string }[] }> {
  return markBookAsReadByAuthorForCurrentUser(authorName);
}

export async function getCompletedBooksByAuthor(
  authorName: string,
): Promise<{ id: string; title: string }[]> {
  return getCompletedBooksByAuthorForCurrentUser(authorName);
}

export async function markRecommendationAsRead(
  recommendationId: string,
  readBookId: string,
): Promise<{ success: boolean }> {
  const result = await markRecommendationAsReadForCurrentUser(recommendationId, readBookId);
  if (result.success) revalidatePath("/stats");
  return result;
}

export async function markRecommendationAsDeleted(
  recommendationId: string,
): Promise<{ success: boolean; newRecs: PersistedPersonalizedRecommendation[] }> {
  const result = await markRecommendationAsDeletedForCurrentUser(recommendationId);
  if (result.success) revalidatePath("/stats");
  return result;
}

export async function startRecommendedBook(
  recommendationId: string,
): Promise<{
  success: boolean;
  message: string;
  recommendations: PersistedPersonalizedRecommendation[];
}> {
  const result = await startRecommendedBookForCurrentUser(recommendationId);
  if (result.success) {
    revalidatePath("/");
    revalidatePath("/stats");
  }
  return result;
}
