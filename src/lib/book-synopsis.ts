import {
  openLibraryAuthorMatches,
  openLibraryTitleMatches,
  normalizeOpenLibraryName,
} from "@/lib/open-library-images";

const OPEN_LIBRARY_ORIGIN = "https://openlibrary.org";
const GOOGLE_BOOKS_ORIGIN = "https://www.googleapis.com";
const WIKIPEDIA_ORIGINS = {
  es: "https://es.wikipedia.org",
  en: "https://en.wikipedia.org",
} as const;
const DUCKDUCKGO_ORIGIN = "https://html.duckduckgo.com";
const USER_AGENT = "BooksTracker/1.0 (https://github.com/mvilchez/books)";
const MAX_SYNOPSIS_LENGTH = 2_000;

export type BookSynopsis = {
  text: string;
  language: "es" | "en" | "unknown";
  sourceUrl: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function cleanSynopsis(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, MAX_SYNOPSIS_LENGTH);
  return text || null;
}

async function fetchJson(url: URL, provider: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${provider} request failed with HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

async function fetchText(url: URL, provider: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${provider} request failed with HTTP ${response.status}.`);
  }
  return response.text();
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;|&#38;/giu, "&")
    .replace(/&lt;|&#60;/giu, "<")
    .replace(/&gt;|&#62;/giu, ">")
    .replace(/&quot;|&#34;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&#x([0-9a-f]+);/giu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#([0-9]+);/gu, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function parseWebSearchSynopsis(
  html: string,
  title: string,
  language: "es" | "en",
): BookSynopsis | null {
  const results = html.matchAll(
    /<a\b[^>]*class="[^"]*\bresult__a\b[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a\b[^>]*class="[^"]*\bresult__snippet\b[^"]*"[^>]*>([\s\S]*?)<\/a>/giu,
  );

  for (const [, rawUrl, rawTitle, rawSnippet] of results) {
    const resultTitle = decodeHtml(rawTitle);
    if (!openLibraryTitleMatches(title, resultTitle)) continue;
    const snippet = cleanSynopsis(decodeHtml(rawSnippet));
    if (!snippet) continue;

    let sourceUrl: string;
    try {
      const resultUrl = new URL(decodeHtml(rawUrl), DUCKDUCKGO_ORIGIN);
      if (resultUrl.hostname === "duckduckgo.com") {
        const target = resultUrl.searchParams.get("uddg");
        if (!target) continue;
        sourceUrl = new URL(target).toString();
      } else if (resultUrl.protocol === "https:" || resultUrl.protocol === "http:") {
        sourceUrl = resultUrl.toString();
      } else {
        continue;
      }
    } catch {
      continue;
    }

    return { text: snippet, language, sourceUrl };
  }
  return null;
}

function parseOpenLibrarySynopsis(
  value: unknown,
  workId: string,
): BookSynopsis | null {
  const raw = record(value)?.description;
  const description =
    typeof raw === "string" ? raw : record(raw)?.value;
  const text = cleanSynopsis(description);
  return text
    ? {
        text,
        language: "unknown",
        sourceUrl: `${OPEN_LIBRARY_ORIGIN}/works/${workId}`,
      }
    : null;
}

function parseGoogleBooksSynopsis(
  value: unknown,
  title: string,
  author: string,
  language: "es" | "en",
): BookSynopsis | null {
  const items = record(value)?.items;
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    const volume = record(record(item)?.volumeInfo);
    const authors = volume?.authors;
    const id = record(item)?.id;
    if (
      !volume ||
      typeof volume.title !== "string" ||
      !Array.isArray(authors) ||
      !authors.every((name): name is string => typeof name === "string") ||
      typeof id !== "string" ||
      !openLibraryTitleMatches(title, volume.title) ||
      !openLibraryAuthorMatches(author, authors)
    ) {
      continue;
    }
    const text = cleanSynopsis(volume.description);
    if (!text) continue;
    return {
      text,
      language,
      sourceUrl: `https://books.google.com/books?id=${encodeURIComponent(id)}`,
    };
  }
  return null;
}

function parseWikipediaSynopsis(
  value: unknown,
  title: string,
  author: string,
  language: "es" | "en",
): BookSynopsis | null {
  const pages = record(record(value)?.query)?.pages;
  if (!Array.isArray(pages)) return null;

  for (const value of pages) {
    const page = record(value);
    if (
      !page ||
      typeof page.title !== "string" ||
      typeof page.extract !== "string" ||
      !openLibraryTitleMatches(title, page.title) ||
      !containsAuthorName(page.extract, author)
    ) {
      continue;
    }
    const text = cleanSynopsis(page.extract);
    if (!text) continue;
    const pageTitle = page.title.replace(/\s+/gu, "_");
    return {
      text,
      language,
      sourceUrl: `${WIKIPEDIA_ORIGINS[language]}/wiki/${encodeURIComponent(pageTitle)}`,
    };
  }
  return null;
}

function containsAuthorName(text: string, author: string): boolean {
  const authorTokenCount = normalizeOpenLibraryName(author).split(" ").length;
  const tokens = text.split(/\s+/u);
  for (let length = Math.max(1, authorTokenCount - 1); length <= authorTokenCount + 1; length++) {
    for (let start = 0; start + length <= tokens.length; start++) {
      if (openLibraryAuthorMatches(author, [tokens.slice(start, start + length).join(" ")])) {
        return true;
      }
    }
  }
  return false;
}

export async function searchBookSynopsis(
  title: string,
  author: string,
  workId: string | null,
  requestDelayMs = 1_000,
): Promise<BookSynopsis | null> {
  let requested = false;
  const providerErrors: Error[] = [];
  const request = async (url: URL, provider: string) => {
    if (requested && requestDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
    }
    try {
      const response = await fetchJson(url, provider);
      requested = true;
      return response;
    } catch (error) {
      requested = true;
      providerErrors.push(
        error instanceof Error ? error : new Error(`${provider} request failed.`),
      );
      return null;
    }
  };

  if (workId && /^OL\d+W$/u.test(workId)) {
    const workUrl = new URL(
      `/works/${encodeURIComponent(workId)}.json`,
      OPEN_LIBRARY_ORIGIN,
    );
    const work = await request(workUrl, "Open Library");
    if (work !== null) {
      const openLibrarySynopsis = parseOpenLibrarySynopsis(work, workId);
      if (openLibrarySynopsis) return openLibrarySynopsis;
    }
  }

  for (const language of ["es", "en"] as const) {
    const url = new URL("/books/v1/volumes", GOOGLE_BOOKS_ORIGIN);
    url.search = new URLSearchParams({
      q: `intitle:${title} inauthor:${author}`,
      langRestrict: language,
      maxResults: "10",
      printType: "books",
    }).toString();
    const volumes = await request(url, "Google Books");
    if (volumes !== null) {
      const synopsis = parseGoogleBooksSynopsis(
        volumes,
        title,
        author,
        language,
      );
      if (synopsis) return synopsis;
    }
  }

  for (const language of ["es", "en"] as const) {
    const url = new URL("/w/api.php", WIKIPEDIA_ORIGINS[language]);
    url.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `"${title}" "${author}"`,
      gsrlimit: "5",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      exchars: String(MAX_SYNOPSIS_LENGTH),
      redirects: "1",
      format: "json",
      formatversion: "2",
    }).toString();
    const results = await request(url, "Wikipedia");
    if (results !== null) {
      const synopsis = parseWikipediaSynopsis(
        results,
        title,
        author,
        language,
      );
      if (synopsis) return synopsis;
    }
  }

  for (const language of ["es", "en"] as const) {
    const query = language === "es" ? "sinopsis resumen" : "synopsis summary";
    const url = new URL("/html/", DUCKDUCKGO_ORIGIN);
    url.search = new URLSearchParams({
      q: `"${title}" "${author}" ${query}`,
      kl: language === "es" ? "es-es" : "us-en",
    }).toString();
    try {
      if (requested && requestDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, requestDelayMs));
      }
      const html = await fetchText(url, "DuckDuckGo web search");
      requested = true;
      const synopsis = parseWebSearchSynopsis(html, title, language);
      if (synopsis) return synopsis;
    } catch (error) {
      requested = true;
      providerErrors.push(
        error instanceof Error
          ? error
          : new Error("DuckDuckGo web search request failed."),
      );
    }
  }

  if (providerErrors.length > 0) {
    throw new AggregateError(
      providerErrors,
      "No synopsis found; one or more synopsis providers failed.",
    );
  }
  return null;
}
