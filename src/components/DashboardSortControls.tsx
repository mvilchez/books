"use client";

import { useRouter } from "next/navigation";
import {
  parseDashboardSort,
  parseSortDirection,
  type DashboardSort,
  type SortDirection,
} from "@/lib/dashboard";

export default function DashboardSortControls({
  year,
  view,
  sort,
  direction,
}: {
  year: number;
  view: "cards" | "list";
  sort: DashboardSort;
  direction: SortDirection;
}) {
  const router = useRouter();

  function applySort(
    nextSort: DashboardSort = sort,
    nextDirection: SortDirection = direction,
  ) {
    const params = new URLSearchParams({
      year: String(year),
      sort: nextSort,
      direction: nextDirection,
    });
    if (view === "list") params.set("view", "list");
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-4 sm:flex-row sm:items-end">
      <label className="grid w-full gap-1 text-xs font-semibold text-slate-400 sm:w-auto">
        Sort by
        <select
          name="sort"
          value={sort}
          onChange={(event) => applySort(parseDashboardSort(event.target.value))}
          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white sm:w-auto"
        >
          <option value="startDate">Start date</option>
          <option value="author">Author</option>
          <option value="title">Title</option>
        </select>
      </label>
      <label className="grid w-full gap-1 text-xs font-semibold text-slate-400 sm:w-auto">
        Direction
        <select
          name="direction"
          value={direction}
          onChange={(event) =>
            applySort(sort, parseSortDirection(event.target.value, direction))
          }
          className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white sm:w-auto"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
    </div>
  );
}
