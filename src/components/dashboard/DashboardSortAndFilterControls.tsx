"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  DashboardFilter,
  DashboardSort,
  SortDirection,
} from "@/lib/dashboard";

const FILTER_OPTIONS: { value: DashboardFilter; label: string }[] = [
  { value: "READING", label: "Reading" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ALL", label: "All" },
];

const CARD_SORT_OPTIONS = [
  { value: "startDate:desc", label: "Recently started", sort: "startDate", direction: "desc" },
  { value: "startDate:asc", label: "Oldest started", sort: "startDate", direction: "asc" },
  { value: "author:asc", label: "Author A–Z", sort: "author", direction: "asc" },
  { value: "author:desc", label: "Author Z–A", sort: "author", direction: "desc" },
  { value: "title:asc", label: "Title A–Z", sort: "title", direction: "asc" },
  { value: "title:desc", label: "Title Z–A", sort: "title", direction: "desc" },
] as const;

export type DashboardSortAndFilterControlsProps = {
  year: number;
  view: "cards" | "list";
  sort: DashboardSort;
  direction: SortDirection;
  filter: DashboardFilter;
};

export default function DashboardSortAndFilterControls({
  year,
  view,
  sort,
  direction,
  filter,
}: DashboardSortAndFilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function applyFilter(value: string) {
    const selected = FILTER_OPTIONS.find((option) => option.value === value);
    if (!selected) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("sort", sort);
    params.set("direction", direction);
    params.set("filter", selected.value);
    params.delete("page");
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  function applySort(value: string) {
    const option = CARD_SORT_OPTIONS.find(
      (candidate) => candidate.value === value,
    );
    if (!option) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    params.set("sort", option.sort);
    params.set("direction", option.direction);
    params.set("filter", filter);
    params.delete("page");
    router.push(`/?${params.toString()}`, { scroll: false });
  }

  const selectedSortValue = `${sort}:${direction}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label
        className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 text-xs font-semibold text-slate-400"
      >
        <span className="whitespace-nowrap">Filter by status</span>
        <select
          name="status-filter"
          value={filter}
          onChange={(event) => applyFilter(event.target.value)}
          className="min-h-10 min-w-0 max-w-48 bg-transparent text-sm text-white outline-none sm:max-w-none"
        >
          {FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {view === "cards" && (
        <label
          className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 text-xs font-semibold text-slate-400"
        >
          <span className="whitespace-nowrap">Sort cards</span>
          <select
            name="card-sort"
            value={selectedSortValue}
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
      )}
    </div>
  );
}
