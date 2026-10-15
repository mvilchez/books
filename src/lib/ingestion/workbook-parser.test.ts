import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { parseWorkbook } from "./workbook-parser";

function workbookWithAuthor(author: string | number): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leidos 2024");
  sheet.addRow(["Titulo", "Autor", "Paginas"]);
  sheet.addRow(["A book", author, 200]);
  return workbook;
}

test("numeric author cells are rejected instead of imported as author names", () => {
  const parsed = parseWorkbook(workbookWithAuthor(330));

  assert.equal(parsed.books.length, 0);
  assert.deepEqual(parsed.errors, [
    'Leidos 2024 — Row 2: \'autor\' must be a name, not a number (got "330")',
  ]);
});

test("text author names continue to be imported", () => {
  const parsed = parseWorkbook(workbookWithAuthor("Ursula K. Le Guin"));

  assert.equal(parsed.books.length, 1);
  assert.equal(parsed.books[0].authorName, "Ursula K. Le Guin");
  assert.deepEqual(parsed.errors, []);
});
