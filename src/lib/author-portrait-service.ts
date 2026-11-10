/**
 * Author Portrait Service (PLAN.md — Encapsulation Validation).
 *
 * This module encapsulates all Prisma client queries and filesystem operations
 * related to author portrait caching. API routes, route handlers, and server
 * actions must import from this module instead of using the Prisma client or
 * `fs` directly.
 */
import { prisma } from "@/lib/prisma";
import {
  searchOpenLibraryAuthorPhotos,
  getOpenLibraryAuthorUrl,
  getLocalPortraitPath,
} from "@/lib/open-library-images";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export type AuthorPortraitCacheDetail = {
  authorId: string;
  name: string;
  status: "downloaded" | "skipped" | "error";
  message: string;
  portraitUrl?: string | null;
};

export type AuthorPortraitCacheResult = {
  downloaded: number;
  skipped: number;
  errors: number;
  total: number;
  details: AuthorPortraitCacheDetail[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Returns every author that does not already have a local `/portraits/...` URL. */
export async function findAuthorsWithoutLocalPortrait(): Promise<{
  id: string;
  name: string;
  portraitUrl: string | null;
}[]> {
  const authors = await prisma.author.findMany({
    select: { id: true, name: true, portraitUrl: true },
    orderBy: { name: "asc" },
  });
  return authors.filter(
    (a) => !a.portraitUrl?.startsWith("/portraits/"),
  );
}

/**
 * Bulk-cache every missing author portrait from Open Library into
 * `public/portraits/` and update the `Author.portrait_url` column to the local
 * path. One author is processed at a time (with a small politeness delay) so a
 * single failure never aborts the whole batch.
 */
export async function cacheAllAuthorPortraits(): Promise<
  AuthorPortraitCacheResult
> {
  const authors = await findAuthorsWithoutLocalPortrait();
  const details: AuthorPortraitCacheDetail[] = [];
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  const portraitsDir = path.join("public", "portraits");
  if (!fs.existsSync(portraitsDir)) {
    fs.mkdirSync(portraitsDir, { recursive: true });
  }

  for (const author of authors) {
    try {
      // Search Open Library for this author's photo by name.
      const photoCandidates = await searchOpenLibraryAuthorPhotos(author.name);

      if (photoCandidates.length === 0) {
        skipped++;
        details.push({
          authorId: author.id,
          name: author.name,
          status: "skipped",
          message: "no Open Library photo available",
        });
        continue;
      }

      const candidate = photoCandidates[0];
      const sourceUrl = getOpenLibraryAuthorUrl(candidate.authorId);

      // Skip if already cached on disk (dedup by Open Library photo ID).
      if (fs.existsSync(getLocalPortraitPath(candidate.photoId, "S"))) {
        skipped++;
        details.push({
          authorId: author.id,
          name: author.name,
          status: "skipped",
          message: "already cached locally",
          portraitUrl: `/portraits/ol${candidate.photoId}-S.webp`,
        });
        continue;
      }

      // Download the image.
      const response = await fetch(candidate.photoUrl);
      if (!response.ok) {
        skipped++;
        details.push({
          authorId: author.id,
          name: author.name,
          status: "skipped",
          message: `failed to fetch (HTTP ${response.status})`,
        });
        continue;
      }

      const buffer = await response.arrayBuffer();

      // Convert to WebP.
      const webpBuffer = await sharp(Buffer.from(buffer))
        .webp({ quality: 75 })
        .toBuffer();

      const filename = `ol${candidate.photoId}-S.webp`;
      const filePath = getLocalPortraitPath(candidate.photoId, "S");
      fs.writeFileSync(filePath, webpBuffer);

      // Update the author record to point at the local portrait.
      await prisma.author.update({
        where: { id: author.id },
        data: {
          portraitUrl: `/portraits/${filename}`,
          portraitSourceUrl: sourceUrl,
          portraitArtist: "Open Library",
          portraitLicense: "Public Domain",
          portraitLicenseUrl: "https://openlibrary.org/about/terms",
        },
      });

      downloaded++;
      details.push({
        authorId: author.id,
        name: author.name,
        status: "downloaded",
        message: `cached as /portraits/${filename}`,
        portraitUrl: `/portraits/${filename}`,
      });

      // Be polite to Open Library API: small delay between requests.
      await sleep(150);
    } catch (error) {
      errors++;
      details.push({
        authorId: author.id,
        name: author.name,
        status: "error",
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  return {
    downloaded,
    skipped,
    errors,
    total: authors.length,
    details,
  };
}
