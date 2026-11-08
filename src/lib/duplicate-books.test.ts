import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDuplicateGroups,
  normalizeAuthor,
  normalizeTitle,
} from "./duplicate-books";

function book(overrides: Partial<{ id: string; title: string; authorName: string; readingYear: number; totalPages: number | null; status: string }> = {}): { id: string; title: string; authorName: string; readingYear: number; totalPages: number | null; status: string } {
  return {
    id: overrides.id ?? "id-1",
    title: overrides.title ?? "Title",
    authorName: overrides.authorName ?? "Author",
    readingYear: overrides.readingYear ?? 2020,
    totalPages: overrides.totalPages ?? null,
    status: overrides.status ?? "COMPLETED",
  };
}

test("normalizeTitle folds case, whitespace, and accents", () => {
  assert.equal(normalizeTitle("  El   Ingenioso Hidalgo  "), "el ingenioso hidalgo");
  assert.equal(normalizeTitle("Ciencia-Ficción"), "ciencia ficcion");
});

test("normalizeAuthor folds case, whitespace, and accents", () => {
  assert.equal(normalizeAuthor("  García Márquez  "), "garcia marquez");
});

test("buildDuplicateGroups drops singletons", () => {
  const groups = buildDuplicateGroups([book({ id: "1", title: "Solo", authorName: "Solo Author" })]);
  assert.deepEqual(groups, []);
});

test("buildDuplicateGroups groups same title and author across years", () => {
  const groups = buildDuplicateGroups([
    book({ id: "1", title: "Moby Dick", authorName: "Herman Melville", readingYear: 2010 }),
    book({ id: "2", title: "Moby Dick", authorName: "Herman Melville", readingYear: 2015 }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.bookCount, 2);
  assert.deepEqual(groups[0]!.years, [2015, 2010]);
});

test("buildDuplicateGroups keeps different authors separate", () => {
  const groups = buildDuplicateGroups([
    book({ id: "1", title: "Moby Dick", authorName: "Herman Melville" }),
    book({ id: "2", title: "Moby Dick", authorName: "Someone Else" }),
  ]);
  assert.deepEqual(groups, []);
});

test("buildDuplicateGroups keeps different titles separate", () => {
  const groups = buildDuplicateGroups([
    book({ id: "1", title: "Moby Dick", authorName: "Herman Melville" }),
    book({ id: "2", title: "Moby-Dick!", authorName: "Herman Melville" }),
  ]);
  // Punctuation is folded, so these still match.
  assert.equal(groups.length, 1);
});

test("buildDuplicateGroups orders groups by author then title", () => {
  const groups = buildDuplicateGroups([
    book({ id: "1", title: "Zed", authorName: "Bob Author" }),
    book({ id: "2", title: "Zed", authorName: "Bob Author", readingYear: 2019 }),
    book({ id: "3", title: "Alpha", authorName: "Alice Author" }),
    book({ id: "4", title: "Alpha", authorName: "Alice Author", readingYear: 2018 }),
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.authorName, "Alice Author");
  assert.equal(groups[1]!.authorName, "Bob Author");
});

test("buildDuplicateGroups orders books within a group by year descending", () => {
  const groups = buildDuplicateGroups([
    book({ id: "1", title: "Moby Dick", authorName: "Herman Melville", readingYear: 2010 }),
    book({ id: "2", title: "Moby Dick", authorName: "Herman Melville", readingYear: 2015 }),
    book({ id: "3", title: "Moby Dick", authorName: "Herman Melville", readingYear: 2012 }),
  ]);
  assert.deepEqual(groups[0]!.books.map((b) => b.readingYear), [2015, 2012, 2010]);
});
