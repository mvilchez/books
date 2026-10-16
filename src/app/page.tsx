import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma"; // Step 2.3 singleton — never `new PrismaClient()` in app code
import BookCard from "@/components/BookCard";
import BookCover from "@/components/BookCover";
import CompleteBookForm from "@/components/CompleteBookForm";
import BookSearch from "@/components/BookSearch";
import DashboardSortControls from "@/components/DashboardSortControls";
import DeleteBookButton from "@/components/DeleteBookButton";
import AuthorPortrait from "@/components/AuthorPortrait";
import IngestionWidget from "@/components/IngestionWidget";
import TagCloud from "@/components/TagCloud";
import { getYearKpis } from "@/lib/analytics";
import { getBookStatusPresentation } from "@/lib/book-status-presentation";
import { PRE_TAB_READING_YEAR_SENTINEL } from "@/lib/ingestion/workbook-parser";
import {
  parseDashboardSort,
  parseSortDirection,
  sortDashboardBooks,
  type DashboardSort,
  type SortDirection,
} from "@/lib/dashboard";
import type { Prisma } from "@prisma/client";

type DashboardSearchParams = PageProps<"/">["searchParams"];

type DashboardView = "cards" | "list";

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Books Tracker Workspace
          </h1>
          <p className="text-slate-400 mt-1">
            Replacing legacy spreadsheets with clean engineering metrics.
          </p>
        </div>
        <BookSearch />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/books/new"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
          >
            Start a book
          </Link>
          <Link
            href="/stats"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Statistics &amp; graphs
          </Link>
          <Link
            href="/reports/open-library-tags"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Open Library tag report
          </Link>
          <Link
            href="/tags/manage"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Review similar tags
          </Link>
          <IngestionWidget />
        </div>
      </header>

      {/*
        cacheComponents (next.config.ts): the uncached Prisma read must sit
        behind <Suspense>, otherwise the prerender reports a blocking route.
        The header above stays in the static shell and streams the grid.
      */}
      <Suspense fallback={<BookGridSkeleton />}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </main>
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
  } = await searchParams;
  const requestedYear = typeof rawYear === "string" ? Number(rawYear) : NaN;
  const requestedYearIsValid =
    Number.isInteger(requestedYear) && requestedYear >= 1 && requestedYear <= 9999;
  const view: DashboardView = rawView === "list" ? "list" : "cards";
  const sort = parseDashboardSort(rawSort);
  const hasExplicitDirection = rawDirection === "asc" || rawDirection === "desc";
  const direction = parseSortDirection(
    rawDirection,
    view === "list" ? "asc" : "desc",
  );

  const availableYears = await prisma.book.findMany({
    select: { readingYear: true },
    distinct: ["readingYear"],
    orderBy: { readingYear: "asc" },
  });
  const latestYear = availableYears.at(-1)?.readingYear;
  const year = requestedYearIsValid
    ? requestedYear
    : (latestYear ?? PRE_TAB_READING_YEAR_SENTINEL);
  const [unsortedBooks, kpis, storedTags] = await Promise.all([
    prisma.book.findMany({
      where: { readingYear: year },
      include: { author: true, genre: true },
    }),
    getYearKpis(year),
    prisma.tag.findMany({
      where: { books: { some: {} } },
      select: {
        id: true,
        name: true,
        category: true,
        books: { select: { bookId: true } },
      },
    }),
  ]);
  const tags = storedTags
    .map(({ books, ...tag }) => ({
      ...tag,
      count: new Set(books.map(({ bookId }) => bookId)).size,
    }))
    .filter((tag) => tag.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const books = sortDashboardBooks(unsortedBooks, sort, direction);
  const years = Array.from(
    new Set([...availableYears.map(({ readingYear }) => readingYear), year]),
  ).sort((a, b) => a - b);
  const dashboardHref = ({
    selectedYear = year,
    selectedView = view,
    selectedSort = sort,
    selectedDirection = direction,
  }: {
    selectedYear?: number;
    selectedView?: DashboardView;
    selectedSort?: DashboardSort;
    selectedDirection?: SortDirection;
  } = {}) => {
    const params = new URLSearchParams({
      year: String(selectedYear),
      sort: selectedSort,
      direction: selectedDirection,
    });
    if (selectedView === "list") params.set("view", "list");
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
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                view === option
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
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
      {view === "list" ? (
        <BookList books={books} year={year} />
      ) : (
        <BookGrid books={books} year={year} />
      )}
    </div>
  );
}

type DashboardBook = Prisma.BookGetPayload<{
  include: { author: true; genre: true };
}>[];

function BookList({
  books,
  year,
}: {
  books: DashboardBook;
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
  books: DashboardBook;
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
