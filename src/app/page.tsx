import Link from "next/link";
import { Suspense } from "react";
import {
  getAvailableReadingYears,
  getBooksByReadingYear,
  type DashboardBook,
} from "@/lib/books";
import { getUsedTags } from "@/lib/tags";
import BookCard from "@/components/BookCard";
import BookCover from "@/components/BookCover";
import CompleteBookForm from "@/components/CompleteBookForm";
import BookSearch from "@/components/BookSearch";
import DashboardShell from "@/components/DashboardShell";
import DashboardSortControls from "@/components/DashboardSortControls";
import DeleteBookButton from "@/components/DeleteBookButton";
import AuthorPortrait from "@/components/AuthorPortrait";
import TagCloud from "@/components/TagCloud";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GridIcon,
  ListIcon,
} from "@/components/icons";
import { getYearKpis } from "@/lib/analytics";
import { getBookStatusPresentation } from "@/lib/book-status-presentation";
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
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            ← Previous
          </Link>
          <h2 className="text-xl font-bold text-white">
            {year === 2007 ? "Pre-2008" : year}
          </h2>
          <Link
            href={dashboardHref({ selectedYear: year + 1 })}
            aria-label={`Next year: ${year + 1}`}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Next →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {years.map((availableYear) => (
            <Link
              key={availableYear}
              href={dashboardHref({ selectedYear: availableYear })}
              aria-current={availableYear === year ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                availableYear === year
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white"
              }`}
            >
              {availableYear === 2007 ? "pre-2008" : availableYear}
            </Link>
          ))}
        </div>
      </nav>
      <TagCloud tags={tags} />
      <section
        aria-label={`${year} reading statistics`}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
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
        <BookList books={pageBooks} year={year} />
      ) : (
        <BookGrid books={pageBooks} year={year} />
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

function BookPagination({
  bookCount,
  page,
  pageCount,
  hrefForPage,
}: {
  bookCount: number;
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
}) {
  const firstBook = (page - 1) * DASHBOARD_PAGE_SIZE + 1;
  const lastBook = Math.min(page * DASHBOARD_PAGE_SIZE, bookCount);

  return (
    <nav
      aria-label="Book pages"
      className="flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-slate-400">
        Showing {firstBook}–{lastBook} of {bookCount} books
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={hrefForPage(page - 1)}
            prefetch={false}
            rel="prev"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-white"
          >
            <ChevronLeftIcon />
            Previous
          </Link>
        ) : null}
        <span aria-current="page" className="px-2 text-slate-300">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link
            href={hrefForPage(page + 1)}
            prefetch={false}
            rel="next"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-white"
          >
            <ChevronRightIcon />
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function BookList({
  books,
  year,
}: {
  books: DashboardBook[];
  year: number;
}) {
  if (books.length === 0) {
    return <EmptyBooks year={year} />;
  }

  const formatDate = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)
      : "—";

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/60">
      <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
        <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3">Book</th>
            <th scope="col" className="px-4 py-3">Author</th>
            <th scope="col" className="px-4 py-3">Started</th>
            <th scope="col" className="px-4 py-3">Finished</th>
            <th scope="col" className="px-4 py-3">Genre</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3 text-right">Pages</th>
            <th scope="col" className="px-4 py-3 text-right">Published</th>
            <th scope="col" className="px-4 py-3">Origin</th>
            <th scope="col" className="px-4 py-3 text-right">Rating</th>
            <th scope="col" className="px-4 py-3">Complete</th>
            <th scope="col" className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
          {books.map((book) => (
            <tr
              key={book.id}
              className={`text-slate-300 transition ${getBookStatusPresentation(book.status).row}`}
            >
              <th scope="row" className="px-4 py-3 font-semibold text-white">
                  <div className="flex items-center gap-3">
                    <BookCover
                      editionKey={book.editionKey}
                      openLibraryCoverId={book.openLibraryCoverId}
                      title={book.title}
                    />
                    <Link
                      href={`/books/${book.id}`}
                      className="hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
                    >
                      {book.title}
                    </Link>
                  </div>
              </th>
              <td className="px-4 py-3">
                <AuthorPortrait author={book.author} />
              </td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(book.startDate)}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(book.finishDate)}</td>
              <td className="px-4 py-3">{book.genre?.name ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getBookStatusPresentation(book.status).badge}`}
                >
                  {getBookStatusPresentation(book.status).label}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {book.totalPages?.toLocaleString("es-ES") ?? "—"}
              </td>
              <td className="px-4 py-3 text-right">{book.publicationYear ?? "—"}</td>
              <td className="px-4 py-3">{book.origin ?? "—"}</td>
              <td className="px-4 py-3 text-right">
                {book.rating === null ? "—" : `${book.rating}/10`}
              </td>
              <td className="px-4 py-3">
                {book.status === "READING" ? (
                  <CompleteBookForm
                    bookId={book.id}
                    title={book.title}
                    compact
                  />
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                <DeleteBookButton
                  bookId={book.id}
                  title={book.title}
                  returnTo="refresh"
                  compact
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BookGrid({
  books,
  year,
}: {
  books: DashboardBook[];
  year: number;
}) {
  if (books.length === 0) {
    return <EmptyBooks year={year} />;
  }

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} returnTo="refresh" />
      ))}
    </section>
  );
}

function EmptyBooks({ year }: { year: number }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
      <p className="font-semibold text-slate-300">No books for this year yet</p>
      <p className="mt-1 text-sm text-slate-500">
        There are no books recorded for {year}. Select another year or upload the
        legacy workbook with “Import workbook”.
      </p>
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

function BookGridSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <section
        aria-label="Loading yearly reading statistics"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-800" />
        ))}
      </section>
      <section
        aria-label="Loading books"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl bg-slate-800 border border-slate-700/60"
          />
        ))}
      </section>
    </div>
  );
}
