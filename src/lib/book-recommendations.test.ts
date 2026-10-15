import assert from "node:assert/strict";
import test from "node:test";
import {
  filterUnreadOpenLibraryBooks,
  type OpenLibraryRecommendation,
} from "./book-recommendations";

const candidates: OpenLibraryRecommendation[] = [
  { workId: "OL1W", title: "Cien años de soledad", authors: ["Autor"], firstPublishYear: 1967 },
  { workId: "OL2W", title: "El amor en los tiempos del cólera", authors: ["Autor"], firstPublishYear: 1985 },
  { workId: "OL3W", title: "Crónica de una muerte anunciada", authors: ["Autor"], firstPublishYear: 1981 },
];

test("excludes completed and source titles, case-insensitively", () => {
  assert.deepEqual(
    filterUnreadOpenLibraryBooks(
      candidates,
      [{ title: " cien años de SOLEDAD ", workId: null }],
      { title: "El amor en los tiempos del cólera", workId: null },
    ).map(({ workId }) => workId),
    ["OL3W"],
  );
});

test("deduplicates normalized titles and caps results at five", () => {
  const duplicates = Array.from({ length: 8 }, (_, index) => ({
    workId: `OL${index + 1}W`,
    title: index < 2 ? "Café, Libro" : `Book ${index}`,
    authors: [],
    firstPublishYear: null,
  }));
  duplicates[1].title = "CAFÉ LIBRO";

  const result = filterUnreadOpenLibraryBooks(
    duplicates,
    [],
    { title: "Source", workId: null },
  );
  assert.equal(result.length, 5);
  assert.deepEqual(result.slice(0, 2).map(({ workId }) => workId), ["OL1W", "OL3W"]);
});

test("excludes a matching Open Library work even if its title differs", () => {
  assert.deepEqual(
    filterUnreadOpenLibraryBooks(
      candidates,
      [{ title: "Translated title", workId: "OL1W" }],
      { title: "Source", workId: null },
    ).map(({ workId }) => workId),
    ["OL2W", "OL3W"],
  );
});
