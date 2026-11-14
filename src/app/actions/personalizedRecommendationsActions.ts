"use server";

import { getCurrentUser } from "@/lib/auth";
import {
  getHighRatedCompletedBooks,
  refreshUserPreferenceVector,
  type UserPreferenceVector,
} from "@/lib/personalized-recommendations";

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
 * 2. Builds and saves the vector used by personalized recommendations.
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

    const vector = await refreshUserPreferenceVector(user.id);

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