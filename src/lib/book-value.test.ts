import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeValueScore, compareByMode } from "./book-value";

describe("book-value", () => {
  it("scores higher for better rating", () => {
    const a = computeValueScore({ rating: 9, pages: 300, rereadCount: 1 });
    const b = computeValueScore({ rating: 6, pages: 300, rereadCount: 1 });
    assert.ok(a > b);
  });
  it("rewards rereads", () => {
    const a = computeValueScore({ rating: 8, pages: 300, rereadCount: 3 });
    const b = computeValueScore({ rating: 8, pages: 300, rereadCount: 1 });
    assert.ok(a > b);
  });
  it("sorts by value desc", () => {
    const books = [
      { title: "a", rating: 9, pages: 100, rereadCount: 1 },
      { title: "b", rating: 7, pages: 1000, rereadCount: 1 },
    ];
    const sorted = [...books].sort((x, y) => compareByMode(x, y, "value"));
    assert.equal(sorted[0].title, "b");
  });
});