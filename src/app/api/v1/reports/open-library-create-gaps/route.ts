import { getOpenLibraryCreationGaps } from "@/lib/books";
import { buildCsvDocument } from "@/lib/csv";

function openLibrarySearchUrl(title: string, author: string): string {
  const query = `${title} ${author}`.trim();
  return `https://openlibrary.org/search?q=${encodeURIComponent(query)}`;
}

/**
 * Manual-creation report: books confirmed missing from Open Library after a
 * metadata check, with the data needed to create each record by hand (and
 * links that jump straight to Open Library's add/search pages). After creating
 * a book, retry its lookup on the tag-gaps report to link it automatically.
 */
export async function GET(): Promise<Response> {
  const books = await getOpenLibraryCreationGaps();

  const rows = [
    [
      "book_id",
      "title",
      "author",
      "publication_year",
      "pages",
      "genre",
      "existing_manual_tags",
      "suggested_subjects",
      "metadata_checked_at",
      "openlibrary_search_url",
      "openlibrary_add_url",
      "detail_url",
    ],
    ...books.map((book) => {
      const manualTags = book.tags.map(({ tag }) => tag.name);
      const suggestedSubjects = [
        book.genre?.name ?? "",
        ...manualTags,
      ]
        .filter(Boolean)
        .join("; ");
      return [
        book.id,
        book.title,
        book.author.name,
        book.publicationYear,
        book.totalPages,
        book.genre?.name ?? "",
        manualTags.join("; "),
        suggestedSubjects,
        book.metadataCheckedAt?.toISOString() ?? "",
        openLibrarySearchUrl(book.title, book.author.name),
        "https://openlibrary.org/add",
        `/books/${book.id}`,
      ];
    }),
  ];

  return new Response(buildCsvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="open-library-creation-gaps.csv"',
      "Cache-Control": "no-store",
    },
  });
}