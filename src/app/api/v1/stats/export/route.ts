import { getCompletedBooksForExport } from "@/lib/books";
import { buildCsvDocument } from "@/lib/csv";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  const books = await getCompletedBooksForExport(year);

  const rows = [
    [
      "book_id",
      "title",
      "author",
      "genre",
      "rating",
      "pages",
      "reading_year",
      "publication_year",
      "origin",
      "series",
      "finish_date",
    ],
    ...books.map((b) => [
      b.id,
      b.title,
      b.author.name,
      b.genre?.name ?? "",
      b.rating ?? "",
      b.totalPages ?? "",
      b.readingYear,
      b.publicationYear ?? "",
      b.origin ?? "",
      b.seriesName ?? "",
      b.finishDate?.toISOString().slice(0, 10) ?? "",
    ]),
  ];

  const csv = buildCsvDocument(rows);
  const filename = year ? `stats-${year}.csv` : "stats-all.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}