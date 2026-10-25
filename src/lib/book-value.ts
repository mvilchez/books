export type ValueMode = "value" | "rating" | "pages" | "ratingPerPage" | "rereads";

export type ValueBookInput = {
  rating: number | null;
  pages: number | null;
  rereadCount: number;
};

/** Composite "value" score: rewards quality, effort (pages), and rereads. */
export function computeValueScore(input: ValueBookInput): number {
  const rating = input.rating ?? 0;
  const pages = Math.max(1, input.pages ?? 0);
  const rereads = Math.max(1, input.rereadCount);
  return rating * Math.sqrt(pages) + 2 * (rereads - 1);
}

export function compareByMode(
  a: ValueBookInput & { title: string },
  b: ValueBookInput & { title: string },
  mode: ValueMode,
): number {
  if (mode === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
  if (mode === "pages") return (b.pages ?? 0) - (a.pages ?? 0);
  if (mode === "ratingPerPage") {
    const aScore = (a.rating ?? 0) / Math.max(1, a.pages ?? 1);
    const bScore = (b.rating ?? 0) / Math.max(1, b.pages ?? 1);
    return bScore - aScore;
  }
  if (mode === "rereads") return b.rereadCount - a.rereadCount;
  return computeValueScore(b) - computeValueScore(a);
}