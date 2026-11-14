/**
 * Personalized Book Recommendation Engine
 * Combines internal tag/genre/author similarity with Open Library external search
 */

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import type { PersonalizedRecommendation, PersonalizedRecommendationsResult } from "@/lib/analytics-types";

const ENGINE_VERSION = "1.0.0";
// In-memory cache for preference vectors (TTL: 24h)
const preferenceVectorCache = new Map<string, { data: any; timestamp: number }>();
const PREFERENCE_VECTOR_TTL = 24 * 60 * 60 * 1000; // 24 hours

type PreferenceBook = Prisma.BookGetPayload<{
  include: {
    author: true;
    genre: true;
    tags: { include: { tag: true }; where: { deleted: false } };
  };
}>;

type PreferenceProfile = {
  topAuthors: string[];
  topGenres: string[];
  topTags: string[];
  authorWeights: Record<string, number>;
  genreWeights: Record<string, number>;
  tagWeights: Record<string, number>;
};

/**
 * Get the user's completed high-rating books to build a preference profile.
 */
export async function getHighRatedCompletedBooks(userId: string): Promise<PreferenceBook[]> {
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
export function buildPreferenceProfile(books: PreferenceBook[]): PreferenceProfile {
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

  const sortWeights = (weights: Map<string, number>) =>
    Array.from(weights.entries()).sort(
      ([nameA, countA], [nameB, countB]) =>
        countB - countA || nameA.localeCompare(nameB),
    );
  const authorWeights = Object.fromEntries(authorCounts);
  const genreWeights = Object.fromEntries(genreCounts);
  const tagWeights = Object.fromEntries(tagCounts);
  const topAuthors = sortWeights(authorCounts)
    .slice(0, 3)
    .map(([name]) => name);

  const topGenres = sortWeights(genreCounts)
    .slice(0, 3)
    .map(([name]) => name);

  const topTags = sortWeights(tagCounts)
    .slice(0, 5)
    .map(([key]) => key);

  return {
    topAuthors,
    topGenres,
    topTags,
    authorWeights,
    genreWeights,
    tagWeights,
  };
}

function weightsToTopKeys(value: Prisma.JsonValue, limit: number): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value)
    .filter((entry): entry is [string, number] =>
      typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] > 0,
    )
    .sort(([nameA, weightA], [nameB, weightB]) =>
      weightB - weightA || nameA.localeCompare(nameB),
    )
    .slice(0, limit)
    .map(([name]) => name);
}

export function preferenceProfileFromWeights(vector: {
  authorWeights: Prisma.JsonValue;
  genreWeights: Prisma.JsonValue;
  tagWeights: Prisma.JsonValue;
}): PreferenceProfile {
  return {
    topAuthors: weightsToTopKeys(vector.authorWeights, 3),
    topGenres: weightsToTopKeys(vector.genreWeights, 3),
    topTags: weightsToTopKeys(vector.tagWeights, 5),
    authorWeights: {},
    genreWeights: {},
    tagWeights: {},
  };
}

/** Rebuild the persisted profile from completed, highly rated books. */
export async function refreshUserPreferenceVector(userId: string) {
  const books = await getHighRatedCompletedBooks(userId);
  const profile = buildPreferenceProfile(books);
  const now = new Date();
  return prisma.userPreferenceVector.upsert({
    where: { userId },
    update: {
      authorWeights: profile.authorWeights,
      genreWeights: profile.genreWeights,
      tagWeights: profile.tagWeights,
      lastGeneratedAt: now,
      version: { increment: 1 },
    },
    create: {
      userId,
      authorWeights: profile.authorWeights,
      genreWeights: profile.genreWeights,
      tagWeights: profile.tagWeights,
      lastGeneratedAt: now,
    },
  });
}

export type UserPreferenceVector = Awaited<
  ReturnType<typeof refreshUserPreferenceVector>
>;

/**
 * Exclude books already in the user's library and recommendations previously
 * shown or marked read so refreshes do not resurrect them.
 */
async function getExcludedBooks(userId: string): Promise<{
  titles: Set<string>;
  workIds: Set<string>;
}> {
  const [books, recommendations] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      select: { title: true, openLibraryWorkId: true },
    }),
    prisma.personalizedRecommendation.findMany({
      where: { userId },
      select: { title: true, workId: true },
    }),
  ]);
  const titles = new Set(
    [...books, ...recommendations].map((book) =>
      book.title.normalize("NFKC").trim().toLowerCase(),
    ),
  );
  const workIds = new Set(
    [
      ...books.map((book) => book.openLibraryWorkId),
      ...recommendations.map((recommendation) => recommendation.workId),
    ].filter((workId): workId is string => Boolean(workId)),
  );

  return { titles, workIds };
}

type OpenLibraryDoc = {
  key?: unknown;
  id?: unknown;
  title?: unknown;
  author_name?: unknown;
  first_publish_year?: unknown;
};

function isOpenLibraryDoc(value: unknown): value is OpenLibraryDoc {
  return typeof value === "object" && value !== null;
}

function getWorkId(doc: OpenLibraryDoc): string | null {
  const key = typeof doc.key === "string" ? doc.key : doc.id;
  if (typeof key !== "string") return null;
  return key.startsWith("/works/") ? key.slice("/works/".length) : key;
}

async function searchOpenLibrary(
  query: { field: "author" | "subject"; term: string; score: number },
  excludedTitles: Set<string>,
  excludedWorkIds: Set<string>,
  alreadyAdded: Set<string>,
  limit: number,
  language: "spa" | null,
): Promise<PersonalizedRecommendation[]> {
  const searchParams = new URLSearchParams({
    [query.field]: query.term,
    limit: "20",
  });
  if (language) searchParams.set("language", language);
  const response = await fetch(
    `https://openlibrary.org/search.json?${searchParams.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`Open Library search failed (${response.status}).`);
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("docs" in payload) ||
    !Array.isArray(payload.docs)
  ) {
    throw new Error("Open Library returned an invalid search response.");
  }

  const recommendations: PersonalizedRecommendation[] = [];
  for (const rawDoc of payload.docs) {
    if (!isOpenLibraryDoc(rawDoc) || typeof rawDoc.title !== "string") continue;
    const workId = getWorkId(rawDoc);
    if (!workId) continue;
    const normalizedTitle = rawDoc.title.normalize("NFKC").trim().toLowerCase();
    if (
      excludedTitles.has(normalizedTitle) ||
      excludedWorkIds.has(workId) ||
      alreadyAdded.has(workId) ||
      alreadyAdded.has(normalizedTitle)
    ) {
      continue;
    }

    const authors = Array.isArray(rawDoc.author_name)
      ? rawDoc.author_name.filter(
          (author): author is string => typeof author === "string",
        )
      : [];
    recommendations.push({
      id: `ol-${workId}`,
      title: rawDoc.title,
      author: authors[0] ?? query.term,
      workId,
      firstPublishYear:
        typeof rawDoc.first_publish_year === "number"
          ? rawDoc.first_publish_year
          : null,
      reason:
        query.field === "author"
          ? `Based on books by ${query.term}`
          : `Based on your interest in ${query.term}`,
      source: "open_library",
      similarityScore: query.score,
    });
    alreadyAdded.add(workId);
    alreadyAdded.add(normalizedTitle);
    if (recommendations.length >= limit) break;
  }
  return recommendations;
}

async function searchOpenLibraryRecommendations(
  profile: PreferenceProfile,
  excludedTitles: Set<string>,
  excludedWorkIds: Set<string>,
  limit: number,
): Promise<PersonalizedRecommendation[]> {
  const queries = [
    ...profile.topAuthors.map((term) => ({ field: "author" as const, term, score: 50 })),
    ...profile.topGenres.map((term) => ({ field: "subject" as const, term, score: 40 })),
    ...profile.topTags.map((tag) => ({
      field: "subject" as const,
      term: tag.split(":").at(-1) ?? tag,
      score: 30,
    })),
  ];
  const recommendations: PersonalizedRecommendation[] = [];
  const alreadyAdded = new Set<string>();

  for (const language of ["spa", null] as const) {
    for (const query of queries) {
      if (recommendations.length >= limit) break;
      recommendations.push(
        ...await searchOpenLibrary(
          query,
          excludedTitles,
          excludedWorkIds,
          alreadyAdded,
          limit - recommendations.length,
          language,
        ),
      );
    }
    if (recommendations.length >= limit) break;
  }
  return recommendations;
}

/**
 * Generate recommendations from the persisted preference vector and the
 * user's library history. Persistence is handled by recommendation-service.
 */
export async function getPersonalizedRecommendationsForUser(
  userId: string,
  limit = 5,
): Promise<PersonalizedRecommendationsResult> {
  if (!userId || limit <= 0) {
    return {
      recommendations: [],
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
    };
  }

  // Check cache first for preference vector
  const cachedVector = preferenceVectorCache.get(userId);
  let vector: any;
  let highRatedBooks: any[];
  let exclusions: any;

  if (cachedVector && Date.now() - cachedVector.timestamp < PREFERENCE_VECTOR_TTL) {
    vector = cachedVector.data;
    highRatedBooks = [];
    exclusions = { titles: new Set(), workIds: new Set() };
  } else {
    const [vectorResult, highRatedBooksResult, exclusionsResult] = await Promise.all([
      prisma.userPreferenceVector.findUnique({
        where: { userId },
        select: { authorWeights: true, genreWeights: true, tagWeights: true },
      }),
      getHighRatedCompletedBooks(userId),
      getExcludedBooks(userId),
    ]);
    vector = vectorResult;
    highRatedBooks = highRatedBooksResult;
    exclusions = exclusionsResult;
    // Cache the vector if found
    if (vectorResult) {
      preferenceVectorCache.set(userId, { data: vectorResult, timestamp: Date.now() });
    }
  }

  const profile = vector
    ? preferenceProfileFromWeights(vector)
    : buildPreferenceProfile(highRatedBooks);
  const recommendations = await searchOpenLibraryRecommendations(
    profile,
    exclusions.titles,
    exclusions.workIds,
    limit,
  );
  return {
    recommendations,
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

/** Get personalized suggestions for the authenticated user without persisting them. */
export async function getPersonalizedRecommendations(
  limit = 5,
): Promise<PersonalizedRecommendationsResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      recommendations: [],
      engineVersion: ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
    };
  }
  return getPersonalizedRecommendationsForUser(user.id, limit);
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
