import Link from "next/link";
import { Suspense } from "react";
import {
  getAvailableReadingYears,
  getBooksByReadingYear,
} from "@/lib/books";
import { getUsedTags } from "@/lib/tags";
import BookSearch from "@/components/BookSearch";
import DashboardShell from "@/components/DashboardShell";
import DashboardSortControls from "@/components/DashboardSortControls";
import TagCloud from "@/components/TagCloud";
import DisclosurePanel from "@/components/DisclosurePanel";
import { GridIcon, ListIcon } from "@/components/icons";
import {
  BookGridSkeleton,
  BookPagination,
  DashboardBookGrid,
  DashboardBookList,
} from "@/components/dashboard/DashboardBookViews";
import { getYearKpis } from "@/lib/analytics";
import { PRE_TAB_READING_YEAR_SENTINEL } from "@/lib/ingestion/workbook-parser";
import {
  DASHBOARD_PAGE_SIZE,
  parseDashboardPage,
  parseDashboardSort,
  parseSortDirection,
  sortDashboardBooks,
  type DashboardSort,
  type SortDirection,
} from "@/lib/dashboard";

type DashboardSearchParams = PageProps<"/">["searchParams"];

type DashboardView = "cards" | "list";

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <DashboardShell
      title="Books Tracker Workspace"
      subtitle="Replacing legacy spreadsheets with clean engineering metrics."
      search={<BookSearch />}
      userName="marino"
    >
      {/*
        cacheComponents (next.config.ts): the uncached Prisma read must sit
        behind <Suspense>, otherwise the prerender reports a blocking route.
        The shell header stays in the static shell and streams the grid.
      */}
      <Suspense fallback={<BookGridSkeleton />}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </DashboardShell>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: DashboardSearchParams;
}) {
  const {
    year: rawYear,
    view: rawView,
    sort: rawSort,
    direction: rawDirection,
    page: rawPage,
  } = await searchParams;
  const requestedYear = typeof rawYear === "string" ? Number(rawYear) : NaN;
  const requestedYearIsValid =
    Number.isInteger(requestedYear) && requestedYear >= 1 && requestedYear <= 9999;
  const view: DashboardView = rawView === "list" ? "list" : "cards";
  const sort = parseDashboardSort(rawSort);
  const requestedPage = parseDashboardPage(rawPage);
  const hasExplicitDirection = rawDirection === "asc" || rawDirection === "desc";
  const direction = parseSortDirection(
    rawDirection,
    view === "list" ? "asc" : "desc",
  );

  const availableYears = await getAvailableReadingYears();
  const latestYear = availableYears.at(-1)?.readingYear;
  const year = requestedYearIsValid
    ? requestedYear
    : (latestYear ?? PRE_TAB_READING_YEAR_SENTINEL);
  const [unsortedBooks, kpis, storedTags] = await Promise.all([
    getBooksByReadingYear(year),
    getYearKpis(year),
    getUsedTags(),
  ]);
  const tags = [...storedTags].sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name),
  );
  const books = sortDashboardBooks(unsortedBooks, sort, direction);
  const pageCount = Math.max(1, Math.ceil(books.length / DASHBOARD_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const pageBooks = books.slice(
    (page - 1) * DASHBOARD_PAGE_SIZE,
    page * DASHBOARD_PAGE_SIZE,
  );
  const years = Array.from(
    new Set([...availableYears.map(({ readingYear }) => readingYear), year]),
  ).sort((a, b) => a - b);
  const dashboardHref = ({
    selectedYear = year,
    selectedView = view,
    selectedSort = sort,
    selectedDirection = direction,
    selectedPage,
  }: {
    selectedYear?: number;
    selectedView?: DashboardView;
    selectedSort?: DashboardSort;
    selectedDirection?: SortDirection;
    selectedPage?: number;
  } = {}) => {
    const params = new URLSearchParams({
      year: String(selectedYear),
      sort: selectedSort,
      direction: selectedDirection,
    });
    if (selectedView === "list") params.set("view", "list");
    if (selectedPage && selectedPage > 1) {
      params.set("page", String(selectedPage));
    }
    return `/?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Reading year" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={dashboardHref({ selectedYear: year - 1 })}
            aria-label={`Previous year: ${year - 1}`}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            ← Previous
          </Link>
          <h2 className="text-xl font-bold text-white">
            {year === 2007 ? "Pre-2008" : year}
          </h2>
          <Link
            href={dashboardHref({ selectedYear: year + 1 })}
            aria-label={`Next year: ${year + 1}`}
            className="inline-flex min-h-11 items-center rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Next →
          </Link>
        </div>
        <DisclosurePanel
          title="Choose reading year"
          summary={`${years.length} available · ${year === 2007 ? "pre-2008" : year} selected`}
        >
          <div className="flex flex-wrap gap-2">
            {years.map((availableYear) => (
              <Link
                key={availableYear}
                href={dashboardHref({ selectedYear: availableYear })}
                aria-current={availableYear === year ? "page" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm font-semibold transition ${
                  availableYear === year
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
                }`}
              >
                {availableYear === 2007 ? "pre-2008" : availableYear}
              </Link>
            ))}
          </div>
        </DisclosurePanel>
      </nav>
      <TagCloud tags={tags} />
      <DisclosurePanel
        title={`${year === 2007 ? "Pre-2008" : year} reading stats`}
        summary={`${kpis.booksCompleted.toLocaleString("es-ES")} finished · ${kpis.pagesRead.toLocaleString("es-ES")} pages`}
      >
        <section
          aria-label={`${year} reading statistics`}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          <YearStat label="Finished" value={kpis.booksCompleted.toLocaleString("es-ES")} />
          <YearStat label="Pages read" value={kpis.pagesRead.toLocaleString("es-ES")} />
          <YearStat label="Reading now" value={kpis.activeReads.toLocaleString("es-ES")} />
          <YearStat
            label="Average rating"
            value={kpis.avgRating === null ? "—" : `${kpis.avgRating.toFixed(1)} / 10`}
          />
          <YearStat label="Pages per book" value={kpis.avgPagesPerBook.toLocaleString("es-ES")} />
        </section>
      </DisclosurePanel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">Books</h3>
        <nav
          aria-label="Book display"
          className="inline-flex rounded-lg border border-slate-700 bg-slate-800 p-1"
        >
          {(["cards", "list"] as const).map((option) => (
            <Link
              key={option}
              href={dashboardHref({
                selectedView: option,
                selectedDirection: hasExplicitDirection
                  ? direction
                  : option === "list"
                    ? "asc"
                    : "desc",
              })}
              aria-current={view === option ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                view === option
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {option === "cards" ? <GridIcon /> : <ListIcon />}
              {option === "cards" ? "Cards" : "List"}
            </Link>
          ))}
        </nav>
      </div>
      <DashboardSortControls
        year={year}
        view={view}
        sort={sort}
        direction={direction}
      />
      {books.length > DASHBOARD_PAGE_SIZE ? (
        <BookPagination
          bookCount={books.length}
          page={page}
          pageCount={pageCount}
          hrefForPage={(selectedPage) =>
            dashboardHref({ selectedPage })
          }
        />
      ) : null}
      {view === "list" ? (
        <DashboardBookList
          books={pageBooks}
          year={year}
          sort={sort}
          direction={direction}
        />
      ) : (
        <DashboardBookGrid books={pageBooks} year={year} />
      )}
      {books.length > DASHBOARD_PAGE_SIZE ? (
        <BookPagination
          bookCount={books.length}
          page={page}
          pageCount={pageCount}
          hrefForPage={(selectedPage) =>
            dashboardHref({ selectedPage })
          }
        />
      ) : null}
    </div>
  );
}

function YearStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-white">
        {value.toLocaleString("es-ES")}
      </p>
    </div>
  );
}
