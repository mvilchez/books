"use server";

import type { PersonalizedRecommendation } from "@/lib/analytics-types";
import {
  dismissRecommendationForCurrentUser,
  recalculateRecommendationsForCurrentUser,
  markBookAsReadByAuthorForCurrentUser,
  getCompletedBooksByAuthorForCurrentUser,
  markRecommendationAsReadForCurrentUser,
} from "@/lib/recommendation-service";

export async function dismissRecommendation(id: string): Promise<{ success: boolean }> {
  return dismissRecommendationForCurrentUser(id);
}

export async function recalculateRecommendations(): Promise<{ recommendations: PersonalizedRecommendation[] }> {
  return recalculateRecommendationsForCurrentUser();
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
  return markRecommendationAsReadForCurrentUser(recommendationId, readBookId);
}
