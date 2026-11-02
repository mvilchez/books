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

/** Manually assign a nationality to an author (no wikidataId required). */
export async function updateAuthorNationalityManual(
  authorId: string,
  nationality: string
): Promise<{ success: boolean }> {
  await prisma.author.update({
    where: { id: authorId },
    data: { nationality },
  });
  return { success: true };
}

/** Find authors that have no books (orphans). */
export async function findOrphanAuthors(): Promise<{ id: string; name: string }[]> {
  const authors = await prisma.author.findMany({
    where: { books: { none: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return authors;
}

/** Delete all orphan authors (authors with no books). Returns the count deleted. */
export async function deleteOrphanAuthors(): Promise<{ deleted: number }> {
  const orphans = await findOrphanAuthors();
  if (orphans.length === 0) return { deleted: 0 };
  const result = await prisma.author.deleteMany({
    where: { id: { in: orphans.map((a) => a.id) } },
  });
  return { deleted: result.count };
}