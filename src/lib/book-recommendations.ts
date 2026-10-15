export type OpenLibraryRecommendation = {
  workId: string;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
};

function titleKey(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function filterUnreadOpenLibraryBooks(
  recommendations: readonly OpenLibraryRecommendation[],
  readBooks: readonly { title: string; workId: string | null }[],
  sourceBook: { title: string; workId: string | null },
): OpenLibraryRecommendation[] {
  const excludedTitles = new Set(
    [...readBooks.map(({ title }) => title), sourceBook.title]
      .map(titleKey)
      .filter(Boolean),
  );
  const excludedWorkIds = new Set(
    [...readBooks, sourceBook]
      .map(({ workId }) => workId)
      .filter((workId): workId is string => workId !== null),
  );
  const seenTitles = new Set<string>();
  const unread: OpenLibraryRecommendation[] = [];

  for (const recommendation of recommendations) {
    const key = titleKey(recommendation.title);
    if (
      !key ||
      excludedTitles.has(key) ||
      excludedWorkIds.has(recommendation.workId) ||
      seenTitles.has(key)
    ) {
      continue;
    }
    seenTitles.add(key);
    unread.push(recommendation);
    if (unread.length === 5) break;
  }

  return unread;
}
