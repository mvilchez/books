import {
  filterUnreadOpenLibraryBooks,
  type OpenLibraryRecommendation,
} from "@/lib/book-recommendations";

const OPEN_LIBRARY_ORIGIN = "https://openlibrary.org";
const COVERS_ORIGIN = "https://covers.openlibrary.org";
const USER_AGENT = "BooksTracker/1.0 (https://github.com/mvilchez/books)";

export type OpenLibraryBookCandidate = {
  workId: string;
  title: string;
  authors: string[];
  coverId: number;
  isbn: string[];
};

export type OpenLibraryRecommendationResult = {
  language: "spa" | "eng";
  books: OpenLibraryRecommendation[];
};

export type OpenLibraryAuthorCandidate = {
  authorId: string;
  name: string;
};

export type OpenLibraryAuthorPhotoCandidate = OpenLibraryAuthorCandidate & {
  photoId: number;
  photoUrl: string;
};

export type OpenLibraryAuthorProfile = {
  name: string | null;
  photoId: number | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "force-cache",
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Open Library request failed with HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

export function normalizeOpenLibraryName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseOpenLibraryBookCandidates(
  value: unknown,
): OpenLibraryBookCandidate[] {
  const root = record(value);
  if (!Array.isArray(root?.docs)) {
    throw new Error("Open Library returned malformed book search results.");
  }

  const candidates: OpenLibraryBookCandidate[] = [];
  for (const rawDoc of root.docs) {
    if (candidates.length === 5) break;
    const doc = record(rawDoc);
    if (!doc) continue;
    const workKey = doc?.key;
    const title = doc?.title;
    const coverId = doc?.cover_i;
    if (
      typeof workKey !== "string" ||
      !/^\/works\/OL\d+W$/.test(workKey) ||
      typeof title !== "string" ||
      !title.trim() ||
      typeof coverId !== "number" ||
      !Number.isSafeInteger(coverId) ||
      coverId <= 0
    ) {
      continue;
    }

    candidates.push({
      workId: workKey.slice("/works/".length),
      title: title.trim(),
      authors: stringArray(doc.author_name).slice(0, 5),
      coverId,
      isbn: stringArray(doc.isbn).slice(0, 5),
    });
  }
  return candidates;
}

export function parseOpenLibraryRecommendationCandidates(
  value: unknown,
): OpenLibraryRecommendation[] {
  const root = record(value);
  if (!Array.isArray(root?.docs)) {
    throw new Error("Open Library returned malformed recommendation results.");
  }

  const candidates: OpenLibraryRecommendation[] = [];
  for (const rawDoc of root.docs) {
    if (candidates.length === 50) break;
    const doc = record(rawDoc);
    if (!doc) continue;
    const workKey = doc.key;
    const title = doc.title;
    if (
      typeof workKey !== "string" ||
      !/^\/works\/OL\d+W$/.test(workKey) ||
      typeof title !== "string" ||
      !title.trim()
    ) {
      continue;
    }

    const firstPublishYear = doc.first_publish_year;
    candidates.push({
      workId: workKey.slice("/works/".length),
      title: title.trim(),
      authors: stringArray(doc.author_name).slice(0, 5),
      firstPublishYear:
        typeof firstPublishYear === "number" &&
        Number.isInteger(firstPublishYear) &&
        firstPublishYear > 0
          ? firstPublishYear
          : null,
    });
  }
  return candidates;
}

export function parseOpenLibraryAuthorCandidates(
  value: unknown,
): OpenLibraryAuthorCandidate[] {
  const root = record(value);
  if (!Array.isArray(root?.docs)) {
    throw new Error("Open Library returned malformed author search results.");
  }

  const candidates: OpenLibraryAuthorCandidate[] = [];
  for (const rawDoc of root.docs) {
    if (candidates.length === 10) break;
    const doc = record(rawDoc);
    const key = doc?.key;
    const name = doc?.name;
    const authorId =
      typeof key === "string" && key.startsWith("/authors/")
        ? key.slice("/authors/".length)
        : key;
    if (
      typeof authorId === "string" &&
      /^OL\d+A$/.test(authorId) &&
      typeof name === "string" &&
      name.trim()
    ) {
      candidates.push({
        authorId,
        name: name.trim(),
      });
    }
  }
  return candidates;
}

export function parseOpenLibraryAuthorProfile(
  value: unknown,
): OpenLibraryAuthorProfile {
  const root = record(value);
  const photos = root?.photos;
  const name = typeof root?.name === "string" ? root.name : null;
  const photoId = Array.isArray(photos)
    ? photos.find(
        (photo): photo is number =>
          typeof photo === "number" && Number.isSafeInteger(photo) && photo > 0,
      ) ?? null
    : null;
  return { name, photoId };
}

export async function searchOpenLibraryBooks(
  title: string,
  author: string,
): Promise<OpenLibraryBookCandidate[]> {
  const url = new URL("/search.json", OPEN_LIBRARY_ORIGIN);
  url.search = new URLSearchParams({
    title,
    author,
    limit: "5",
    fields: "key,title,author_name,isbn,cover_i",
  }).toString();
  return parseOpenLibraryBookCandidates(await fetchJson(url));
}

export async function searchOpenLibraryRecommendations(
  author: string,
  readBooks: readonly { title: string; workId: string | null }[],
  sourceBook: { title: string; workId: string | null },
): Promise<OpenLibraryRecommendationResult> {
  for (const language of ["spa", "eng"] as const) {
    const url = new URL("/search.json", OPEN_LIBRARY_ORIGIN);
    url.search = new URLSearchParams({
      author,
      language,
      limit: "50",
      fields: "key,title,author_name,first_publish_year",
    }).toString();
    const candidates = parseOpenLibraryRecommendationCandidates(
      await fetchJson(url),
    );
    const books = filterUnreadOpenLibraryBooks(
      candidates,
      readBooks,
      sourceBook,
    );
    if (books.length > 0) return { language, books };
  }
  return { language: "eng", books: [] };
}

export async function searchOpenLibraryAuthors(
  name: string,
): Promise<OpenLibraryAuthorCandidate[]> {
  const url = new URL("/search/authors.json", OPEN_LIBRARY_ORIGIN);
  url.search = new URLSearchParams({ q: name, limit: "20" }).toString();
  return parseOpenLibraryAuthorCandidates(await fetchJson(url));
}

export function prioritizeOpenLibraryAuthorCandidates(
  candidates: readonly OpenLibraryAuthorCandidate[],
  requestedName: string,
): OpenLibraryAuthorCandidate[] {
  const normalizedName = normalizeOpenLibraryName(requestedName);
  return [...candidates].sort((left, right) => {
    const leftIsExact = normalizeOpenLibraryName(left.name) === normalizedName;
    const rightIsExact = normalizeOpenLibraryName(right.name) === normalizedName;
    return Number(rightIsExact) - Number(leftIsExact);
  });
}

export async function searchOpenLibraryAuthorPhotos(
  name: string,
): Promise<OpenLibraryAuthorPhotoCandidate[]> {
  const candidates = prioritizeOpenLibraryAuthorCandidates(
    await searchOpenLibraryAuthors(name),
    name,
  );
  const withPhotos: OpenLibraryAuthorPhotoCandidate[] = [];
  for (const candidate of candidates.slice(0, 10)) {
    const { photoId } = await getOpenLibraryAuthorProfile(candidate.authorId);
    if (photoId === null) continue;
    const photoUrl = getOpenLibraryAuthorPhotoUrl(photoId, "M");
    if (!photoUrl) continue;
    withPhotos.push({ ...candidate, photoId, photoUrl });
    if (withPhotos.length === 5) break;
  }
  return withPhotos;
}

export async function getOpenLibraryAuthorProfile(
  authorId: string,
): Promise<OpenLibraryAuthorProfile> {
  if (!/^OL\d+A$/.test(authorId)) {
    throw new Error("Invalid Open Library author identifier.");
  }
  const value = await fetchJson(
    new URL(`/authors/${authorId}.json`, OPEN_LIBRARY_ORIGIN),
  );
  return parseOpenLibraryAuthorProfile(value);
}

export function getOpenLibraryCoverUrl(
  coverId: number,
  size: "S" | "M" | "L",
): string | null {
  if (!Number.isSafeInteger(coverId) || coverId <= 0) return null;
  return `${COVERS_ORIGIN}/b/id/${coverId}-${size}.jpg?default=false`;
}

export function getOpenLibraryAuthorPhotoUrl(
  photoId: number,
  size: "S" | "M" | "L",
): string | null {
  if (!Number.isSafeInteger(photoId) || photoId <= 0) return null;
  return `${COVERS_ORIGIN}/a/id/${photoId}-${size}.jpg?default=false`;
}

export function getOpenLibraryWorkUrl(workId: string): string | null {
  return /^OL\d+W$/.test(workId)
    ? `${OPEN_LIBRARY_ORIGIN}/works/${workId}`
    : null;
}

export function getOpenLibraryAuthorUrl(authorId: string): string | null {
  return /^OL\d+A$/.test(authorId)
    ? `${OPEN_LIBRARY_ORIGIN}/authors/${authorId}`
    : null;
}
