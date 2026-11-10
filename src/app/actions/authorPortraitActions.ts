"use server";

import { cacheAllAuthorPortraits } from "@/lib/author-portrait-service";

export type AuthorPortraitActionResult = {
  status: "idle" | "error" | "success";
  message: string;
  downloaded: number;
  skipped: number;
  errors: number;
  total: number;
};

/**
 * Server Action — bulk-cache every missing author portrait from Open Library
 * into `public/portraits/` and point `Author.portrait_url` at the local files.
 *
 * Runs on the server because it touches Prisma and the filesystem (neither of
 * which is available in the browser).
 */
export async function cacheAllAuthorPortraitsAction(): Promise<
  AuthorPortraitActionResult
> {
  try {
    const result = await cacheAllAuthorPortraits();
    return {
      status: "success",
      message: `Cached ${result.downloaded} portrait(s), skipped ${result.skipped}, ${result.errors} error(s).`,
      downloaded: result.downloaded,
      skipped: result.skipped,
      errors: result.errors,
      total: result.total,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "Could not cache author portraits.",
      downloaded: 0,
      skipped: 0,
      errors: 0,
      total: 0,
    };
  }
}
