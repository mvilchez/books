import { prisma } from "@/lib/prisma";

function csvCell(value: string | number | null): string {
  const rawText = value === null ? "" : String(value);
  const text = /^[\s]*[=+\-@]/u.test(rawText) ? `'${rawText}` : rawText;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(): Promise<Response> {
  const books = await prisma.book.findMany({
    where: { tags: { none: { source: "OPEN_LIBRARY" } } },
    select: {
      id: true,
      title: true,
      author: { select: { name: true } },
      publicationYear: true,
      totalPages: true,
      metadataCheckedAt: true,
      genre: { select: { name: true } },
      tags: {
        where: {
          source: "LIBRARY",
          tag: { category: "SUBJECT" },
        },
        include: { tag: true },
      },
    },
    orderBy: [{ metadataCheckedAt: "desc" }, { author: { name: "asc" } }, { title: "asc" }],
  });

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
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="open-library-tag-gaps.csv"',
      "Cache-Control": "no-store",
    },
  });
}
