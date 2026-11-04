import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  searchOpenLibraryAuthorPhotos,
  getOpenLibraryAuthorUrl,
  getLocalPortraitPath,
  localPortraitExists,
} from "@/lib/open-library-images";
import fs from "fs";
import path from "path";
import sharp from "sharp";

interface AuthorPortraitData {
  authorId: string;
  name: string;
  portraitUrl: string | null;
  portraitSourceUrl: string | null;
  portraitArtist: string | null;
  portraitLicense: string | null;
  portraitLicenseUrl: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  // Find authors without portrait URLs or with missing data
  const authors = await prisma.author.findMany({
    where: {
      OR: [
        { portraitUrl: null },
        { portraitSourceUrl: null },
      ],
    },
    select: {
      id: true,
      name: true,
      wikidataId: true,
    },
    orderBy: { name: "asc" },
  });

  console.log(`Found ${authors.length} authors needing portrait sync.`);

  let downloaded = 0;
  let skipped = 0;

  for (const author of authors) {
    try {
      // Search Open Library for this author's photo by name.
      // This resolves the Open Library author ID, fetches the profile,
      // and returns a ready-to-use photo URL (small size).
      const photoCandidates = await searchOpenLibraryAuthorPhotos(author.name);

      if (photoCandidates.length === 0) {
        skipped++;
        console.log(
          `  SKIP ${author.id}: "${author.name}" - no Open Library photo available`,
        );
        continue;
      }

      // Use the first candidate (prioritized by exact name match)
      const candidate = photoCandidates[0];
      const photoUrl = candidate.photoUrl;
      const sourceUrl = getOpenLibraryAuthorUrl(candidate.authorId);

      // Skip if already cached (dedup by Open Library photo ID)
      if (localPortraitExists(candidate.photoId, "S")) {
        skipped++;
        console.log(
          `  SKIP ${author.id}: "${author.name}" - already cached`,
        );
        continue;
      }

      // Download the image
      const response = await fetch(photoUrl);
      if (!response.ok) {
        skipped++;
        console.log(
          `  SKIP ${author.id}: "${author.name}" - failed to fetch ${photoUrl}`,
        );
        continue;
      }

      const buffer = await response.arrayBuffer();

      // Convert to WebP
      const webpBuffer = await sharp(Buffer.from(buffer))
        .webp({ quality: 75 })
        .toBuffer();

      const filename = `ol${candidate.photoId}-S.webp`;
      const filePath = getLocalPortraitPath(candidate.photoId, "S");

      // Ensure directory exists
      const dir = path.join("public", "portraits");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save file
      fs.writeFileSync(filePath, webpBuffer);

      // Update the author record in the database
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

      console.log(
        `  DOWN ${author.id}: "${author.name}" -> /portraits/${filename}`,
      );
      downloaded++;

      // Be polite to Open Library API: small delay between requests
      await sleep(200);
    } catch (error) {
      skipped++;
      console.error(
        `  ERROR ${author.id}: "${author.name}" -`,
        error,
      );
    }
  }

  console.log(`\nDone: ${downloaded} portraits downloaded, ${skipped} skipped.`);
}

main().catch((error) => {
  console.error("Cache author portraits failed:", error);
  process.exitCode = 1;
});
