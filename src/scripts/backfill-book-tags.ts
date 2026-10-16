import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { buildLibraryBookTags, replaceManyBookTags } from "@/lib/book-tags";

async function main(): Promise<void> {
  try {
    const books = await prisma.book.findMany({
      select: {
        id: true,
        origin: true,
        genre: { select: { name: true } },
      },
    });
    await prisma.$transaction(
      async (transaction) => {
        await replaceManyBookTags(
          transaction,
          books.map((book) => ({
            bookId: book.id,
            tags: buildLibraryBookTags(book.genre?.name ?? null, book.origin),
          })),
          "LIBRARY",
        );
      },
      { timeout: 120_000 },
    );
    console.log(`Backfilled library tags for ${books.length} books.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Book tag backfill failed:", error);
  process.exitCode = 1;
});
