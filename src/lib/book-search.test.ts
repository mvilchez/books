import assert from "node:assert/strict";
import test from "node:test";
import {
  BOOK_SEARCH_MAX_LENGTH,
  escapeBookSearchWildcards,
  isBookSearchResults,
  parseBookSearchQuery,
} from "./book-search";

test("book search query validation trims and bounds input", () => {
  assert.deepEqual(parseBookSearchQuery([]), {
    valid: false,
    reason: "missing",
  });
  assert.deepEqual(parseBookSearchQuery([" A "]), {
    valid: false,
    reason: "too_short",
  });
  assert.deepEqual(parseBookSearchQuery(["  Dune  "]), {
    valid: true,
    query: "Dune",
  });
  assert.deepEqual(parseBookSearchQuery(["first", "second"]), {
    valid: false,
    reason: "repeated",
  });
  assert.deepEqual(parseBookSearchQuery(["x".repeat(BOOK_SEARCH_MAX_LENGTH + 1)]), {
    valid: false,
    reason: "too_long",
  });
  assert.deepEqual(parseBookSearchQuery(["C++ & Dune"]), {
    valid: true,
    query: "C++ & Dune",
  });
  assert.equal(escapeBookSearchWildcards("50%_off\\"), "50\\%\\_off\\\\");
});

test("book search response validator rejects malformed result data", () => {
  assert.equal(
    isBookSearchResults([
      {
        id: "1",
        title: "Dune",
        author: {
          name: "Frank Herbert",
          portraitUrl: null,
          portraitSourceUrl: null,
          portraitArtist: null,
          portraitLicense: null,
          portraitLicenseUrl: null,
        },
        readingYear: 2024,
      },
    ]),
    true,
  );
  assert.equal(isBookSearchResults([{ id: "1", title: "Dune" }]), false);
  assert.equal(isBookSearchResults(null), false);
});
