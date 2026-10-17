import { parseBookSearchQuery } from "@/lib/book-search";
import { searchBooksAndTags } from "@/lib/books";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsedQuery = parseBookSearchQuery(url.searchParams.getAll("q"));
  if (!parsedQuery.valid) {
    return Response.json(
      { error: `Invalid search query: ${parsedQuery.reason}` },
      { status: 400 },
    );
  }

  const { results, tags } = await searchBooksAndTags(parsedQuery.query);

  return Response.json({ results, tags });
}
