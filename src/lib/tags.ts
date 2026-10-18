/**
 * Tags data-access service (PLAN.md — Encapsulation Validation).
 *
 * `Tag`/`BookTag` queries live here only; the app layer consumes these
 * functions. Tag categories/sources are applied inside this module so route
 * handlers and server actions never import `@prisma/client` at runtime.
 */
import { BookTagCategory, BookTagSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replaceBookTags, replaceManyBookTags } from "@/lib/book-tags";

export function isBookTagSource(value: string): value is BookTagSource {
  return value === "LIBRARY" || value === "OPEN_LIBRARY";
}

/** How many OPEN_LIBRARY SUBJECT tags a book currently has (never negative). */
export async function countOpenLibrarySubjectTags(
  bookId: string,
): Promise<number> {
  return prisma.bookTag.count({
    where: {
      bookId,
      source: "OPEN_LIBRARY",
      tag: { category: "SUBJECT" },
    },
  });
}

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
  const storedTags = await prisma.$queryRaw<
    { id: string; name: string; category: BookTagCategory; count: bigint }[]
  >`
    SELECT t.id, t.name, t.category, COUNT(DISTINCT bt.book_id) AS count
    FROM Tag AS t
    INNER JOIN book_tags AS bt ON bt.tag_id = t.id
    GROUP BY t.id, t.name, t.category
    ORDER BY t.category ASC, t.name ASC
  `;
  return storedTags.map(({ count, ...tag }) => ({
    ...tag,
    count: Number(count),
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

/** Remove one source-specific tag association from a book. */
export async function deleteBookTag(
  bookId: string,
  tagId: string,
  source: BookTagSource,
): Promise<{ deleted: boolean }> {
  const result = await prisma.bookTag.deleteMany({
    where: {
      bookId,
      tagId,
      source,
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

    await transaction.$executeRaw`
      INSERT INTO book_tags (book_id, tag_id, source, created_at)
      SELECT book_id, ${keepTag.id}, source, created_at
      FROM book_tags
      WHERE tag_id = ${mergeTag.id}
      ON DUPLICATE KEY UPDATE tag_id = VALUES(tag_id)
    `;
    await transaction.bookTag.deleteMany({ where: { tagId: mergeTag.id } });
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
