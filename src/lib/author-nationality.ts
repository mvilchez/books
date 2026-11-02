import {
  normalizeOpenLibraryName,
  type OpenLibraryAuthorCandidate,
} from "@/lib/open-library-images";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

export function exactOpenLibraryAuthorMatches(
  candidates: readonly OpenLibraryAuthorCandidate[],
  requestedName: string,
): OpenLibraryAuthorCandidate[] {
  const normalizedName = normalizeOpenLibraryName(requestedName);
  return candidates.filter(
    (candidate) =>
      normalizeOpenLibraryName(candidate.name) === normalizedName,
  );
}

export function commonNationality(
  nationalities: readonly (string | null)[],
): string | null {
  const knownNationalities = nationalities.filter(
    (nationality): nationality is string => nationality !== null,
  );
  if (knownNationalities.length === 0) return null;
  const first = knownNationalities[0];
  return knownNationalities.every((nationality) => nationality === first)
    ? first
    : null;
}

export function parseWikidataId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (/^Q\d+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (
      (url.hostname === "www.wikidata.org" ||
        url.hostname === "wikidata.org") &&
      url.pathname.startsWith("/wiki/")
    ) {
      const match = url.pathname.match(/^\/wiki\/(Q\d+)\/?$/);
      return match?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseWikidataNameSearchResults(
  value: unknown,
  requestedName: string,
): string[] {
  const root = record(value);
  if (!Array.isArray(root?.search)) return [];

  const normalizedName = normalizeOpenLibraryName(requestedName);
  const ids = new Set<string>();
  for (const rawResult of root.search) {
    const result = record(rawResult);
    if (
      typeof result?.label !== "string" ||
      normalizeOpenLibraryName(result.label) !== normalizedName
    ) {
      continue;
    }
    const id = parseWikidataId(result.id);
    if (id) ids.add(id);
  }
  return [...ids];
}

export function parseOpenLibraryWikidataId(
  value: unknown,
  requestedName: string,
): string | null {
  const author = record(value);
  if (
    typeof author?.name !== "string" ||
    normalizeOpenLibraryName(author.name) !==
      normalizeOpenLibraryName(requestedName)
  ) {
    return null;
  }
  const remoteIds = record(author.remote_ids);
  return parseWikidataId(remoteIds?.wikidata);
}

export function parseWikidataCitizenshipIds(
  value: unknown,
  wikidataId: string,
): string[] {
  const root = record(value);
  const entities = record(root?.entities);
  const entity = record(entities?.[wikidataId]);
  const claims = record(entity?.claims);
  const citizenshipClaims = claims?.P27;
  if (!Array.isArray(citizenshipClaims)) return [];

  const countryIds = new Set<string>();
  for (const rawClaim of citizenshipClaims) {
    const claim = record(rawClaim);
    if (claim?.rank === "deprecated") continue;
    const mainsnak = record(claim?.mainsnak);
    const datavalue = record(mainsnak?.datavalue);
    const valueRecord = record(datavalue?.value);
    const countryId = valueRecord?.id;
    if (typeof countryId === "string" && /^Q\d+$/.test(countryId)) {
      countryIds.add(countryId);
    }
  }
  return [...countryIds];
}

export function parseWikidataCountryCodes(
  value: unknown,
  countryIds: readonly string[],
): string[] {
  const root = record(value);
  const entities = record(root?.entities);
  if (!entities) return [];

  const codes = new Set<string>();
  for (const countryId of countryIds) {
    const entity = record(entities[countryId]);
    const claims = record(entity?.claims);
    const alpha2Claims = claims?.P297;
    if (!Array.isArray(alpha2Claims)) continue;

    for (const rawClaim of alpha2Claims) {
      const claim = record(rawClaim);
      if (claim?.rank === "deprecated") continue;
      const mainsnak = record(claim?.mainsnak);
      const datavalue = record(mainsnak?.datavalue);
      const rawCode = datavalue?.value;
      // P297 (ISO 3166-1 alpha-2 code) is a string datatype on Wikidata, so
      // datavalue.value is the raw code string ("GB"), not a wikibase entity
      // object. Accept both shapes defensively.
      const alpha2 =
        typeof rawCode === "string" ? rawCode : record(rawCode)?.value;
      if (typeof alpha2 === "string" && /^[A-Z]{2}$/.test(alpha2)) {
        codes.add(alpha2);
      }
    }
  }
  return [...codes];
}
