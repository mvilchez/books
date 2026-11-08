import Link from "next/link";
import BookCard from "@/components/BookCard";
import BookCover from "@/components/BookCover";
import CompleteBookForm from "@/components/CompleteBookForm";
import DeleteBookButton from "@/components/DeleteBookButton";
import AuthorPortrait from "@/components/AuthorPortrait";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { getBookStatusPresentation } from "@/lib/book-status-presentation";
import type { DashboardBook } from "@/lib/books";
import {
  DASHBOARD_PAGE_SIZE,
  type DashboardSort,
  type SortDirection,
} from "@/lib/dashboard";

export function BookPagination({
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

export function DashboardBookList({
  books,
  year,
  sort,
  direction,
}: {
  books: DashboardBook[];
  year: number;
  sort: DashboardSort;
  direction: SortDirection;
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

  const sortHref = (nextSort: DashboardSort) => {
    const nextDirection =
      sort === nextSort && direction === "asc" ? "desc" : "asc";
    const params = new URLSearchParams({
      year: String(year),
      view: "list",
      sort: nextSort,
      direction: nextDirection,
    });
    return `/?${params.toString()}`;
  };

  const sortIndicator = (column: DashboardSort) =>
    sort === column ? (direction === "asc" ? "↑" : "↓") : null;
  const titleIndicator = sortIndicator("title");
  const authorIndicator = sortIndicator("author");
  const startDateIndicator = sortIndicator("startDate");

  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-700/60">
      <table className="min-w-[64rem] divide-y divide-slate-700 text-left text-xs">
        <thead className="sticky top-0 bg-slate-800 text-[0.65rem] uppercase tracking-wide text-slate-400">
          <tr>
            <th
              scope="col"
              aria-sort={
                sort === "title"
                  ? direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="whitespace-nowrap px-2 py-2"
            >
              <Link
                href={sortHref("title")}
                aria-label={`Sort by title${titleIndicator ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
                className="inline-flex items-center gap-1 hover:text-white"
              >
                Book{" "}
                {titleIndicator ? (
                  <span aria-hidden="true">{titleIndicator}</span>
                ) : null}
              </Link>
            </th>
            <th
              scope="col"
              aria-sort={
                sort === "author"
                  ? direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="whitespace-nowrap px-2 py-2"
            >
              <Link
                href={sortHref("author")}
                aria-label={`Sort by author${authorIndicator ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
                className="inline-flex items-center gap-1 hover:text-white"
              >
                Author{" "}
                {authorIndicator ? (
                  <span aria-hidden="true">{authorIndicator}</span>
                ) : null}
              </Link>
            </th>
            <th
              scope="col"
              aria-sort={
                sort === "startDate"
                  ? direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none"
              }
              className="whitespace-nowrap px-2 py-2"
            >
              <Link
                href={sortHref("startDate")}
                aria-label={`Sort by start date${startDateIndicator ? `, ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
                className="inline-flex items-center gap-1 hover:text-white"
              >
                Started{" "}
                {startDateIndicator ? (
                  <span aria-hidden="true">{startDateIndicator}</span>
                ) : null}
              </Link>
            </th>
            <th scope="col" className="whitespace-nowrap px-2 py-2">
              Finished
            </th>
            <th scope="col" className="whitespace-nowrap px-2 py-2">
              Genre
            </th>
            <th scope="col" className="whitespace-nowrap px-2 py-2">
              Status
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-2 text-right"
            >
              Pages
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-2 text-right"
            >
              Published
            </th>
            <th scope="col" className="whitespace-nowrap px-2 py-2">
              Origin
            </th>
            <th
              scope="col"
              className="whitespace-nowrap px-2 py-2 text-right"
            >
              Rating
            </th>
            <th scope="col" className="whitespace-nowrap px-2 py-2">
              Complete
            </th>
            <th scope="col" className="whitespace-nowrap px-2 py-2">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/60">
          {books.map((book) => (
            <tr
              key={book.id}
              className={`text-slate-300 transition ${getBookStatusPresentation(book.status).row}`}
            >
              <th
                scope="row"
                className="max-w-64 px-2 py-2 font-semibold text-white"
              >
                <div className="flex items-center gap-2">
                  <BookCover
                    editionKey={book.editionKey}
                    openLibraryCoverId={book.openLibraryCoverId}
                    title={book.title}
                  />
                  <Link
                    href={`/books/${book.id}`}
                    className="line-clamp-2 text-xs leading-4 hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-400"
                  >
                    {book.title}
                  </Link>
                </div>
              </th>
              <td className="whitespace-nowrap px-2 py-2">
                <AuthorPortrait author={book.author} />
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                {formatDate(book.startDate)}
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                {formatDate(book.finishDate)}
              </td>
              <td className="max-w-32 truncate px-2 py-2">
                {book.genre?.name ?? "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getBookStatusPresentation(book.status).badge}`}
                >
                  {getBookStatusPresentation(book.status).label}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                {book.totalPages?.toLocaleString("es-ES") ?? "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                {book.publicationYear ?? "—"}
              </td>
              <td className="max-w-28 truncate px-2 py-2">
                {book.origin ?? "—"}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                {book.rating === null ? "—" : `${book.rating}/10`}
              </td>
              <td className="px-2 py-2">
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
              <td className="px-2 py-2">
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

export function DashboardBookGrid({
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
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        There are no books recorded for {year}. Select another year or upload
        the legacy workbook with “Import workbook”.
      </p>
    </div>
  );
}

export function BookGridSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true">
      <section
        aria-label="Loading yearly reading statistics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-800" />
        ))}
      </section>
      <section
        aria-label="Loading books"
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl border border-slate-700/60 bg-slate-800"
          />
        ))}
      </section>
    </div>
  );
}
