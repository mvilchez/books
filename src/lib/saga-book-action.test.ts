import assert from "node:assert/strict";
import test from "node:test";
import { getSagaBookAction } from "./saga-book-action";

test("offers 'start' for wishlist and not-started books", () => {
  assert.equal(getSagaBookAction("PENDING"), "start");
  assert.equal(getSagaBookAction("WISH_LIST"), "start");
});

test("offers 'unread' for started and finished books", () => {
  assert.equal(getSagaBookAction("READING"), "unread");
  assert.equal(getSagaBookAction("COMPLETED"), "unread");
});

test("offers no action for books that are not in the library", () => {
  assert.equal(getSagaBookAction(null), null);
  assert.equal(getSagaBookAction(undefined), null);
  assert.equal(getSagaBookAction(""), null);
  assert.equal(getSagaBookAction("UNKNOWN"), null);
});
