"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Server Action — advance a book's reading progress (PLAN.md Step 3.2).
 *
 * Server Actions are reachable via direct POST requests, not just through the
 * UI (Next.js "Mutating Data" docs), so every argument is validated here and
 * the final value is clamped against the persisted `totalPages` — a tampered
 * payload can never write negative or out-of-range page counts.
 *
 * `totalPages` is nullable for pre-2014 rows: an unknown ceiling only clamps
 * at the lower bound of 0.
 */
export async function updateBookProgress(
  bookId: string,
  nextPages: number,
): Promise<void> {
  if (typeof bookId !== "string" || bookId.length === 0) {
    throw new Error("updateBookProgress: invalid book id.");
  }
  if (typeof nextPages !== "number" || !Number.isFinite(nextPages)) {
    throw new Error("updateBookProgress: nextPages must be a finite number.");
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { totalPages: true },
  });
  if (!book) {
    throw new Error(`updateBookProgress: book ${bookId} not found.`);
  }

  const rounded = Math.round(nextPages);
  const ceiling = book.totalPages ?? Number.MAX_SAFE_INTEGER;
  const currentPages = Math.min(Math.max(rounded, 0), ceiling);

  await prisma.book.update({
    where: { id: bookId },
    data: { currentPages },
  });

  // The dashboard is an uncached Server Component tree — revalidate so the
  // incremented progress bar is visible on the very next render.
  revalidatePath("/");
}
