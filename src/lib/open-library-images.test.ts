import assert from "node:assert/strict";
import test from "node:test";
import { getBookCoverUrl } from "./book-cover";
import {
  getOpenLibraryAuthorPhotoUrl,
  getOpenLibraryAuthorUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryWorkUrl,
  normalizeOpenLibraryName,
  openLibraryAuthorMatches,
  openLibraryTitleMatches,
  parseOpenLibraryAuthorCandidates,
  parseOpenLibraryAuthorProfile,
  parseOpenLibraryBookCandidates,
  parseOpenLibraryBookMetadata,
  parseOpenLibraryRecommendationCandidates,
  prioritizeOpenLibraryAuthorCandidates,
  searchOpenLibraryRecommendations,
  searchOpenLibraryAuthorPhotos,
  searchOpenLibraryMetadata,
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

test("metadata parser requires an exact normalized title and author", () => {
  const response = {
    docs: [
      {
        key: "/works/OL1W",
        title: "Cien años de soledad",
        author_name: ["Gabriel García Márquez"],
        cover_i: 123,
        first_publish_year: 1967,
        subject: ["Magic realism", "Colombian literature"],
        language: ["spa", "eng"],
        editions: {
          docs: [
            {
              number_of_pages: 500,
              physical_format: "Hardcover",
              publish_date: "2007",
              isbn_13: ["9780000000001"],
            },
            {
              number_of_pages: 471,
              physical_format: "Paperback",
              publish_date: ["1967"],
              isbn_13: ["9780000000002"],
            },
          ],
        },
      },
    ],
  };
  assert.deepEqual(
    parseOpenLibraryBookMetadata(
      response,
      "Cien años de soledad",
      "Gabriel Garcia Marquez",
      471,
      1967,
    ),
    {
      workId: "OL1W",
      title: "Cien años de soledad",
      coverId: 123,
      firstPublishYear: 1967,
      pageCount: 471,
      format: "Paperback",
      isbn13: "9780000000002",
      subjects: ["Magic realism", "Colombian literature"],
      languages: ["Spanish", "English"],
      seriesName: null,
      seriesPosition: null,
    },
  );
  assert.equal(
    parseOpenLibraryBookMetadata(
      response,
      "Cien años de soledad",
      "A different author",
    ),
    null,
  );
  assert.equal(
    parseOpenLibraryBookMetadata(
      {
        docs: [
          {
            ...response.docs[0],
            title: "El amor en los tiempos del cólera",
          },
        ],
      },
      "Cien años de soledad",
      "Gabriel García Márquez",
    ),
    null,
  );
  assert.throws(
    () => parseOpenLibraryBookMetadata({ docs: null }, "Title", "Author"),
    /malformed metadata search/,
  );
});

test("metadata author matching accepts a near match from a multiple-author record", () => {
  assert.equal(
    openLibraryAuthorMatches("Ana María Matute", [
      "A Different Author",
      "Ana Maria Matute",
    ]),
    true,
  );
  assert.equal(
    openLibraryAuthorMatches("Gabriel Garcia Marquez; Isabel Allende", [
      "Gabriel García Márquez",
      "Another Author",
    ]),
    true,
  );
  assert.equal(
    openLibraryAuthorMatches("J. K. Rowling", ["Joanne K Rowling"]),
    true,
  );
  assert.equal(
    openLibraryAuthorMatches("Gabriel Garcia Marquez", [
      "Gabriel Garcia Marques",
    ]),
    true,
  );
  assert.equal(
    openLibraryAuthorMatches("Gabriel Garcia Marquez", [
      "Gabriel García Moreno",
    ]),
    false,
  );
});

test("metadata title matching accepts close variants and rejects unrelated titles", () => {
  assert.equal(openLibraryTitleMatches("The Hobbit", "Hobbit"), true);
  assert.equal(
    openLibraryTitleMatches("Cien años de soledad", "Cien anos de soleded"),
    true,
  );
  assert.equal(
    openLibraryTitleMatches("The Lord of the Rings", "Lord of the Rings"),
    true,
  );
  assert.equal(openLibraryTitleMatches("Dune", "June"), false);
  assert.equal(
    openLibraryTitleMatches("Cien años de soledad", "El amor en los tiempos del cólera"),
    false,
  );
});

test("metadata parser accepts a close title variant only with a matching author", () => {
  const response = {
    docs: [
      {
        key: "/works/OL1W",
        title: "Cien anos de soleded",
        author_name: ["Gabriel García Márquez"],
        subject: ["Novel"],
      },
    ],
  };
  assert.equal(
    parseOpenLibraryBookMetadata(
      response,
      "Cien años de soledad",
      "Gabriel Garcia Marquez",
    )?.workId,
    "OL1W",
  );
  assert.equal(
    parseOpenLibraryBookMetadata(
      response,
      "Cien años de soledad",
      "A different author",
    ),
    null,
  );
});

test("metadata search requests fields once and returns the exact match", async () => {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    return Response.json({
      docs: [
        {
          key: "/works/OL123W",
          title: "The book",
          author_name: ["An Author"],
          first_publish_year: 1980,
          subject: ["Fiction"],
          language: ["eng"],
        },
      ],
    });
  }) as typeof fetch;
  try {
    const metadata = await searchOpenLibraryMetadata("The book", "An Author", null, null);
    assert.equal(metadata?.workId, "OL123W");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get("title"), "The book");
    assert.equal(requests[0].searchParams.get("author"), "An Author");
    assert.match(requests[0].searchParams.get("fields") ?? "", /subject/);
    assert.match(requests[0].searchParams.get("fields") ?? "", /editions/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recommendation search prefers Spanish and falls back to English only when needed", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.searchParams.get("language") ?? "");
    return Response.json({
      docs:
        url.searchParams.get("language") === "spa"
          ? [
              {
                key: "/works/OL1W",
                title: "Libro leído",
                author_name: ["Ada Author"],
              },
            ]
          : [
              {
                key: "/works/OL2W",
                title: "Unread English book",
                author_name: ["Ada Author"],
                first_publish_year: 1950,
              },
            ],
    });
  }) as typeof fetch;

  try {
    const spanish = await searchOpenLibraryRecommendations(
      "Ada Author",
      [],
      { title: "Source", workId: null },
    );
    assert.equal(spanish.language, "spa");
    assert.equal(spanish.books[0]?.title, "Libro leído");
    assert.deepEqual(requests, ["spa"]);

    requests.length = 0;
    const fallback = await searchOpenLibraryRecommendations(
      "Ada Author",
      [{ title: "Libro leído", workId: null }],
      { title: "Source", workId: null },
    );
    assert.equal(fallback.language, "eng");
    assert.equal(fallback.books[0]?.title, "Unread English book");
    assert.deepEqual(requests, ["spa", "eng"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recommendation parser accepts works without covers and validates work ids", () => {
  assert.deepEqual(
    parseOpenLibraryRecommendationCandidates({
      docs: [
        {
          key: "/works/OL123W",
          title: "A book without a cover",
          author_name: ["Ada"],
          first_publish_year: 1815,
        },
        { key: "/works/not-a-work", title: "Invalid" },
        { key: "/works/OL124W", title: " " },
      ],
    }),
    [
      {
        workId: "OL123W",
        title: "A book without a cover",
        authors: ["Ada"],
        firstPublishYear: 1815,
      },
    ],
  );
  assert.throws(
    () => parseOpenLibraryRecommendationCandidates({ docs: null }),
    /malformed recommendation/,
  );
});

test("author lookup validates ids and image URLs before using them", () => {
  assert.deepEqual(
    parseOpenLibraryAuthorCandidates({
      docs: [
        { key: "OL23919A", name: "J. K. Rowling" },
        { key: "/authors/not-an-id", name: "Bad result" },
        { key: "/authors/OL123A", name: "Alternative documented path" },
      ],
    }),
    [
      { authorId: "OL23919A", name: "J. K. Rowling" },
      { authorId: "OL123A", name: "Alternative documented path" },
    ],
  );
  assert.equal(normalizeOpenLibraryName("  J.  K. Rowling "), "j k rowling");
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

test("author search prioritizes exact names before duplicate or fuzzy matches", () => {
  const candidates = [
    { authorId: "OL1A", name: "J.k. Rowling" },
    { authorId: "OL2A", name: "J. K. Rowling" },
    { authorId: "OL3A", name: "K. J. Rowling" },
  ];
  assert.deepEqual(
    prioritizeOpenLibraryAuthorCandidates(candidates, "J. K. Rowling"),
    [candidates[0], candidates[1], candidates[2]],
  );

  const reordered = prioritizeOpenLibraryAuthorCandidates(
    [
      { authorId: "OL4A", name: "J. K. Rowling related record" },
      candidates[2],
      candidates[1],
    ],
    "J. K. Rowling",
  );
  assert.equal(reordered[0].authorId, "OL2A");
});

test("author photo search skips duplicate records without photos", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.pathname);
    if (url.pathname === "/search/authors.json") {
      return Response.json({
        docs: [
          { key: "OL1A", name: "Ada Lovelace" },
          { key: "OL2A", name: "Ada Lovelace" },
          { key: "OL3A", name: "Ada Lovelace" },
        ],
      });
    }
    if (url.pathname === "/authors/OL1A.json" || url.pathname === "/authors/OL2A.json") {
      return Response.json({ name: "Ada Lovelace", photos: [-1] });
    }
    if (url.pathname === "/authors/OL3A.json") {
      return Response.json({ name: "Ada Lovelace", photos: [4321] });
    }
    return new Response("Not found", { status: 404 });
  };

  globalThis.fetch = mockFetch;
  try {
    assert.deepEqual(await searchOpenLibraryAuthorPhotos("Ada Lovelace"), [
      {
        authorId: "OL3A",
        name: "Ada Lovelace",
        photoId: 4321,
        photoUrl: "https://covers.openlibrary.org/a/id/4321-M.jpg?default=false",
      },
    ]);
    assert.deepEqual(requests, [
      "/search/authors.json",
      "/authors/OL1A.json",
      "/authors/OL2A.json",
      "/authors/OL3A.json",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
