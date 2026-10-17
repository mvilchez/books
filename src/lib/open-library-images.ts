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

export type OpenLibraryBookMetadata = {
  workId: string;
  title: string;
  coverId: number | null;
  firstPublishYear: number | null;
  pageCount: number | null;
  format: string | null;
  isbn13: string | null;
  subjects: string[];
  languages: string[];
  seriesName: string | null;
  seriesPosition: number | null;
};

export type OpenLibraryMetadataCandidate = {
  workId: string;
  title: string;
  authors: string[];
  subjects: string[];
  firstPublishYear: number | null;
  coverId: number | null;
  titleSimilarity: number;
  authorSimilarity: number;
};

export type OpenLibraryBookLookup = {
  metadata: OpenLibraryBookMetadata | null;
  possibleMatches: OpenLibraryMetadataCandidate[];
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
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function authorNameParts(value: string): string[] {
  return value
    .split(/\s*(?:;|\||\/|&|\band\b|\by\b)\s*/iu)
    .map(normalizeOpenLibraryName)
    .filter(Boolean);
}

function editSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left || !right) return 0;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
    }
    previous = current;
  }
  return 1 - previous[right.length] / Math.max(left.length, right.length);
}

function authorTokensMatch(left: string, right: string): boolean {
  return left === right || (left.length === 1 && right.startsWith(left)) ||
    (right.length === 1 && left.startsWith(right));
}

function authorNameMatches(left: string, right: string): boolean {
  const leftTokens = left.split(" ").filter(Boolean);
  const rightTokens = right.split(" ").filter(Boolean);
  if (leftTokens.length === 0 || rightTokens.length === 0) return false;

  const [shorter, longer] =
    leftTokens.length <= rightTokens.length
      ? [leftTokens, rightTokens]
      : [rightTokens, leftTokens];
  const available = new Set(longer.map((_, index) => index));
  let matches = 0;
  for (const token of shorter) {
    const matchIndex = [...available].find((index) =>
      authorTokensMatch(token, longer[index]),
    );
    if (matchIndex === undefined) continue;
    available.delete(matchIndex);
    matches++;
  }

  if (matches === shorter.length && available.size <= 1) return true;
  if (Math.min(left.length, right.length) >= 6) {
    const sortedLeft = [...leftTokens].sort().join(" ");
    const sortedRight = [...rightTokens].sort().join(" ");
    if (sortedLeft === sortedRight) return true;
    return editSimilarity(left, right) >= 0.82;
  }
  return false;
}

function normalizeBookTitle(value: string): string {
  return normalizeOpenLibraryName(value).replace(
    /^(?:a|an|the|el|la|los|las|un|una|unos|unas)\s+/u,
    "",
  );
}

export function openLibraryTitleMatches(
  requestedTitle: string,
  candidateTitle: string,
): boolean {
  const requested = normalizeBookTitle(requestedTitle);
  const candidate = normalizeBookTitle(candidateTitle);
  if (!requested || !candidate) return false;
  if (requested === candidate) return true;

  const requestedTokens = requested.split(" ");
  const candidateTokens = candidate.split(" ");
  if (
    requestedTokens.length > 1 &&
    candidateTokens.length > 1 &&
    Math.abs(requestedTokens.length - candidateTokens.length) <= 1
  ) {
    const candidateTokenCounts = new Map<string, number>();
    for (const token of candidateTokens) {
      candidateTokenCounts.set(token, (candidateTokenCounts.get(token) ?? 0) + 1);
    }
    let matchingTokens = 0;
    for (const token of requestedTokens) {
      const count = candidateTokenCounts.get(token) ?? 0;
      if (count === 0) continue;
      candidateTokenCounts.set(token, count - 1);
      matchingTokens++;
    }
    if (
      matchingTokens / Math.max(requestedTokens.length, candidateTokens.length) >=
      0.8
    ) {
      return true;
    }
  }

  return (
    Math.min(requested.length, candidate.length) >= 6 &&
    editSimilarity(requested, candidate) >= 0.86
  );
}

export function openLibraryTitleSimilarity(
  requestedTitle: string,
  candidateTitle: string,
): number {
  const requested = normalizeBookTitle(requestedTitle);
  const candidate = normalizeBookTitle(candidateTitle);
  if (!requested || !candidate) return 0;
  if (requested === candidate) return 1;

  const requestedTokens = requested.split(" ");
  const candidateTokens = candidate.split(" ");
  const tokenOverlap =
    requestedTokens.length > 1 && candidateTokens.length > 1
      ? (() => {
          const remaining = new Map<string, number>();
          for (const token of candidateTokens) {
            remaining.set(token, (remaining.get(token) ?? 0) + 1);
          }
          let matches = 0;
          for (const token of requestedTokens) {
            const count = remaining.get(token) ?? 0;
            if (count === 0) continue;
            remaining.set(token, count - 1);
            matches++;
          }
          return matches / Math.max(requestedTokens.length, candidateTokens.length);
        })()
      : 0;
  return Math.max(editSimilarity(requested, candidate), tokenOverlap);
}

function authorNameSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeOpenLibraryName(left);
  const normalizedRight = normalizeOpenLibraryName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (authorNameMatches(normalizedLeft, normalizedRight)) return 1;
  const sortedLeft = normalizedLeft.split(" ").sort().join(" ");
  const sortedRight = normalizedRight.split(" ").sort().join(" ");
  return Math.max(
    editSimilarity(sortedLeft, sortedRight),
    editSimilarity(normalizedLeft, normalizedRight),
  );
}

export function openLibraryAuthorMatches(
  requestedAuthor: string,
  candidateAuthors: readonly string[],
): boolean {
  const requestedNames = authorNameParts(requestedAuthor);
  return candidateAuthors.some((candidateAuthor) => {
    const candidateNames = authorNameParts(candidateAuthor);
    return candidateNames.some((candidateName) =>
      requestedNames.some((requestedName) =>
        authorNameMatches(requestedName, candidateName),
      ),
    );
  });
}

export function openLibraryAuthorSimilarity(
  requestedAuthor: string,
  candidateAuthors: readonly string[],
): number {
  const requestedNames = authorNameParts(requestedAuthor);
  if (requestedNames.length === 0) return 0;
  return Math.max(
    0,
    ...candidateAuthors.flatMap((candidateAuthor) =>
      authorNameParts(candidateAuthor).flatMap((candidateName) =>
        requestedNames.map((requestedName) =>
          authorNameSimilarity(requestedName, candidateName),
        ),
      ),
    ),
  );
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0
    ? value
    : null;
}

function publicationYear(value: unknown): number | null {
  if (typeof value === "number") {
    return positiveInteger(value);
  }
  if (typeof value !== "string") return null;
  const match = value.match(/\b(?:1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/);
  return match ? Number(match[0]) : null;
}

function values(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return stringArray(value);
}

function languageName(value: string): string {
  const code = value.split("/").at(-1)?.toLowerCase() ?? value.toLowerCase();
  const known: Record<string, string> = {
    eng: "English",
    spa: "Spanish",
    fre: "French",
    fra: "French",
    ger: "German",
    deu: "German",
    ita: "Italian",
    por: "Portuguese",
    cat: "Catalan",
    rus: "Russian",
    jpn: "Japanese",
    chi: "Chinese",
    zho: "Chinese",
  };
  return known[code] ?? code.toUpperCase();
}

function metadataEdition(
  value: unknown,
  knownPageCount: number | null,
  knownPublicationYear: number | null,
): {
  pageCount: number | null;
  format: string | null;
  isbn13: string | null;
} {
  const root = record(value);
  const rawEditions = root?.docs ?? value;
  if (!Array.isArray(rawEditions)) {
    return { pageCount: null, format: null, isbn13: null };
  }

  const editions = rawEditions
    .map(record)
    .filter((edition): edition is Record<string, unknown> => edition !== null)
    .map((edition) => {
      const pageCount = positiveInteger(edition.number_of_pages);
      const rawFormat = values(edition.physical_format).find((item) => item.trim());
      const isbn13 =
        stringArray(edition.isbn_13).find((item) => /^\d{13}$/.test(item)) ?? null;
      return {
        pageCount,
        format: rawFormat?.trim().slice(0, 191) ?? null,
        isbn13,
        publicationYear: publicationYear(values(edition.publish_date)[0]),
      };
    });
  editions.sort((left, right) => {
    const leftScore =
      Number(knownPageCount !== null && left.pageCount === knownPageCount) * 2 +
      Number(
        knownPublicationYear !== null &&
          left.publicationYear === knownPublicationYear,
      );
    const rightScore =
      Number(knownPageCount !== null && right.pageCount === knownPageCount) * 2 +
      Number(
        knownPublicationYear !== null &&
          right.publicationYear === knownPublicationYear,
      );
    return rightScore - leftScore;
  });
  const edition = editions[0];
  return {
    pageCount: edition?.pageCount ?? null,
    format: edition?.format ?? null,
    isbn13: edition?.isbn13 ?? null,
  };
}

export function parseOpenLibraryBookMetadata(
  value: unknown,
  requestedTitle: string,
  requestedAuthor: string,
  knownPageCount: number | null = null,
  knownPublicationYear: number | null = null,
): OpenLibraryBookMetadata | null {
  const root = record(value);
  if (!Array.isArray(root?.docs)) {
    throw new Error("Open Library returned malformed metadata search results.");
  }

  const authorKey = normalizeOpenLibraryName(requestedAuthor);
  if (!normalizeBookTitle(requestedTitle) || !authorKey) return null;

  const matchedDoc = root.docs
    .slice(0, 50)
    .map(record)
    .find((doc) => {
      if (!doc || typeof doc.key !== "string" || !/^\/works\/OL\d+W$/.test(doc.key)) {
        return false;
      }
      return (
        typeof doc.title === "string" &&
        openLibraryTitleMatches(requestedTitle, doc.title) &&
        openLibraryAuthorMatches(requestedAuthor, stringArray(doc.author_name))
      );
    });
  if (!matchedDoc || typeof matchedDoc.key !== "string") return null;

  const title =
    typeof matchedDoc.title === "string" ? matchedDoc.title.trim() : "";
  if (!title) return null;
  const edition = metadataEdition(
    matchedDoc.editions,
    knownPageCount,
    knownPublicationYear,
  );
  const rawSeries = values(matchedDoc.series).find((item) => item.trim());
  const seriesPosition =
    typeof matchedDoc.series_position === "number" &&
    Number.isFinite(matchedDoc.series_position) &&
    matchedDoc.series_position > 0
      ? matchedDoc.series_position
      : null;
  const coverId = positiveInteger(matchedDoc.cover_i);
  return {
    workId: matchedDoc.key.slice("/works/".length),
    title,
    coverId,
    firstPublishYear: publicationYear(matchedDoc.first_publish_year),
    pageCount: edition.pageCount,
    format: edition.format,
    isbn13: edition.isbn13,
    subjects: stringArray(matchedDoc.subject)
      .map((subject) => subject.trim().slice(0, 191))
      .filter(Boolean)
      .slice(0, 20),
    languages: [
      ...new Set(stringArray(matchedDoc.language).map(languageName)),
    ].slice(0, 10),
    seriesName: rawSeries?.trim().slice(0, 191) ?? null,
    seriesPosition,
  };
}

export function parseOpenLibraryPossibleMatches(
  value: unknown,
  requestedTitle: string,
  requestedAuthor: string,
): OpenLibraryMetadataCandidate[] {
  const root = record(value);
  if (!Array.isArray(root?.docs)) {
    throw new Error("Open Library returned malformed metadata search results.");
  }

  return root.docs
    .slice(0, 50)
    .map(record)
    .filter((doc): doc is Record<string, unknown> => doc !== null)
    .flatMap((doc) => {
      if (
        typeof doc.key !== "string" ||
        !/^\/works\/OL\d+W$/.test(doc.key) ||
        typeof doc.title !== "string" ||
        !doc.title.trim()
      ) {
        return [];
      }
      const authors = stringArray(doc.author_name).slice(0, 10);
      const titleSimilarity = openLibraryTitleSimilarity(
        requestedTitle,
        doc.title,
      );
      const authorSimilarity = openLibraryAuthorSimilarity(
        requestedAuthor,
        authors,
      );
      if (
        titleSimilarity < 0.55 ||
        (titleSimilarity < 0.8 && authorSimilarity < 0.55)
      ) {
        return [];
      }
      return [
        {
          workId: doc.key.slice("/works/".length),
          title: doc.title.trim(),
          authors,
          subjects: stringArray(doc.subject)
            .map((subject) => subject.trim())
            .filter(Boolean)
            .slice(0, 10),
          firstPublishYear: publicationYear(doc.first_publish_year),
          coverId: positiveInteger(doc.cover_i),
          titleSimilarity,
          authorSimilarity,
        },
      ];
    })
    .sort(
      (left, right) =>
        right.titleSimilarity + right.authorSimilarity -
          (left.titleSimilarity + left.authorSimilarity) ||
        left.title.localeCompare(right.title),
    )
    .slice(0, 5);
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

export async function searchOpenLibraryMetadata(
  title: string,
  author: string,
  knownPageCount: number | null,
  knownPublicationYear: number | null,
): Promise<OpenLibraryBookMetadata | null> {
  return (
    await searchOpenLibraryBookLookup(
      title,
      author,
      knownPageCount,
      knownPublicationYear,
    )
  ).metadata;
}

export async function searchOpenLibraryBookLookup(
  title: string,
  author: string,
  knownPageCount: number | null,
  knownPublicationYear: number | null,
): Promise<OpenLibraryBookLookup> {
  const url = new URL("/search.json", OPEN_LIBRARY_ORIGIN);
  url.search = new URLSearchParams({
    title,
    author,
    limit: "50",
    fields:
      "key,title,author_name,cover_i,first_publish_year,subject,language,editions,editions.key,editions.title,editions.number_of_pages,editions.physical_format,editions.isbn_13,editions.publish_date",
  }).toString();
  const response = await fetchJson(url);
  return {
   metadata: parseOpenLibraryBookMetadata(
     response,
     title,
     author,
     knownPageCount,
     knownPublicationYear,
   ),
   possibleMatches: parseOpenLibraryPossibleMatches(
     response,
     title,
     author,
   ),
  };
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
