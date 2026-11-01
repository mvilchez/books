import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  commonNationality,
  exactOpenLibraryAuthorMatches,
  parseOpenLibraryWikidataId,
  parseWikidataCitizenshipIds,
  parseWikidataCountryCodes,
  parseWikidataId,
  parseWikidataNameSearchResults,
} from "@/lib/author-nationality";
import {
  fetchJson,
  parseOpenLibraryAuthorCandidates,
} from "@/lib/open-library-images";

const OPEN_LIBRARY_ORIGIN = "https://openlibrary.org";
const WIKIDATA_API_ORIGIN = "https://www.wikidata.org/w/api.php";
const USER_AGENT = "BooksTracker/1.0 (https://github.com/mvilchez/books)";

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const limitIndex = process.argv.indexOf("--limit");
  const limit = limitIndex < 0 ? undefined : Number(process.argv[limitIndex + 1]);
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }

  try {
    const authors = await prisma.author.findMany({
      where: { nationality: null },
      select: { id: true, name: true, wikidataId: true },
      orderBy: { name: "asc" },
      ...(limit ? { take: limit } : {}),
    });

    const mode = execute ? "EXECUTE" : "DRY RUN";
    console.log(`${mode}: ${authors.length} authors without nationality selected.`);
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const [index, author] of authors.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      console.log(`[${index + 1}/${authors.length}] Looking up nationality for ${author.name}`);

      try {
        const storedWikidataId = parseWikidataId(author.wikidataId);
        let wikidataIds: string[];
        if (storedWikidataId) {
          wikidataIds = [storedWikidataId];
        } else {
          wikidataIds = await findWikidataIdsByName(author.name);
          if (wikidataIds.length === 0) {
            const openLibraryIds = await findOpenLibraryWikidataIds(author.name);
            wikidataIds = openLibraryIds.filter(
              (id): id is string => id !== null,
            );
            if (wikidataIds.length > 0) {
              console.log(
                "  No exact Wikidata name-search results; using Open Library-linked entities.",
              );
            }
          }
        }
        if (wikidataIds.length === 0) {
          skipped++;
          console.log("  No exact-name Wikidata records found.");
          continue;
        }

        const resolvedNationalities: (string | null)[] = [];
        for (const wikidataId of wikidataIds) {
          const candidateNationality =
            await lookupWikidataNationality(wikidataId);
          resolvedNationalities.push(candidateNationality);
          console.log(
            `  Wikidata ${wikidataId}: ${candidateNationality ?? "no single valid country code"}.`,
          );
        }
        const nationality = commonNationality(resolvedNationalities);
        if (!nationality) {
          skipped++;
          console.log(
            "  Exact-name Wikidata records have missing, conflicting, or multiple nationality values.",
          );
          continue;
        }

        console.log(
          `  Exact-name Wikidata records agree on nationality: ${nationality}.`,
        );
        if (!execute) {
          console.log(`  DRY RUN: would set nationality to ${nationality}.`);
          updated++;
          continue;
        }

        await prisma.author.update({
          where: { id: author.id },
          data: {
            nationality,
            ...(!storedWikidataId && wikidataIds.length === 1
              ? { wikidataId: wikidataIds[0] }
              : {}),
          },
        });
        updated++;
        console.log(`  Set nationality: ${nationality}`);
      } catch (error) {
        failed++;
        console.error("  Lookup failed:", error);
      }

    }

    console.log(
      `\nComplete: ${updated} ${execute ? "authors updated" : "updates proposed"}, ${skipped} skipped, ${failed} failed.`,
    );
    if (failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error("Enrichment failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function findOpenLibraryWikidataIds(
  name: string,
): Promise<(string | null)[]> {
  const searchUrl = new URL("/search/authors.json", OPEN_LIBRARY_ORIGIN);
  searchUrl.search = new URLSearchParams({ q: name, limit: "20" }).toString();
  const candidates = parseOpenLibraryAuthorCandidates(
    await fetchJson(searchUrl, { fresh: true }),
  );
  const exactMatches = exactOpenLibraryAuthorMatches(candidates, name);
  if (exactMatches.length === 0) return [];
  if (exactMatches.length > 1) {
    console.log(
      `  Open Library returned ${exactMatches.length} exact-name matches; comparing their nationalities.`,
    );
  }

  return Promise.all(
    exactMatches.map(async (candidate) => {
      const authorUrl = new URL(
        `/authors/${candidate.authorId}.json`,
        OPEN_LIBRARY_ORIGIN,
      );
      return parseOpenLibraryWikidataId(
        await fetchJson(authorUrl, { fresh: true }),
        name,
      );
    }),
  );
}

async function findWikidataIdsByName(name: string): Promise<string[]> {
  const searchResults = await Promise.all(
    ["en", "es"].map(async (language) => {
      const url = new URL(WIKIDATA_API_ORIGIN);
      url.search = new URLSearchParams({
        action: "wbsearchentities",
        search: name,
        language,
        uselang: language,
        limit: "50",
        format: "json",
      }).toString();
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(
          `Wikidata ${language} name search failed with HTTP ${response.status}.`,
        );
      }
      return parseWikidataNameSearchResults(
        await response.json() as unknown,
        name,
      );
    }),
  );
  const ids = [...new Set(searchResults.flat())];
  if (ids.length > 1) {
    console.log(
      `  Wikidata returned ${ids.length} exact-name records; comparing their nationalities.`,
    );
  }
  return ids;
}

async function lookupWikidataNationality(
  wikidataId: string,
): Promise<string | null> {
  const personData = await fetchWikidataEntities(wikidataId);
  const countryIds = parseWikidataCitizenshipIds(personData, wikidataId);
  if (countryIds.length === 0) return null;

  const countryData = await fetchWikidataEntities(...countryIds);
  const countryCodes = parseWikidataCountryCodes(countryData, countryIds);
  return countryCodes.length === 1 ? countryCodes[0] : null;
}

async function fetchWikidataEntities(...ids: string[]): Promise<unknown> {
  const url = new URL(WIKIDATA_API_ORIGIN);
  url.search = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "claims",
    format: "json",
  }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Wikidata request failed with HTTP ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

main().catch((error: unknown) => {
  console.error("Author nationality enrichment failed:", error);
  process.exitCode = 1;
});
