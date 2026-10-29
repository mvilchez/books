import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBooksForExport, type ExportedBook } from "@/lib/books";
import ExcelJS from "exceljs";

/** Columns for the exported Excel file, matching the import format. */
const EXPORT_COLUMNS = [
  "Titulo",
  "Autor",
  "Paginas",
  "Fecha Inicio",
  "Fecha Fin",
  "Tipo",
  "Puntuación",
  "Num leídos",
  "Año",
  "Origen",
] as const;

/** Map an exported book field to an Excel column value. */
function mapBookValue(book: ExportedBook, column: (typeof EXPORT_COLUMNS)[number]): string | number | null {
  switch (column) {
    case "Titulo":
      return book.title;
    case "Autor":
      return book.authorName ?? "";
    case "Paginas":
      return book.totalPages ?? "";
    case "Fecha Inicio":
      return book.startDate?.toISOString().slice(0, 10) ?? "";
    case "Fecha Fin":
      return book.finishDate?.toISOString().slice(0, 10) ?? "";
    case "Tipo":
      return book.genreName ?? "";
    case "Puntuación":
      return book.rating ?? "";
    case "Num leídos":
      // This data isn't fully tracked in the relational model; leave empty
      return "";
    case "Año":
      return book.publicationYear ?? "";
    case "Origen":
      return book.origin ?? "";
    default:
      return "";
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch books organized by reading year using domain service
  const { booksByYear } = await getBooksForExport(year);

  // Create Excel workbook using ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Books App";
  workbook.lastModifiedBy = "Books App";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Add one sheet per reading year
  for (const [readingYear, yearBooks] of booksByYear.entries()) {
    // Use simplified worksheet name without slash to avoid Excel restrictions
    const worksheet = workbook.addWorksheet(`Leídos ${readingYear}`);

    // Add header row with enhanced style
    const headerRow = worksheet.addRow([...EXPORT_COLUMNS]);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    // Sort books by finishDate ascending (nulls last)
    const sortedBooks = [...yearBooks].sort((a, b) => {
      const aFinish = a.finishDate?.getTime() ?? Infinity;
      const bFinish = b.finishDate?.getTime() ?? Infinity;
      return aFinish - bFinish;
    });

    // Add data rows
    for (const book of sortedBooks) {
      const rowValues = EXPORT_COLUMNS.map((col) => mapBookValue(book, col));
      worksheet.addRow(rowValues);
    }

    // Set column widths for readability
    worksheet.getColumn(1).width = 30; // Titulo
    worksheet.getColumn(2).width = 20; // Autor
    worksheet.getColumn(3).width = 10; // Paginas
    worksheet.getColumn(4).width = 14; // Fecha Inicio
    worksheet.getColumn(5).width = 14; // Fecha Fin
    worksheet.getColumn(6).width = 18; // Tipo
    worksheet.getColumn(7).width = 14; // Puntuación
    worksheet.getColumn(8).width = 12; // Num leídos
    worksheet.getColumn(9).width = 10; // Año
    worksheet.getColumn(10).width = 20; // Origen
  }

  // Generate the buffer and set headers for download
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = year
    ? `books-export-${year}.xlsx`
    : "books-export-all.xlsx";

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}