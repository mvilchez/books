/**
 * Tags data-access service (PLAN.md — Encapsulation Validation).
 *
 * `Tag`/`BookTag` queries live here only; the app layer consumes these
 * functions. Tag categories/sources are applied inside this module so route
 * handlers and server actions never import `@prisma/client` at runtime.
 */
import { BookTagCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replaceBookTags, replaceManyBookTags } from "@/lib/book-tags";

export type UsedTag = {
  id: string;
  name: string;
  category: BookTagCategory;
  count: number;
};

/**
 * Every tag attached to at least one book, with its distinct book count.
 * Ordered by category then name; callers may re-sort (e.g. dashboard by
 * popularity).
 */
export async function getUsedTags(): Promise<UsedTag[]> {
  const storedTags = await prisma.tag.findMany({
    where: { books: { some: {} } },
    select: {
      id: true,
      name: true,
      category: true,
      books: { select: { bookId: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return storedTags.map(({ books, ...tag }) => ({
    ...tag,
    count: new Set(books.map(({ bookId }) => bookId)).size,
  }));
}

/** A tag with its books (author + genre included), or `null`. */
export async function getTagWithBooks(id: string) {
  return prisma.tag.findUnique({
    where: { id },
    include: {
      books: {
        include: {
          book: { include: { author: true, genre: true } },
        },
        orderBy: { book: { title: "asc" } },
      },
    },
  });
}

/** SUBJECT tags used at least once — datalist options for the detail form. */
export async function getSubjectTagOptions(): Promise<
  { id: string; name: string }[]
> {
  return prisma.tag.findMany({
    where: {
      category: "SUBJECT",
      books: { some: {} },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 500,
  });
}

/** Replace a book's LIBRARY SUBJECT tags with the given names. */
export async function saveManualSubjectTags(
  bookId: string,
  names: readonly string[],
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.book.findUniqueOrThrow({
      where: { id: bookId },
      select: { id: true },
    });
    await replaceBookTags(
      transaction,
      bookId,
      "LIBRARY",
      names.map((name) => ({ category: BookTagCategory.SUBJECT, name })),
      BookTagCategory.SUBJECT,
    );
  });
}

/** Remove one LIBRARY SUBJECT tag from a book. */
export async function deleteManualSubjectTag(
  bookId: string,
  tagId: string,
): Promise<{ deleted: boolean }> {
  const result = await prisma.bookTag.deleteMany({
    where: {
      bookId,
      tagId,
      source: "LIBRARY",
      tag: { category: BookTagCategory.SUBJECT },
    },
  });
  return { deleted: result.count > 0 };
}

/**
 * Merge `mergeTagId` into `keepTagId`: move every book relationship across,
 * then delete the merged tag. Both tags must exist and share a category.
 */
export async function mergeTags(
  keepTagId: string,
  mergeTagId: string,
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    const [keepTag, mergeTag] = await Promise.all([
      transaction.tag.findUnique({ where: { id: keepTagId } }),
      transaction.tag.findUnique({ where: { id: mergeTagId } }),
    ]);
    if (!keepTag || !mergeTag) {
      throw new Error("One of the selected tags no longer exists.");
    }
    if (keepTag.category !== mergeTag.category) {
      throw new Error("Tags from different categories cannot be merged.");
    }

    const relationships = await transaction.bookTag.findMany({
      where: { tagId: mergeTag.id },
      select: { bookId: true, source: true },
    });
    for (const relationship of relationships) {
      const existing = await transaction.bookTag.findUnique({
        where: {
          bookId_tagId_source: {
            bookId: relationship.bookId,
            tagId: keepTag.id,
            source: relationship.source,
          },
        },
        select: { bookId: true },
      });
      if (existing) {
        await transaction.bookTag.delete({
          where: {
            bookId_tagId_source: {
              bookId: relationship.bookId,
              tagId: mergeTag.id,
              source: relationship.source,
            },
          },
        });
      } else {
        await transaction.bookTag.update({
          where: {
            bookId_tagId_source: {
              bookId: relationship.bookId,
              tagId: mergeTag.id,
              source: relationship.source,
            },
          },
          data: { tagId: keepTag.id },
        });
      }
    }
    await transaction.tag.delete({ where: { id: mergeTag.id } });
  });
}

/**
 * Bulk-replace LIBRARY SUBJECT tags for many books in one transaction
 * (manual-tag CSV import). Every book id must already be validated to exist.
 */
export async function importManualSubjectTags(
  entries: readonly { bookId: string; names: readonly string[] }[],
): Promise<{ updatedBooks: number; savedTags: number }> {
  const savedTags = entries.reduce((total, entry) => total + entry.names.length, 0);
  await prisma.$transaction(
    async (transaction) => {
      await replaceManyBookTags(
        transaction,
        entries.map(({ bookId, names }) => ({
          bookId,
          tags: names.map((name) => ({
            category: BookTagCategory.SUBJECT,
            name,
          })),
        })),
        "LIBRARY",
        BookTagCategory.SUBJECT,
      );
    },
    { timeout: 120_000 },
  );
  return { updatedBooks: entries.length, savedTags };
}
