import "dotenv/config";
import { Prisma, Author } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchJson, normalizeOpenLibraryName } from "@/lib/open-library-images";

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const limit = process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : undefined;

  try {
    const authors = await prisma.author.findMany({
      where: { nationality: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      ...(limit ? { take: limit } : {}),
    });

    const mode = execute ? "EXECUTE" : "DRY RUN";
    console.log(`${mode}: ${authors.length} authors without nationality selected.`);

    if (!execute) {
      console.log(`No requests sent and no changes made. Rerun with --execute to proceed.`);
      return;
    }

    let updated = 0;
    let skipped = 0;

    for (const [index, author] of authors.entries()) {
      console.log(`[${index + 1}/${authors.length}] Looking up nationality for ${author.name}`);

      let nationality: string | null = null;

      // Try Open Library author lookup
      try {
        const normalizedName = normalizeOpenLibraryName(author.name);
        const authorData = (await fetchJson(new URL(`/authors/${normalizedName}.json`, "https://openlibrary.org"), { fresh: true })) as Record<string, unknown>;
        if (authorData?.name && authorData?.nationality) {
          nationality = authorData.nationality as string;
          console.log(`  Found from Open Library: ${nationality}`);
        }
      } catch (error) {
        console.error(`  Open Library lookup failed:`);
      }

      // Save to database
      if (nationality) {
        const isoNationality = normalizeNationality(nationality);
        await prisma.author.update({
          where: { id: author.id },
          data: { nationality: isoNationality },
        });
        updated++;
        console.log(`  Set nationality: ${isoNationality}`);
      } else {
        skipped++;
        console.log(`  No nationality found from Open Library`);
      }

      // Rate limiting - 1 second between requests
      if (index + 1 < authors.length) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }

    console.log(`\nComplete: ${updated} authors updated, ${skipped} skipped.`);
  } catch (error) {
    console.error("Enrichment failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function normalizeNationality(country: string): string {
  const mapping: Record<string, string> = {
    "united states": "US",
    "united kingdom": "GB",
    "united states of america": "US",
    "u.s.": "US",
    "u.s.a.": "US",
    "u.k.": "GB",
    "uk": "GB",
    "france": "FR",
    "deutschland": "DE",
    "germany": "DE",
    "espania": "ES",
    "spain": "ES",
    "italia": "IT",
    "italy": "IT",
    "canada": "CA",
    "mexico": "MX",
    "brazil": "BR",
    "japan": "JP",
  };
  const lower = country.toLowerCase().trim();
  return mapping[lower] || country;
}

main().catch((error: unknown) => {
  console.error("Author nationality enrichment failed:", error);
  process.exitCode = 1;
});
