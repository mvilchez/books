"use server";

import { findAuthorsWithoutNationality } from "@/lib/author-nationality-service";

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
