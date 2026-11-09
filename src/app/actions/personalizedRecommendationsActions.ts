"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getHighRatedCompletedBooks, buildPreferenceProfile } from "@/lib/personalized-recommendations";
import { Prisma } from "@prisma/client";

// Type for user preference vectors (matches prisma.schema UserPreferenceVector)
type UserPreferenceVector = {
  id: string;
  userId: string;
  authorWeights: Prisma.JsonValue;
  genreWeights: Prisma.JsonValue;
  tagWeights: Prisma.JsonValue;
  lastGeneratedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type BuildPreferenceProfileResult = {
  status: "idle" | "success" | "error";
  message: string;
  vector?: UserPreferenceVector;
};

/**
 * Server Action — build and save user preference profile vector.
 *
 * This action:
 * 1. Gets the current user's high-rated completed books (rating >= 7)
 * 2. Builds a preference profile using buildPreferenceProfile()
 * 3. Saves/upverts the preference vector to user_preference_vectors table
 */
export async function buildPreferenceProfileAction(
  _previous: BuildPreferenceProfileResult,
  _formData: FormData
): Promise<BuildPreferenceProfileResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        status: "error",
        message: "User not authenticated.",
      };
    }

    // Step 1: Get high-rated completed books
    const highRatedBooks = await getHighRatedCompletedBooks(user.id);
    if (highRatedBooks.length === 0) {
      return {
        status: "error",
        message:
          "No high-rated completed books found to build a preference profile. Read and rate books first.",
      };
    }

    // Step 2: Build the preference profile
    const profile = buildPreferenceProfile(highRatedBooks);

    // Step 3: Upsert the preference vector
    const now = new Date();

    const vector = await prisma.userPreferenceVector.upsert({
      where: { userId: user.id },
      update: {
        authorWeights: profile.topAuthors.reduce(
          (acc: Record<string, number>, author: string) => {
            acc[author] = (acc[author] ?? 0) + 1;
            return acc;
          },
          {}
        ),
        genreWeights: profile.topGenres.reduce(
          (acc: Record<string, number>, genre: string) => {
            acc[genre] = (acc[genre] ?? 0) + 1;
            return acc;
          },
          {}
        ),
        tagWeights: profile.topTags.reduce(
          (acc: Record<string, number>, tag: string) => {
            acc[tag] = (acc[tag] ?? 0) + 1;
            return acc;
          },
          {}
        ),
        lastGeneratedAt: now,
        version: {
          increment: 1,
        },
      },
      create: {
        userId: user.id,
        authorWeights: profile.topAuthors.reduce(
          (acc: Record<string, number>, author: string) => {
            acc[author] = (acc[author] ?? 0) + 1;
            return acc;
          },
          {}
        ),
        genreWeights: profile.topGenres.reduce(
          (acc: Record<string, number>, genre: string) => {
            acc[genre] = (acc[genre] ?? 0) + 1;
            return acc;
          },
          {}
        ),
        tagWeights: profile.topTags.reduce(
          (acc: Record<string, number>, tag: string) => {
            acc[tag] = (acc[tag] ?? 0) + 1;
            return acc;
          },
          {}
        ),
        lastGeneratedAt: now,
        version: 1,
      },
    });

    return {
      status: "success",
      message: "Preference profile built successfully.",
      vector,
    };
  } catch (error) {
    console.error("Error building preference profile:", error);
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Could not build preference profile.",
    };
  }
}