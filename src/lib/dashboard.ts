export const DASHBOARD_SORTS = ["startDate", "author", "title"] as const;
export const DASHBOARD_PAGE_SIZE = 12;
export type DashboardSort = (typeof DASHBOARD_SORTS)[number];
export type SortDirection = "asc" | "desc";

export type DashboardSortableBook = {
  id: string;
  title: string;
  startDate: Date | null;
  author: { name: string };
};

const collator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

export function parseDashboardSort(value: string | string[] | undefined): DashboardSort {
  return typeof value === "string"
    ? (DASHBOARD_SORTS.find((sort) => sort === value) ?? "startDate")
    : "startDate";
}

export function parseSortDirection(
  value: string | string[] | undefined,
  fallback: SortDirection = "asc",
): SortDirection {
  return value === "desc" || value === "asc" ? value : fallback;
}

export function parseDashboardPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function compareStable(a: DashboardSortableBook, b: DashboardSortableBook): number {
  return (
    collator.compare(a.title, b.title) ||
    collator.compare(a.author.name, b.author.name) ||
    a.id.localeCompare(b.id)
  );
}

export function sortDashboardBooks<T extends DashboardSortableBook>(
  books: readonly T[],
  sort: DashboardSort,
  direction: SortDirection,
): T[] {
  return [...books].sort((a, b) => {
    if (sort === "startDate") {
      if (a.startDate === null && b.startDate !== null) return 1;
      if (a.startDate !== null && b.startDate === null) return -1;
      if (a.startDate && b.startDate) {
        const difference = a.startDate.getTime() - b.startDate.getTime();
        if (difference !== 0) return direction === "asc" ? difference : -difference;
      }
    } else {
      const primary =
        sort === "author"
          ? collator.compare(a.author.name, b.author.name)
          : collator.compare(a.title, b.title);
      if (primary !== 0) return direction === "asc" ? primary : -primary;
    }

    return compareStable(a, b);
  });
}
