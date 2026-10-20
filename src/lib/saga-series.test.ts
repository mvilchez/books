import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSagaSeriesView,
  matchSagaLibraryBook,
} from "./saga-series";

test("saga series view matches translated titles by position", () => {
  const view = buildSagaSeriesView(
    [
      {
        workId: "OL1W",
        title: "A Game of Thrones",
        authors: ["George R. R. Martin"],
        coverId: 9269962,
        seriesPosition: 1,
        firstPublishYear: 1996,
      },
      {
        workId: "OL2W",
        title: "A Clash of Kings",
        authors: ["George R. R. Martin"],
        coverId: 8231751,
        seriesPosition: 2,
        firstPublishYear: 1998,
      },
      {
        workId: "OL3W",
        title: "A Storm of Swords",
        authors: ["George R. R. Martin"],
        coverId: null,
        seriesPosition: 3,
        firstPublishYear: 2000,
      },
    ],
    [
      {
        id: "book-1",
        title: "Juego de tronos",
        authorName: "George R. R. Martin",
        seriesPosition: 1,
        status: "COMPLETED",
        openLibraryCoverId: 12324415,
      },
      {
        id: "book-2",
        title: "Choque de reyes",
        authorName: "George R. R. Martin",
        seriesPosition: 2,
        status: "WISH_LIST",
        openLibraryCoverId: null,
      },
    ],
  );
  assert.equal(view.entries.length, 3);
  assert.equal(view.entries[0]?.libraryBookId, "book-1");
  assert.equal(view.entries[0]?.isRead, true);
  assert.equal(view.entries[1]?.libraryBookId, "book-2");
  assert.equal(view.entries[1]?.isRead, false);
  assert.equal(view.entries[1]?.inLibrary, true);
  // Missing installment borrows no library cover and links out.
  assert.equal(view.entries[2]?.inLibrary, false);
  assert.equal(view.entries[2]?.coverId, null);
  assert.equal(view.entries[2]?.workUrl, "https://openlibrary.org/works/OL3W");
  assert.equal(view.representativeCoverId, 9269962);
  assert.equal(view.readCount, 1);
  assert.equal(view.libraryCount, 2);
});

test("saga matcher prefers position, then title, and rejects strangers", () => {
  const library = [
    {
      id: "book-1",
      title: "Juego de tronos",
      authorName: "George R. R. Martin",
      seriesPosition: 1,
      status: "COMPLETED",
      openLibraryCoverId: 12324415,
    },
    {
      id: "book-2",
      title: "A Clash of Kings",
      authorName: "George R. R. Martin",
      seriesPosition: null,
      status: "COMPLETED",
      openLibraryCoverId: null,
    },
  ];
  // Position wins even when the title is translated.
  assert.equal(
    matchSagaLibraryBook(
      {
        title: "A Game of Thrones",
        authors: ["George R. R. Martin"],
        seriesPosition: 1,
      },
      library,
    )?.id,
    "book-1",
  );
  // Title fallback for books without a saved position.
  assert.equal(
    matchSagaLibraryBook(
      {
        title: "A Clash of Kings",
        authors: ["George R. R. Martin"],
        seriesPosition: 9,
      },
      library,
    )?.id,
    "book-2",
  );
  // Unknown title and position match nothing.
  assert.equal(
    matchSagaLibraryBook(
      {
        title: "A Feast for Crows",
        authors: ["George R. R. Martin"],
        seriesPosition: 4,
      },
      library,
    ),
    null,
  );
});
