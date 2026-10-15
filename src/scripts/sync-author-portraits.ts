import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  parseCommonsPortrait,
  parseWikidataPortraitEntity,
  parseWikidataSearchMatch,
  type AuthorPortraitIdentity,
  type WikidataPortraitCandidate,
  type VerifiedAuthorPortrait,
} from "@/lib/wikimedia-author-portraits";

const WIKIDATA_API_ENDPOINT = "https://www.wikidata.org/w/api.php";
const COMMONS_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT =
  "BooksTrackerPortraitSync/1.0 (https://github.com/mvilchez/books; contact via repository issues)";
const WIKIDATA_BATCH_SIZE = 50;
const COMMONS_BATCH_SIZE = 10;
const REQUEST_DELAY_MS = 1000;
const MAX_RETRIES = 1;
const DEFAULT_AUTHOR_LIMIT = 1;
const MAX_AUTHOR_LIMIT = 5;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
  }
  return 1000 * 2 ** attempt;
}

function responseApiError(value: unknown): { code: string; info: string } | null {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return null;
  }
  const error = value.error;
  if (typeof error !== "object" || error === null) return null;
  const code = "code" in error ? error.code : undefined;
  const info = "info" in error ? error.info : undefined;
  return {
    code: typeof code === "string" ? code : "unknown",
    info: typeof info === "string" ? info : "no details",
  };
}

function apiErrorRetryDelay(info: string, attempt: number): number {
  const lagSeconds = /(\d+(?:\.\d+)?) seconds lagged/i.exec(info);
  if (lagSeconds) return Math.ceil(Number(lagSeconds[1]) + 1) * 1000;
  return 1000 * 2 ** attempt;
}

async function fetchJson(
  url: URL,
  accept: string,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "Accept-Encoding": "gzip",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      const body: unknown = await response.json();
      const apiError = responseApiError(body);
      if (!apiError) return body;
      if (
        (apiError.code === "maxlag" || apiError.code === "ratelimited") &&
        attempt < MAX_RETRIES
      ) {
        const waitMilliseconds = apiErrorRetryDelay(apiError.info, attempt);
        console.warn(
          `Wikimedia returned ${apiError.code}; waiting ${Math.ceil(waitMilliseconds / 1000)}s before retry.`,
        );
        await delay(waitMilliseconds);
        continue;
      }
      throw new Error(`Wikimedia API error (${apiError.code}): ${apiError.info}`);
    }

    if (
      (response.status === 429 || response.status === 503) &&
      attempt < MAX_RETRIES
    ) {
      const waitMilliseconds = retryDelay(response, attempt);
      console.warn(
        `Wikimedia returned ${response.status}; waiting ${Math.ceil(waitMilliseconds / 1000)}s before retry.`,
      );
      await delay(waitMilliseconds);
      continue;
    }
    throw new Error(`Wikimedia request failed with HTTP ${response.status}.`);
  }
  throw new Error("Wikimedia request exhausted its retry limit.");
}

async function findWikidataCandidates(
  authors: readonly AuthorPortraitIdentity[],
) {
  const matches: Array<{ author: AuthorPortraitIdentity; wikidataId: string }> = [];
  for (const author of authors) {
    let wikidataId: string | null = null;
    for (const language of ["en", "es"]) {
      const url = new URL(WIKIDATA_API_ENDPOINT);
      url.search = new URLSearchParams({
        action: "wbsearchentities",
        format: "json",
        language,
        limit: "10",
        maxlag: "5",
        search: author.name,
        type: "item",
        uselang: language,
      }).toString();
      const data = await fetchJson(url, "application/json");
      wikidataId = parseWikidataSearchMatch(data, author);
      await delay(REQUEST_DELAY_MS);
      if (wikidataId) break;
    }
    if (wikidataId) matches.push({ author, wikidataId });
  }

  const authorCountById = new Map<string, number>();
  for (const match of matches) {
    authorCountById.set(
      match.wikidataId,
      (authorCountById.get(match.wikidataId) ?? 0) + 1,
    );
  }
  const uniqueMatches = matches.filter(
    ({ wikidataId }) => authorCountById.get(wikidataId) === 1,
  );
  const candidates = [];
  for (const matchBatch of chunks(uniqueMatches, WIKIDATA_BATCH_SIZE)) {
    if (matchBatch.length === 0) continue;
    const url = new URL(WIKIDATA_API_ENDPOINT);
    url.search = new URLSearchParams({
      action: "wbgetentities",
      format: "json",
      ids: matchBatch.map(({ wikidataId }) => wikidataId).join("|"),
      maxlag: "5",
      props: "claims",
    }).toString();
    const data = await fetchJson(url, "application/json");
    for (const match of matchBatch) {
      const candidate = parseWikidataPortraitEntity(
        data,
        match.author,
        match.wikidataId,
      );
      if (candidate) candidates.push(candidate);
    }
    await delay(REQUEST_DELAY_MS);
  }
  return candidates;
}

async function fetchCommonsPortraits(
  candidates: readonly WikidataPortraitCandidate[],
): Promise<VerifiedAuthorPortrait[]> {
  const verified: VerifiedAuthorPortrait[] = [];
  for (const candidateBatch of chunks(candidates, COMMONS_BATCH_SIZE)) {
    const url = new URL(COMMONS_API_ENDPOINT);
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      maxlag: "5",
      prop: "imageinfo",
      titles: candidateBatch.map(({ fileName }) => `File:${fileName}`).join("|"),
      iiprop: "url|extmetadata",
      iiurlwidth: "320",
      iiextmetadatafilter: "Artist|Credit|LicenseShortName|LicenseUrl",
    }).toString();
    const data = await fetchJson(url, "application/json");
    for (const candidate of candidateBatch) {
      const portrait = parseCommonsPortrait(data, candidate);
      if (portrait) verified.push(portrait);
    }
    await delay(REQUEST_DELAY_MS);
  }
  return verified;
}

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length);
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = readOption(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || (name === "limit" && parsed < 1)) {
    throw new Error(`Use --${name}=${name === "offset" ? "0 or a positive integer" : "a positive integer"}.`);
  }
  return parsed;
}

function readLimit(): number {
  const argument = process.argv.find((value) => value.startsWith("--limit="));
  const limit = argument ? Number(argument.slice("--limit=".length)) : DEFAULT_AUTHOR_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_AUTHOR_LIMIT) {
    throw new Error(`Use --limit=1..${MAX_AUTHOR_LIMIT}; portrait sync is deliberately capped per run.`);
  }
  return limit;
}

function hasAuthorNameLetters(name: string): boolean {
  return /\p{L}/u.test(name);
}

async function main(): Promise<void> {
  const applyChanges = process.argv.includes("--apply");
  const limit = readLimit();
  const offset = readPositiveInteger("offset", 0);
  const authorName = readOption("author-name")?.trim();
  const authorId = readOption("author-id")?.trim();
  if (authorName === "" || authorId === "") {
    throw new Error("Use non-empty values for --author-name and --author-id.");
  }
  if (authorName && authorId) {
    throw new Error("Use only one of --author-name or --author-id.");
  }
  if ((authorName || authorId) && process.argv.some((value) => value.startsWith("--offset="))) {
    throw new Error("--author-name/--author-id and --offset cannot be used together.");
  }
  try {
    const storedAuthors = await prisma.author.findMany({
      where: {
        portraitUrl: null,
        ...(authorName ? { name: authorName } : {}),
        ...(authorId ? { id: authorId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const eligibleAuthors = storedAuthors.filter(({ name }) =>
      hasAuthorNameLetters(name),
    );
    const skippedInvalidNames = storedAuthors.length - eligibleAuthors.length;
    const authors =
      authorName || authorId
        ? eligibleAuthors.slice(0, 2)
        : eligibleAuthors.slice(offset, offset + limit);
    if ((authorName || authorId) && authors.length > 1) {
      throw new Error(`More than one author matched "${authorName ?? authorId}".`);
    }
    if (skippedInvalidNames > 0) {
      console.log(
        `Skipping ${skippedInvalidNames} record(s) whose author name has no letters; no provider requests were made for them.`,
      );
    }
    if (authors.length === 0) {
      console.log("No eligible authors matched this batch. Existing portraits are left unchanged.");
      return;
    }

    console.log(
      `Checking ${authors.length} author(s)` +
        (authorName
          ? ` matching "${authorName}"`
          : authorId
            ? ` with ID ${authorId}`
            : ` starting at offset ${offset}`) +
        ` (${applyChanges ? "apply mode" : "dry run"}). Image files are not downloaded.`,
    );
    console.log(`Stage 1/3: exact-name identity lookup for ${authors.map(({ name }) => name).join(", ")}.`);
    const candidates = await findWikidataCandidates(authors);
    console.log(`Stage 2/3: verifying Commons image license and attribution for ${candidates.length} candidate(s).`);
    const portraits = await fetchCommonsPortraits(candidates);
    const verifiedIds = new Set(portraits.map(({ authorId }) => authorId));

    console.log("Stage 3/3: review-only output; no changes are made unless --apply is set.");
    for (const portrait of portraits) {
      console.log(
        `  verified · ${portrait.authorName} · ${portrait.wikidataId} · ` +
          `${portrait.portraitLicense} · ${portrait.portraitSourceUrl}`,
      );
    }
    const unresolved = authors.length - verifiedIds.size;
    console.log(
      `Verified ${portraits.length} portrait(s); ${unresolved} author(s) have no unique exact identity and licensed/credited image.`,
    );

    if (!applyChanges) {
      console.log(
        "Dry run only. Review the identity, source, and credit above, then rerun this exact batch with --apply.",
      );
      return;
    }
    if (portraits.length === 0) {
      console.log("No portrait records to store.");
      return;
    }

    await prisma.$transaction(async (transaction) => {
      for (const portrait of portraits) {
        const updated = await transaction.author.updateMany({
          where: {
            id: portrait.authorId,
            portraitUrl: null,
            wikidataId: null,
          },
          data: {
            wikidataId: portrait.wikidataId,
            portraitUrl: portrait.portraitUrl,
            portraitSourceUrl: portrait.portraitSourceUrl,
            portraitArtist: portrait.portraitArtist,
            portraitLicense: portrait.portraitLicense,
            portraitLicenseUrl: portrait.portraitLicenseUrl,
          },
        });
        if (updated.count !== 1) {
          throw new Error(
            `Author "${portrait.authorName}" changed during portrait sync; expected one update, got ${updated.count}.`,
          );
        }
      }
    });
    console.log(`Stored ${portraits.length} verified author portrait(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Author portrait sync failed:", error);
  process.exitCode = 1;
});
