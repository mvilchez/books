/**
 * Author Nationality Service (PLAN.md — Encapsulation Validation).
 *
 * This module encapsulates all Prisma client queries related to author nationality.
 * API routes and pages must import from this module instead of using the Prisma client directly.
 */
import { prisma } from "@/lib/prisma";
import { parseWikidataId } from "@/lib/author-nationality";
import { parseWikidataNameSearchResults } from "@/lib/author-nationality";
import { commonNationality } from "@/lib/author-nationality";
import { fetchJson } from "@/lib/open-library-images";
import { parseWikidataCitizenshipIds } from "@/lib/author-nationality";
import { parseWikidataCountryCodes } from "@/lib/author-nationality";

/** Find authors without nationality */
export async function findAuthorsWithoutNationality(limit?: number): Promise<{
  id: string;
  name: string;
  wikidataId: string | null;
}[]> {
  const authors = await prisma.author.findMany({
    where: { nationality: null },
    select: { id: true, name: true, wikidataId: true },
    orderBy: { name: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  return authors.map((a) => ({
    id: a.id,
    name: a.name,
    wikidataId: a.wikidataId,
  }));
}

/** Update author nationality and wikidataId */
export async function updateAuthorNationality(
  authorId: string,
  nationality: string,
  wikidataId: string
): Promise<{ success: boolean }> {
  await prisma.author.update({
    where: { id: authorId },
    data: { nationality, wikidataId },
  });
  return { success: true };
}