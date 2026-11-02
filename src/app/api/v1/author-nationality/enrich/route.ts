import { findAuthorsWithoutNationality, updateAuthorNationality } from "@/lib/author-nationality-service";
import { parseWikidataId, parseWikidataCitizenshipIds, parseWikidataCountryCodes } from "@/lib/author-nationality";
import { parseWikidataNameSearchResults } from "@/lib/author-nationality";
import { commonNationality } from "@/lib/author-nationality";
import { fetchJson } from "@/lib/open-library-images";
import { setProgress, resetProgress } from "@/lib/enrichment-progress";

export async function POST(request: Request) {
  try {
    const { execute, limit } = await request.json();

    // Find authors without nationality using the service layer
    const authors = await findAuthorsWithoutNationality(
      limit ? Number(limit) : 500
    );

    if (authors.length === 0) {
      return new Response(
        JSON.stringify({ message: "No authors without nationality to enrich." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    resetProgress();
    setProgress({ total: authors.length, processed: 0, updated: 0, skipped: 0, failed: 0, status: "running" });

    for (let i = 0; i < authors.length; i++) {
      const author = authors[i];

      // Rate limiting: pause between requests
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      try {
        let wikidataIds: string[];

        if (author.wikidataId) {
          // Use stored wikidataId
          wikidataIds = [author.wikidataId];
        } else {
          // Search Wikidata by name (English and Spanish)
          const nameSearchResults = await Promise.all(["en", "es"].map(async (language) => {
            const url = new URL("https://www.wikidata.org/w/api.php");
            url.search = new URLSearchParams({
              action: "wbsearchentities",
              search: author.name,
              language,
              uselang: language,
              limit: "50",
              format: "json",
            }).toString();

            const response = await fetch(url, {
              headers: {
                Accept: "application/json",
                "User-Agent": "BooksTracker/1.0 (https://github.com/mvilchez/books)",
              },
              signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
              throw new Error(
                `Wikidata ${language} name search failed with HTTP ${response.status}.`
              );
            }

            const data = await response.json();
            return parseWikidataNameSearchResults(data, author.name);
          }));

          const allIds = nameSearchResults.flat();
          wikidataIds = [...new Set(allIds)];
          // If multiple candidates, keep only the first one for simplicity
          if (wikidataIds.length > 1) {
            wikidataIds = [wikidataIds[0]];
          }
        }

        if (wikidataIds.length === 0) {
          skipped++;
          continue;
        }

        const wikidataIdToUse = wikidataIds[0];

        // Look up nationality from Wikidata
        const personData = await fetchJson(
          new URL(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataIdToUse}&props=claims&format=json`),
          { fresh: true }
        );
        const countryIds = parseWikidataCitizenshipIds(personData, wikidataIdToUse);

        if (countryIds.length === 0) {
          skipped++;
          continue;
        }

        const countryData = await fetchJson(
          new URL(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${countryIds.join(
            "|"
          )}&props=claims&format=json`),
          { fresh: true }
        );
        const countryCodes = parseWikidataCountryCodes(countryData, countryIds);

        // If we have exactly one valid country code, use it
        // If multiple or none, skip
        if (countryCodes.length !== 1) {
          skipped++;
          continue;
        }

        const nationality = countryCodes[0];

        // Update the author using the service layer
        await updateAuthorNationality(author.id, nationality, wikidataIdToUse);

        updated++;
      } catch (error) {
        failed++;
        console.error(`Error enriching author ${author.name}:`, error);
      }

      setProgress({
        total: authors.length,
        processed: i + 1,
        updated,
        skipped,
        failed,
        status: "running",
      });
    }

    const message = `
      Enrichment complete.
      Updated: ${updated}
      Skipped: ${skipped}
      Failed: ${failed}
    `;

    return new Response(
      JSON.stringify({ message, updated, skipped, failed }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Author nationality enrichment API error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}