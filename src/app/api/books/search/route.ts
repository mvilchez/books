import { prisma } from "@/lib/prisma";
import {
  BOOK_SEARCH_RESULT_LIMIT,
  escapeBookSearchWildcards,
  parseBookSearchQuery,
} from "@/lib/book-search";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsedQuery = parseBookSearchQuery(url.searchParams.getAll("q"));
  if (!parsedQuery.valid) {
    return Response.json(
      { error: `Invalid search query: ${parsedQuery.reason}` },
      { status: 400 },
    );
  }

  const [books, tags] = await Promise.all([
    prisma.book.findMany({
      where: {
        OR: [
          { title: { contains: escapeBookSearchWildcards(parsedQuery.query) } },
          {
            author: {
              name: { contains: escapeBookSearchWildcards(parsedQuery.query) },
            },
          },
        ],
      },
      select: {
        id: true,
        title: true,
        readingYear: true,
        author: {
          select: {
            name: true,
            portraitUrl: true,
            portraitSourceUrl: true,
            portraitArtist: true,
            portraitLicense: true,
            portraitLicenseUrl: true,
          },
        },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: BOOK_SEARCH_RESULT_LIMIT,
    }),
    prisma.tag.findMany({
      where: {
        name: { contains: escapeBookSearchWildcards(parsedQuery.query) },
        books: { some: {} },
      },
      select: {
        id: true,
        name: true,
        category: true,
        _count: { select: { books: true } },
      },
      orderBy: [{ books: { _count: "desc" } }, { name: "asc" }],
      take: 5,
    }),
  ]);

  return Response.json({
    results: books.map(({ id, title, readingYear, author }) => ({
      id,
      title,
      author,
      readingYear,
    })),
    tags: tags.map(({ _count, ...tag }) => ({
      ...tag,
      bookCount: _count.books,
    })),
  });
}
