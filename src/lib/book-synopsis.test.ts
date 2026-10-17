import assert from "node:assert/strict";
import test from "node:test";
import { searchBookSynopsis } from "./book-synopsis";

test("uses an Open Library work description before searching elsewhere", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url.toString());
    return Response.json({
      description: { value: "  A <b>short</b> synopsis.  " },
    });
  }) as typeof fetch;

  try {
    assert.deepEqual(
      await searchBookSynopsis("Book", "Author", "OL123W", 0),
      {
        text: "A short synopsis.",
        language: "unknown",
        sourceUrl: "https://openlibrary.org/works/OL123W",
      },
    );
    assert.deepEqual(requests, ["https://openlibrary.org/works/OL123W.json"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to Google Books in Spanish before English", async () => {
  const originalFetch = globalThis.fetch;
  const requestedLanguages: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requestedLanguages.push(url.searchParams.get("langRestrict") ?? "");
    return Response.json(
      url.searchParams.get("langRestrict") === "es"
        ? { items: [] }
        : {
            items: [
              {
                id: "volume id",
                volumeInfo: {
                  title: "The Hobbit",
                  authors: ["J. R. R. Tolkien"],
                  description: "An &amp; adventurous story.",
                },
              },
            ],
          },
    );
  }) as typeof fetch;

  try {
    assert.deepEqual(
      await searchBookSynopsis("The Hobbit", "J. R. R. Tolkien", null, 0),
      {
        text: "An & adventurous story.",
        language: "en",
        sourceUrl: "https://books.google.com/books?id=volume%20id",
      },
    );
    assert.deepEqual(requestedLanguages, ["es", "en"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects unrelated Google Books results and keeps a Spanish synopsis", async () => {
  const originalFetch = globalThis.fetch;
  const requestedLanguages: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const language = url.searchParams.get("langRestrict") ?? "";
    requestedLanguages.push(language);
    return Response.json({
      items: [
        {
          id: "unrelated",
          volumeInfo: {
            title: language === "es" ? "A different book" : "El Hobbit",
            authors: ["Someone Else"],
            description: "Should not be used.",
          },
        },
        ...(language === "es"
          ? [
              {
                id: "spanish",
                volumeInfo: {
                  title: "El Hobbit",
                  authors: ["J. R. R. Tolkien"],
                  description: "<p>Una aventura.</p>",
                },
              },
            ]
          : []),
      ],
    });
  }) as typeof fetch;

  try {
    const synopsis = await searchBookSynopsis(
      "The Hobbit",
      "J. R. R. Tolkien",
      null,
      0,
    );
    assert.equal(synopsis?.text, "Una aventura.");
    assert.equal(synopsis?.language, "es");
    assert.deepEqual(requestedLanguages, ["es"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to a matching Spanish Wikipedia synopsis when Google Books fails", async () => {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push(url);
    if (url.hostname === "www.googleapis.com") {
      throw new Error("Google Books unavailable");
    }
    if (url.hostname === "es.wikipedia.org") {
      return Response.json({
        query: {
          pages: [
            {
              title: "The Hobbit",
              extract:
                "The Hobbit is a novel by J. R. R. Tolkien. Una aventura inesperada.",
            },
          ],
        },
      });
    }
    return new Response(
      `<div class="result">
        <a class="result__a" href="https://example.org/hobbit">The Hobbit</a>
        <a class="result__snippet">Un hobbit emprende un viaje inesperado con un grupo de enanos.</a>
      </div>`,
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    assert.deepEqual(
      await searchBookSynopsis("The Hobbit", "J. R. R. Tolkien", null, 0),
      {
        text: "The Hobbit is a novel by J. R. R. Tolkien. Una aventura inesperada.",
        language: "es",
        sourceUrl: "https://es.wikipedia.org/wiki/The_Hobbit",
      },
    );
    assert.deepEqual(
      requests.map((url) => url.hostname),
      [
        "www.googleapis.com",
        "www.googleapis.com",
        "es.wikipedia.org",
      ],
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses a web-search snippet when catalog and Wikipedia fallbacks have no synopsis", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === "www.googleapis.com") return Response.json({ items: [] });
    if (url.hostname.endsWith("wikipedia.org")) {
      return Response.json({ query: { pages: [] } });
    }
    return new Response(
      `<div class="result">
        <a class="result__a" href="https://example.org/hobbit">The Hobbit</a>
        <a class="result__snippet">Un hobbit emprende un viaje inesperado.</a>
      </div>`,
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    assert.deepEqual(
      await searchBookSynopsis("The Hobbit", "J. R. R. Tolkien", null, 0),
      {
        text: "Un hobbit emprende un viaje inesperado.",
        language: "es",
        sourceUrl: "https://example.org/hobbit",
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports failure only after all synopsis providers fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("provider unavailable");
  }) as typeof fetch;

  try {
    await assert.rejects(
      searchBookSynopsis("Book", "Author", null, 0),
      (error: unknown) =>
        error instanceof AggregateError &&
        error.message.includes("No synopsis found"),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
