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
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
      <label className="grid gap-1 text-xs font-semibold text-slate-400">
        Sort by
        <select
          name="sort"
          value={sort}
          onChange={(event) => applySort(parseDashboardSort(event.target.value))}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="startDate">Start date</option>
          <option value="author">Author</option>
          <option value="title">Title</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-slate-400">
        Direction
        <select
          name="direction"
          value={direction}
          onChange={(event) =>
            applySort(sort, parseSortDirection(event.target.value, direction))
          }
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
    </div>
  );
}
