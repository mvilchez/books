import { revalidatePath } from "next/cache";
import { BookTagCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { replaceManyBookTags } from "@/lib/book-tags";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 2_000;
const MAX_TOTAL_TAGS = 10_000;

export async function POST(request: Request): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Upload a CSV file using the 'file' field.");
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return badRequest("Choose a non-empty CSV file.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return badRequest("CSV file must be 10 MB or smaller.");
  }

  let rows: string[][];
  try {
    rows = parseCsv(await file.text());
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid CSV file.");
  }
  if (rows.length < 2) return badRequest("CSV must contain a header and at least one book.");
  if (rows.length - 1 > MAX_ROWS) {
    return badRequest(`CSV cannot contain more than ${MAX_ROWS} books.`);
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const bookIdIndex = headers.indexOf("book_id");
  const tagsIndex = headers.indexOf("manual_tags");
  if (bookIdIndex < 0 || tagsIndex < 0) {
    return badRequest("CSV must contain 'book_id' and 'manual_tags' columns.");
  }

  const entries = new Map<string, string[]>();
  let totalTags = 0;
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const bookId = row[bookIdIndex]?.trim();
    if (!bookId) return badRequest(`Row ${index + 1} is missing a book_id.`);
    if (entries.has(bookId)) {
      return badRequest(`Book ${bookId} appears more than once in the CSV.`);
    }
    const names = [...new Set(
      (row[tagsIndex] ?? "")
        .split(/[;\n]/u)
        .map((name) => name.trim())
        .filter(Boolean),
    )];
    if (names.some((name) => name.length > 191)) {
      return badRequest(`A tag in row ${index + 1} exceeds 191 characters.`);
    }
    totalTags += names.length;
    if (totalTags > MAX_TOTAL_TAGS) {
      return badRequest(`CSV cannot contain more than ${MAX_TOTAL_TAGS} manual tags.`);
    }
    entries.set(bookId, names);
  }

  const bookIds = [...entries.keys()];
  const existingBooks = await prisma.book.findMany({
    where: { id: { in: bookIds } },
    select: { id: true },
  });
  if (existingBooks.length !== bookIds.length) {
    const existingIds = new Set(existingBooks.map(({ id }) => id));
    const missingId = bookIds.find((id) => !existingIds.has(id));
    return badRequest(`Book ${missingId} does not exist in the database.`);
  }

  try {
    await prisma.$transaction(
      async (transaction) => {
        await replaceManyBookTags(
          transaction,
          [...entries].map(([bookId, names]) => ({
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
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Manual tag import failed: ${error.message}`
            : "Manual tag import failed.",
      },
      { status: 500 },
    );
  }

  revalidatePath("/");
  revalidatePath("/reports/open-library-tags");
  return Response.json({
    success: true,
    updatedBooks: bookIds.length,
    savedTags: totalTags,
  });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}
