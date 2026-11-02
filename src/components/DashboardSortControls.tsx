"use client";

import { useRouter } from "next/navigation";
import {
  type DashboardSort,
  type SortDirection,
} from "@/lib/dashboard";

const CARD_SORT_OPTIONS = [
  { value: "startDate:desc", label: "Recently started", sort: "startDate", direction: "desc" },
  { value: "startDate:asc", label: "Oldest started", sort: "startDate", direction: "asc" },
  { value: "author:asc", label: "Author A–Z", sort: "author", direction: "asc" },
  { value: "author:desc", label: "Author Z–A", sort: "author", direction: "desc" },
  { value: "title:asc", label: "Title A–Z", sort: "title", direction: "asc" },
  { value: "title:desc", label: "Title Z–A", sort: "title", direction: "desc" },
] as const;

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

  if (view === "list") return null;

  function applySort(value: string) {
    const option = CARD_SORT_OPTIONS.find((candidate) => candidate.value === value);
    if (!option) return;
    const params = new URLSearchParams({
      year: String(year),
      sort: option.sort,
      direction: option.direction,
    });
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  const selectedValue = `${sort}:${direction}`;

  return (
    <div className="flex justify-end">
      <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 text-xs font-semibold text-slate-400">
        <span className="whitespace-nowrap">Sort cards</span>
        <select
          name="card-sort"
          value={selectedValue}
          onChange={(event) => applySort(event.target.value)}
          className="min-h-10 min-w-0 max-w-48 bg-transparent text-sm text-white outline-none sm:max-w-none"
        >
          {CARD_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
