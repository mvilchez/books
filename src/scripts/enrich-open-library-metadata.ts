import "dotenv/config";
import { BookTagCategory } from "@prisma/client";
import { replaceBookTags } from "@/lib/book-tags";
import { prisma } from "@/lib/prisma";
import { searchOpenLibraryBookLookup } from "@/lib/open-library-images";

const DEFAULT_DELAY_MS = 2_000;

function numericOption(name: string): number | undefined {
  const argument = process.argv.find((item) => item.startsWith(`${name}=`));
  if (!argument) return undefined;
  const value = Number(argument.slice(name.length + 1));
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const limit = numericOption("--limit");
  const delayMs = numericOption("--delay-ms") ?? DEFAULT_DELAY_MS;
  if (delayMs < 1_000) {
    throw new Error("--delay-ms must be at least 1000 to avoid rapid requests.");
  }

  try {
    const books = await prisma.book.findMany({
      where: { metadataCheckedAt: null },
      select: {
        id: true,
        title: true,
        totalPages: true,
        currentPages: true,
        publicationYear: true,
        openLibraryWorkId: true,
        openLibraryCoverId: true,
        isbn13: true,
        bookFormat: true,
        seriesName: true,
        seriesPosition: true,
        author: { select: { name: true } },
      },
      orderBy: [{ author: { name: "asc" } }, { title: "asc" }, { id: "asc" }],
      ...(limit ? { take: limit } : {}),
    });

    const mode = execute ? "EXECUTE" : "DRY RUN";
    console.log(`${mode}: ${books.length} unchecked books selected.`);
    if (!execute) {
      console.log(
        `No requests sent and no changes made. Rerun with --execute to query sequentially (at least ${delayMs}ms between requests).`,
      );
      return;
    }

    for (const [index, book] of books.entries()) {
      console.log(`[${index + 1}/${books.length}] Looking up "${book.title}" — ${book.author.name}`);
      const lookup = await searchOpenLibraryBookLookup(
        book.title,
        book.author.name,
        book.totalPages,
        book.publicationYear,
      );
      const checkedAt = new Date();

      await prisma.$transaction(async (transaction) => {
        const update = await transaction.book.updateMany({
          where: { id: book.id, metadataCheckedAt: null },
          data: {
            publicationYear:
              book.publicationYear ?? lookup.metadata?.firstPublishYear,
            totalPages:
              book.totalPages ??
              (lookup.metadata?.pageCount !== null &&
              lookup.metadata?.pageCount !== undefined &&
              book.currentPages <= lookup.metadata.pageCount
                ? lookup.metadata.pageCount
                : undefined),
            openLibraryWorkId: book.openLibraryWorkId ?? lookup.metadata?.workId,
            openLibraryCoverId: book.openLibraryCoverId ?? lookup.metadata?.coverId,
            isbn13: book.isbn13 ?? lookup.metadata?.isbn13,
            bookFormat: book.bookFormat ?? lookup.metadata?.format,
            seriesName: book.seriesName ?? lookup.metadata?.seriesName,
            seriesPosition: book.seriesPosition ?? lookup.metadata?.seriesPosition,
            metadataCheckedAt: checkedAt,
          },
        });
        if (update.count === 0) return;

        await transaction.bookMetadataCandidate.deleteMany({
          where: { bookId: book.id },
        });
        if (lookup.metadata) {
          await replaceBookTags(transaction, book.id, "OPEN_LIBRARY", [
            ...lookup.metadata.subjects.map((name) => ({
              category: BookTagCategory.SUBJECT,
              name,
            })),
            ...lookup.metadata.languages.map((name) => ({
              category: BookTagCategory.LANGUAGE,
              name,
            })),
            ...(lookup.metadata.format
              ? [{ category: BookTagCategory.FORMAT, name: lookup.metadata.format }]
              : []),
          ]);
        } else if (lookup.possibleMatches.length > 0) {
          await transaction.bookMetadataCandidate.createMany({
            data: lookup.possibleMatches.map((candidate) => ({
              bookId: book.id,
              workId: candidate.workId,
              title: candidate.title,
              authorNames: JSON.stringify(candidate.authors),
              subjects: JSON.stringify(candidate.subjects),
              firstPublishYear: candidate.firstPublishYear,
              coverId: candidate.coverId,
              titleSimilarity: candidate.titleSimilarity,
              authorSimilarity: candidate.authorSimilarity,
            })),
          });
        }
      });

      console.log(
        lookup.metadata
          ? "  Matched and saved metadata/tags."
          : `  No accepted match; saved ${lookup.possibleMatches.length} possible match(es).`,
      );
      if (index + 1 < books.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    console.log("Enrichment complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Open Library enrichment failed:", error);
  process.exitCode = 1;
});
