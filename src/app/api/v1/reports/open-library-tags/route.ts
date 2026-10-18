import { getBooksWithoutOpenLibraryTags } from "@/lib/books";
import { buildCsvDocument } from "@/lib/csv";

export async function GET(): Promise<Response> {
  const books = await getBooksWithoutOpenLibraryTags();

  const rows = [
    [
      "book_id",
      "title",
      "author",
      "status",
      "genre",
      "manual_tags",
      "publication_year",
      "pages",
      "metadata_checked_at",
      "detail_url",
    ],
    ...books.map((book) => [
      book.id,
      book.title,
      book.author.name,
      book.metadataCheckedAt ? "checked_no_open_library_tags" : "not_checked",
      book.genre?.name ?? "",
      book.tags.map(({ tag }) => tag.name).join("; "),
      book.publicationYear,
      book.totalPages,
      book.metadataCheckedAt?.toISOString() ?? "",
      `/books/${book.id}`,
    ]),
  ];
  const csv = buildCsvDocument(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="open-library-tag-gaps.csv"',
      "Cache-Control": "no-store",
    },
  });
}
