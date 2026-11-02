"use server";

import { findAuthorsWithoutNationality, updateAuthorNationalityManual, deleteOrphanAuthors, findOrphanAuthors } from "@/lib/author-nationality-service";

export type AuthorWithoutNationality = {
  id: string;
  name: string;
  wikidataId: string | null;
};

/**
 * Server Action — list authors that are still missing a nationality.
 *
 * The client page must not call Prisma directly (Prisma does not run in the
 * browser). This action runs the read on the server through the dedicated
 * service layer and returns a plain, JSON-serializable list.
 */
export async function getAuthorsWithoutNationality(): Promise<AuthorWithoutNationality[]> {
  return findAuthorsWithoutNationality();
}

/**
 * Server Action — manually assign a nationality (ISO alpha-2 code) to an author.
 */
export async function setAuthorNationality(
  authorId: string,
  nationality: string,
): Promise<{ success: boolean }> {
  return updateAuthorNationalityManual(authorId, nationality);
}

/**
 * Server Action — delete all orphan authors (authors with no books).
 */
export async function deleteOrphanAuthorsAction(): Promise<{ deleted: number }> {
  return deleteOrphanAuthors();
}

/**
 * Server Action — count orphan authors (authors with no books).
 */
export async function countOrphanAuthors(): Promise<number> {
  const orphans = await findOrphanAuthors();
  return orphans.length;
}

/**
 * Server Action — list orphan authors (authors with no books).
 */
export async function getOrphanAuthors(): Promise<{ id: string; name: string }[]> {
  return findOrphanAuthors();
}
