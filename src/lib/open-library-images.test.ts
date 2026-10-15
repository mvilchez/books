import assert from "node:assert/strict";
import test from "node:test";
import { getBookCoverUrl } from "./book-cover";
import {
  getOpenLibraryAuthorPhotoUrl,
  getOpenLibraryAuthorUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryWorkUrl,
  normalizeOpenLibraryName,
  parseOpenLibraryAuthorCandidates,
  parseOpenLibraryAuthorProfile,
  parseOpenLibraryBookCandidates,
} from "./open-library-images";

test("book search only returns usable Open Library works with covers", () => {
  assert.deepEqual(
    parseOpenLibraryBookCandidates({
      docs: [
        {
          key: "/works/OL16806416W",
          title: "The Cuckoo's Calling",
          author_name: ["J. K. Rowling"],
          cover_i: 7261207,
          isbn: ["9780316206853"],
        },
        {
          key: "/works/OL100W",
          title: "No cover",
          author_name: ["Someone"],
          isbn: ["9780000000000"],
        },
        {
          key: "/books/OL123M",
          title: "Wrong result type",
          cover_i: 44,
        },
      ],
    }),
    [
      {
        workId: "OL16806416W",
        title: "The Cuckoo's Calling",
        authors: ["J. K. Rowling"],
        coverId: 7261207,
        isbn: ["9780316206853"],
      },
    ],
  );
  assert.throws(
    () => parseOpenLibraryBookCandidates({ docs: {} }),
    /malformed book search/,
  );
});

test("author lookup validates ids and image URLs before using them", () => {
  assert.deepEqual(
    parseOpenLibraryAuthorCandidates({
      docs: [
        { key: "/authors/OL23919A", name: "J. K. Rowling" },
        { key: "/authors/not-an-id", name: "Bad result" },
      ],
    }),
    [{ authorId: "OL23919A", name: "J. K. Rowling" }],
  );
  assert.equal(normalizeOpenLibraryName("  J.  K. Rowling "), "j. k. rowling");
  assert.equal(getOpenLibraryCoverUrl(7261207, "M"),
    "https://covers.openlibrary.org/b/id/7261207-M.jpg?default=false");
  assert.equal(getOpenLibraryAuthorPhotoUrl(5543033, "M"),
    "https://covers.openlibrary.org/a/id/5543033-M.jpg?default=false");
  assert.equal(getOpenLibraryWorkUrl("OL16806416W"),
    "https://openlibrary.org/works/OL16806416W");
  assert.equal(getOpenLibraryAuthorUrl("OL23919A"),
    "https://openlibrary.org/authors/OL23919A");
  assert.equal(getOpenLibraryCoverUrl(-1, "M"), null);
  assert.equal(getOpenLibraryWorkUrl("https://evil.example"), null);
  assert.deepEqual(
    parseOpenLibraryAuthorProfile({
      name: "J. K. Rowling",
      photos: [-1, 5543033],
    }),
    { name: "J. K. Rowling", photoId: 5543033 },
  );
  assert.deepEqual(
    parseOpenLibraryAuthorProfile({ name: "No photo", photos: [-1] }),
    { name: "No photo", photoId: null },
  );
  assert.equal(
    getBookCoverUrl("isbn:9780316206853", 7261207),
    "https://covers.openlibrary.org/b/id/7261207-M.jpg?default=false",
  );
  assert.equal(
    getBookCoverUrl("isbn:9780316206853"),
    "https://covers.openlibrary.org/b/isbn/9780316206853-M.jpg?default=false",
  );
  assert.equal(getBookCoverUrl("no-isbn"), null);
});
