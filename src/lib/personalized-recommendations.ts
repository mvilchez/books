/**
 * Personalized Book Recommendation Engine
 * Combines internal tag/genre/author similarity with Open Library external search
 */

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { PersonalizedRecommendation, PersonalizedRecommendationsResult } from "@/lib/analytics-types";

const ENGINE_VERSION = "1.0.0";

async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Get the user's completed high-rating books to build a preference profile.
 */
export async function getHighRatedCompletedBooks(userId: string): Promise<any[]> {
  if (!userId) return [];
  return prisma.book.findMany({
    where: { userId, status: "COMPLETED", rating: { gte: 7 } },
    include: { author: true, genre: true, tags: { include: { tag: true }, where: { deleted: false } } },
    orderBy: { rating: "desc" },
    take: 20,
  });
}

/**
 * Build a preference profile from the user's high-rated completed books.
 */
export function buildPreferenceProfile(books: any[]) {
  const authorCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const book of books) {
    if (book.author) {
      const authorKey = book.author.name.toLowerCase();
      authorCounts.set(authorKey, (authorCounts.get(authorKey) ?? 0) + 1);
    }
    if (book.genre?.name) {
      genreCounts.set(book.genre.name, (genreCounts.get(book.genre.name) ?? 0) + 1);
    }
    for (const tag of book.tags) {
      if (tag.tag) {
        const category = tag.tag.category;
        const tagName = tag.tag.name.toLowerCase();
        const key = `${category}:${tagName}`;
        tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const topAuthors = Array.from(authorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key);

  return { topAuthors, topGenres, topTags };
}

/**
 * Get completed books that should be excluded from recommendations.
 */
async function getExcludedBooks(userId: string): Promise<{
  titles: Set<string>;
  workIds: Set<string>;
}> {
  if (!userId) return { titles: new Set(), workIds: new Set() };

  const readBooks = await prisma.book.findMany({
    where: { userId, status: "COMPLETED" },
    select: { title: true, openLibraryWorkId: true },
  });

  const titles = new Set(readBooks.map((b) => b.title.normalize("NFKC").toLowerCase()));
  const workIds = new Set(
    readBooks.map((b) => b.openLibraryWorkId).filter(Boolean) as string[]
  );

  return { titles, workIds };
}

/**
 * Search Open Library for recommendations based on the user's preference profile.
 * Note: This is a simplified search - in production would use proper Open Library API.
 */
async function searchOpenLibraryRecommendations(
  profile: ReturnType<typeof buildPreferenceProfile>,
  excludedTitles: Set<string>,
  excludedWorkIds: Set<string>
): Promise<PersonalizedRecommendation[]> {
  const recommendations: PersonalizedRecommendation[] = [];

  // Search by top authors first
  if (profile.topAuthors.length > 0) {
    const authorQuery = profile.topAuthors[0];
    // Use Open Library API search
    const searchUrl = `https://openlibrary.org/search.json?author=${encodeURIComponent(
      authorQuery
    )}&limit=5`;
    try {
      const response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        for (const doc of data.docs || []) {
          const titleKey = doc.title.normalize("NFKC").toLowerCase();
          if (
            !excludedTitles.has(titleKey) &&
            !excludedWorkIds.has(doc.id as string)
          ) {
            recommendations.push({
              id: `ol-${doc.id}`,
              title: doc.title,
              author: authorQuery,
              workId: doc.id as string | null,
              firstPublishYear: doc.first_publish_year ?? null,
              reason: "Open Library match by author",
              source: "open_library",
              similarityScore: 50,
            });
          }
          if (recommendations.length >= 5) break;
        }
      }
    } catch (e) {
      // Continue on error
    }
  }

  // Search by top genres if we need more recommendations
  if (recommendations.length < 5 && profile.topGenres.length > 0) {
    const genreQuery = profile.topGenres[0];
    const searchUrl = `https://openlibrary.org/search.json?subject=${encodeURIComponent(
      genreQuery
    )}&limit=5`;
    try {
      const response = await fetch(searchUrl);
      if (response.ok) {
        const data = await response.json();
        for (const doc of data.docs || []) {
          const titleKey = doc.title.normalize("NFKC").toLowerCase();
          if (
            !excludedTitles.has(titleKey) &&
            !excludedWorkIds.has(doc.id as string)
          ) {
            recommendations.push({
              id: `ol-${doc.id}`,
              title: doc.title,
              author: "Unknown",
              workId: doc.id as string | null,
              firstPublishYear: doc.first_publish_year ?? null,
              reason: `Open Library match by genre: ${genreQuery}`,
              source: "open_library",
              similarityScore: 40,
            });
          }
          if (recommendations.length >= 5) break;
        }
      }
    } catch (e) {
      // Continue on error
    }
  }

  return recommendations;
}

/**
 * Main function: get personalized recommendations for a user.
 */
export async function getPersonalizedRecommendations(
  limit = 5
): Promise<PersonalizedRecommendationsResult> {
  const userId = await getUserId();
  if (!userId) {
    return {
      recommendations: [],
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
    };
  }

  // Get user's high-rated completed books
  const highRatedBooks = await getHighRatedCompletedBooks(userId);

  if (highRatedBooks.length === 0) {
    return {
      recommendations: [],
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
    };
  }

  // Build preference profile
  const profile = buildPreferenceProfile(highRatedBooks);

  // Get excluded books (already read completed books)
  const { titles: excludedTitles, workIds: excludedWorkIds } =
    await getExcludedBooks(userId);

  // Calculate internal scores for the user's books
  const internalRecommendations: PersonalizedRecommendation[] = [];

  for (const book of highRatedBooks) {
    let score = 0;

    // Author match (highest weight)
    if (book.author && profile.topAuthors.includes(book.author.name.toLowerCase())) {
      score += 30;
    }

    // Genre match
    if (book.genre?.name && profile.topGenres.includes(book.genre.name)) {
      score += 20;
    }

    // Tag match
    if (book.tags) {
      for (const tag of book.tags) {
        if (
          tag.tag &&
          profile.topTags.includes(`${tag.tag.category}:${tag.tag.name.toLowerCase()}`)
        ) {
          score += 10;
          break; // Only count once per book for top tags
        }
      }
    }

    if (score > 0) {
      internalRecommendations.push({
        id: `internal-${book.id}`,
        title: book.title,
        author: book.author?.name ?? "Unknown",
        workId: book.openLibraryWorkId,
        firstPublishYear: book.publicationYear,
        reason: score >= 50 ? "Strong match with your preferences" : "Matches your reading preferences",
        source: "internal",
        similarityScore: score,
      });
    }
  }

  // Sort internal by score descending, take top 3
  internalRecommendations.sort(
    (a: PersonalizedRecommendation, b: PersonalizedRecommendation) =>
      b.similarityScore - a.similarityScore
  );
  const topInternal = internalRecommendations.slice(0, 3);

  // Search Open Library for additional recommendations
  const olRecommendations = await searchOpenLibraryRecommendations(
    profile,
    excludedTitles,
    excludedWorkIds
  );

  // Combine: internal first, then Open Library to fill up to limit
  const allRecommendations = [...topInternal];

  for (const olRec of olRecommendations) {
    if (allRecommendations.length >= limit) break;
    // Check if already added (by workId)
    if (
      !allRecommendations.some((r) => r.workId === olRec.workId)
    ) {
      allRecommendations.push(olRec);
    }
  }

  // Final sort by similarity score, then source priority (internal > open_library)
  allRecommendations.sort(
    (a: PersonalizedRecommendation, b: PersonalizedRecommendation) => {
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      return a.source.localeCompare(b.source);
    }
  );

  return {
    recommendations: allRecommendations.slice(0, limit),
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format a recommendation for display in the UI.
 */
export function formatRecommendationForDisplay(
  rec: PersonalizedRecommendation
): string {
  const authorPart = rec.author ? `by ${rec.author}` : "";
  const yearPart = rec.firstPublishYear
    ? ` (${rec.firstPublishYear})`
    : "";
  const reasonPart = rec.reason ? ` • ${rec.reason}` : "";

  return `${rec.title} ${authorPart}${yearPart}${reasonPart}`;
}
