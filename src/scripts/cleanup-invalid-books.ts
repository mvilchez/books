import "dotenv/config";
import {
  editionKeyFromMetadata,
  isFooterTitle,
  isNumericAggregatePair,
  normalize,
} from "@/lib/ingestion/workbook-parser";
import { prisma } from "@/lib/prisma";

const execute = process.argv.includes("--execute");

async function main(): Promise<void> {
  try {
    const books = await prisma.book.findMany({
      select: {
        id: true,
        title: true,
        readingYear: true,
        publicationYear: true,
        totalPages: true,
        editionKey: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    const summaryBooks = books.filter(
      (book) => isFooterTitle(book.title) || isNumericAggregatePair(book.title, book.author.name),
    );
    const validBooks = books.filter((book) => !summaryBooks.includes(book));
    const duplicateGroups = new Map<string, typeof validBooks>();
    let ambiguousEditionCount = 0;

    for (const book of validBooks) {
      const editionKey =
        book.editionKey ||
        editionKeyFromMetadata(book.publicationYear, book.totalPages);
      if (editionKey === editionKeyFromMetadata(null, null)) {
        ambiguousEditionCount++;
        continue;
      }

      const key = [
        normalize(book.title),
        normalize(book.author.name),
        book.readingYear,
        editionKey,
      ].join("\u0000");
      duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), book]);
    }

    const duplicateRecords = [...duplicateGroups.values()]
      .filter((group) => group.length > 1)
      .flatMap((group) =>
        group
          .sort(
            (left, right) =>
              left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id),
          )
          .slice(1),
      );
    const deleteBooks = [...summaryBooks, ...duplicateRecords];

    if (deleteBooks.length === 0) {
      console.log("No footer rows or duplicate reading entries found in the Book table.");
      if (ambiguousEditionCount > 0) {
        console.log(
          `Skipped duplicate detection for ${ambiguousEditionCount} row(s) without edition metadata.`,
        );
      }
      return;
    }

    console.log(
      `${execute ? "Deleting" : "Dry run:"} ${summaryBooks.length} summary row(s) and ` +
        `${duplicateRecords.length} duplicate reading row(s).`,
    );
    for (const book of summaryBooks) {
      console.log(
        `  summary · ${book.readingYear} · "${book.title}" by "${book.author.name}" [${book.id}]`,
      );
    }
    for (const book of duplicateRecords) {
      console.log(
        `  duplicate · ${book.readingYear} · "${book.title}" by "${book.author.name}" ` +
          `(${book.editionKey || editionKeyFromMetadata(book.publicationYear, book.totalPages)}) [${book.id}]`,
      );
    }
    if (ambiguousEditionCount > 0) {
      console.log(
        `Skipped duplicate detection for ${ambiguousEditionCount} row(s) without edition metadata.`,
      );
    }

    if (!execute) {
      console.log("\nNo rows were changed. Re-run with --execute to delete only these rows.");
      return;
    }

    const ids = deleteBooks.map((book) => book.id);
    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.book.deleteMany({ where: { id: { in: ids } } });
      if (result.count !== ids.length) {
        throw new Error(`Expected to delete ${ids.length} rows, but deleted ${result.count}.`);
      }
      return result.count;
    });
    console.log(
      `Deleted ${deleted} row(s): ${summaryBooks.length} summary and ${duplicateRecords.length} duplicate reading row(s).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Book cleanup failed:", error);
  process.exitCode = 1;
});
