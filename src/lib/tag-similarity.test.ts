import assert from "node:assert/strict";
import test from "node:test";
import {
  findSimilarTagPairs,
  findSimilarTags,
  normalizeTagName,
  tagSimilarity,
} from "./tag-similarity";

test("normalizes accents, case, and punctuation for duplicate prevention", () => {
  assert.equal(normalizeTagName("  Ciencia-Ficción "), "ciencia ficcion");
  assert.equal(
    normalizeTagName("Ciencia ficción"),
    normalizeTagName("CIENCIA FICCION"),
  );
});

test("suggests close spelling and word-order variants but not unrelated tags", () => {
  const existing = [
    { id: "1", name: "Ciencia ficción" },
    { id: "2", name: "Novela histórica" },
    { id: "3", name: "Poesía" },
  ];
  const suggestions = findSimilarTags("Ciencia ficcion", existing);
  assert.deepEqual(suggestions.map(({ tag }) => tag.id), ["1"]);
  assert.equal(
    findSimilarTags("Ciencia fic", existing)[0]?.tag.id,
    "1",
  );
  assert.ok(tagSimilarity("Novela histórica", "Histórica novela") >= 0.98);
  assert.ok(tagSimilarity("Poesía", "Historia") < 0.78);
  assert.ok(tagSimilarity("Ciencia ficción", "Siencia ficción") >= 0.82);
});

test("finds each likely duplicate pair once", () => {
  const pairs = findSimilarTagPairs([
    { id: "1", name: "Ciencia ficción" },
    { id: "2", name: "Ciencia ficcionn" },
    { id: "3", name: "Historia" },
  ]);
  assert.equal(pairs.length, 1);
  assert.deepEqual(
    [pairs[0]?.first.id, pairs[0]?.second.id].sort(),
    ["1", "2"],
  );
});
