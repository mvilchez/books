import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getBookCoverUrl, getLocalCoverPath, localCoverExists } from "@/lib/book-cover";
import fs from "fs";
import path from "path";
import sharp from "sharp";

async function main(): Promise<void> {
  const books = await prisma.book.findMany({
    where: {
      openLibraryCoverId: { not: null },
    },
    select: {
      id: true,
      openLibraryCoverId: true,
      title: true,
      isbn13: true,
    },
    orderBy: { title: "asc" },
  });

  console.log(`Found ${books.length} books with Open Library cover IDs.`);

  let downloaded = 0;
  let skipped = 0;

  for (const book of books) {
    try {
      const coverId = book.openLibraryCoverId!;

      // Skip if already cached (dedup by Open Library ID, not book UUID)
      if (localCoverExists(coverId, "S")) {
        skipped++;
        console.log(`  SKIP ${book.id}: "${book.title}" - already cached`);
        continue;
      }

      const coverUrl = getBookCoverUrl(book.isbn13 ?? "", coverId, "S");

      if (!coverUrl) {
        skipped++;
        console.log(`  SKIP ${book.id}: "${book.title}" - could not generate cover URL`);
        continue;
      }

      // Download the image
      const response = await fetch(coverUrl);
      if (!response.ok) {
        skipped++;
        console.log(`  SKIP ${book.id}: "${book.title}" - failed to fetch ${coverUrl}`);
        continue;
      }

      const buffer = await response.arrayBuffer();

      // Convert to WebP
      const webpBuffer = await sharp(Buffer.from(buffer))
        .webp({ quality: 75 })
        .toBuffer();

      const filename = `ol${coverId}-S.webp`;
      const filePath = getLocalCoverPath(coverId, "S");

      // Ensure directory exists
      const dir = path.join("public", "covers");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Save file
      fs.writeFileSync(filePath, webpBuffer);

      console.log(`  DOWN ${book.id}: "${book.title}" -> ${filename}`);
      downloaded++;
    } catch (error) {
      skipped++;
      console.error(`  ERROR ${book.id}: "${book.title}" -`, error);
    }
  }

  console.log(`\nDone: ${downloaded} covers downloaded, ${skipped} skipped.`);
}

main().catch((error) => {
  console.error("Cache covers failed:", error);
  process.exitCode = 1;
});
