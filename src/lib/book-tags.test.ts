import assert from "node:assert/strict";
import test from "node:test";
import { BookTagCategory } from "@prisma/client";
import { buildLibraryBookTags, normalizeTag } from "./book-tags";

test("library tags use known genre and ebook origins without guessing physical format", () => {
  assert.deepEqual(buildLibraryBookTags("  Novela  ", "eBook"), [
    { category: BookTagCategory.GENRE, name: "Novela" },
    { category: BookTagCategory.FORMAT, name: "E-book" },
  ]);
  assert.deepEqual(buildLibraryBookTags("Ensayo", "Propio"), [
    { category: BookTagCategory.GENRE, name: "Ensayo" },
  ]);
  assert.deepEqual(buildLibraryBookTags(null, "A-123"), []);
});

test("tag normalization folds accents and whitespace", () => {
  assert.equal(normalizeTag("  Ciencia   Ficción "), "ciencia ficcion");
});
