import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreSimilarity, rankSimilar } from "./similar-books";

describe("similar-books", () => {
  const seed = { id: "1", title: "Seed", author: "Author A", genre: "Novela", rating: 8, pages: 300, publicationYear: 2020, subjects: ["sci-fi", "space"] };
  const cand = { id: "2", title: "Cand", author: "Author B", genre: "Novela", rating: 7.5, pages: 320, publicationYear: 2018, subjects: ["space"] };

  it("scores positive for shared genre/subject", () => {
    const r = scoreSimilarity(seed, cand);
    assert.ok(r.score > 0);
    assert.ok(r.reasons.includes("same genre"));
  });
  it("excludes self", () => {
    const r = scoreSimilarity(seed, { ...seed });
    assert.equal(r.score, 0);
  });
  it("ranks and limits", () => {
    const res = rankSimilar(seed, [cand, { ...cand, id: "3", title: "C2", subjects: [] }], 1);
    assert.equal(res.length, 1);
  });
});