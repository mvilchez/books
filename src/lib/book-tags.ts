import { BookTagCategory, BookTagSource, Prisma } from "@prisma/client";
import { normalizeTagName } from "@/lib/tag-similarity";

export { normalizeTagName as normalizeTag } from "@/lib/tag-similarity";

export type BookTagInput = {
  category: BookTagCategory;
  name: string;
};

export function buildLibraryBookTags(
  genre: string | null,
  origin: string | null,
): BookTagInput[] {
  const tags: BookTagInput[] = [];
  if (genre?.trim()) {
    tags.push({ category: BookTagCategory.GENRE, name: genre.trim() });
  }
  if (
    origin &&
    ["ebook", "e-book", "digital"].includes(normalizeTagName(origin))
  ) {
    tags.push({ category: BookTagCategory.FORMAT, name: "E-book" });
  }
  return tags;
}

export async function replaceBookTags(
  transaction: Prisma.TransactionClient,
  bookId: string,
  source: BookTagSource,
  inputs: readonly BookTagInput[],
  category?: BookTagCategory,
): Promise<void> {
  await replaceManyBookTags(
    transaction,
    [{ bookId, tags: inputs }],
    source,
    category,
  );
}

export async function replaceManyBookTags(
  transaction: Prisma.TransactionClient,
  books: readonly { bookId: string; tags: readonly BookTagInput[] }[],
  source: BookTagSource,
  category?: BookTagCategory,
): Promise<void> {
  const tagsByBook = new Map(books.map(({ bookId, tags }) => [bookId, tags]));
  if (tagsByBook.size === 0) return;
  const bookIds = [...tagsByBook.keys()];
  await transaction.bookTag.deleteMany({
    where: {
      bookId: { in: bookIds },
      source,
      ...(category ? { tag: { category } } : {}),
    },
  });

  const uniqueTags = new Map<string, BookTagInput>();
  for (const inputs of tagsByBook.values()) {
    for (const input of inputs) {
      if (category && input.category !== category) continue;
      const name = input.name.trim().slice(0, 191);
      const normalizedName = normalizeTagName(name);
      if (!normalizedName) continue;
      uniqueTags.set(`${input.category}:${normalizedName}`, {
        category: input.category,
        name,
      });
    }
  }

  const tagIds = new Map<string, string>();
  for (const [key, input] of uniqueTags) {
    const normalizedName = normalizeTagName(input.name);
    const tag = await transaction.tag.upsert({
      where: {
        category_normalizedName: {
          category: input.category,
          normalizedName,
        },
      },
      create: {
        category: input.category,
        name: input.name,
        normalizedName,
      },
      update: {},
      select: { id: true },
    });
    tagIds.set(key, tag.id);
  }

  const links: { bookId: string; tagId: string; source: BookTagSource }[] = [];
  for (const [bookId, inputs] of tagsByBook) {
    const bookTagIds = new Set(
      inputs
        .filter((input) => !category || input.category === category)
        .map((input) => {
          const name = input.name.trim().slice(0, 191);
          return tagIds.get(`${input.category}:${normalizeTagName(name)}`);
        })
        .filter((tagId): tagId is string => tagId !== undefined),
    );
    for (const tagId of bookTagIds) links.push({ bookId, tagId, source });
  }
  if (links.length > 0) {
    await transaction.bookTag.createMany({
      data: links,
      skipDuplicates: true,
    });
  }
}
