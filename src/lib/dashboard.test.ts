import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDashboardSort,
  parseSortDirection,
  sortDashboardBooks,
  type DashboardSortableBook,
} from "./dashboard";

const books: DashboardSortableBook[] = [
  {
    id: "3",
    title: "The Long Way",
    startDate: new Date("2024-03-01T00:00:00Z"),
    author: { name: "Becky Chambers" },
  },
  {
    id: "2",
    title: "A Memory Called Empire",
    startDate: null,
    author: { name: "Arkady Martine" },
  },
  {
    id: "1",
    title: "Ancillary Justice",
    startDate: new Date("2024-01-01T00:00:00Z"),
    author: { name: "Ann Leckie" },
  },
];

test("sort query values reject unsupported and repeated values", () => {
  assert.equal(parseDashboardSort("author"), "author");
  assert.equal(parseDashboardSort("invalid"), "startDate");
  assert.equal(parseDashboardSort(["title", "author"]), "startDate");
  assert.equal(parseSortDirection("desc"), "desc");
  assert.equal(parseSortDirection("sideways"), "asc");
  assert.equal(parseSortDirection(undefined, "desc"), "desc");
  assert.equal(parseSortDirection(["desc"]), "asc");
});

test("date sorting defaults ascending and keeps missing dates last in either direction", () => {
  assert.deepEqual(
    sortDashboardBooks(books, "startDate", "asc").map(({ id }) => id),
    ["1", "3", "2"],
  );
  assert.deepEqual(
    sortDashboardBooks(books, "startDate", "desc").map(({ id }) => id),
    ["3", "1", "2"],
  );
});

test("author and title sorts use stable tie breakers without mutating input", () => {
  const originalIds = books.map(({ id }) => id);
  assert.deepEqual(
    sortDashboardBooks(books, "author", "asc").map(({ id }) => id),
    ["1", "2", "3"],
  );
  assert.deepEqual(
    sortDashboardBooks(books, "title", "desc").map(({ id }) => id),
    ["3", "1", "2"],
  );
  assert.deepEqual(books.map(({ id }) => id), originalIds);

  const tiedBooks = ["z", "a", "b"].map((id) => ({
    id,
    title: "Same title",
    startDate: new Date("2024-01-01T00:00:00Z"),
    author: { name: "Same author" },
  }));
  assert.deepEqual(
    sortDashboardBooks(tiedBooks, "author", "desc").map(({ id }) => id),
    ["a", "b", "z"],
  );
});
