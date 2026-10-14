import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma"; // Step 2.3 singleton — never `new PrismaClient()` in app code
import BookCard from "@/components/BookCard";
import IngestionWidget from "@/components/IngestionWidget";
import type { Prisma } from "@prisma/client";

type DashboardSearchParams = PageProps<"/">["searchParams"];

export default function DashboardPage(props: PageProps<"/">) {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Books Tracker Workspace
          </h1>
          <p className="text-slate-400 mt-1">
            Replacing legacy spreadsheets with clean engineering metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/stats"
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            Statistics &amp; graphs
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
  const { year: rawYear } = await searchParams;
  const currentYear = new Date().getFullYear();
  const requestedYear = typeof rawYear === "string" ? Number(rawYear) : NaN;
  const year =
    Number.isInteger(requestedYear) && requestedYear >= 1 && requestedYear <= 9999
      ? requestedYear
      : currentYear;

  const [availableYears, books] = await Promise.all([
    prisma.book.findMany({
      select: { readingYear: true },
      distinct: ["readingYear"],
      orderBy: { readingYear: "asc" },
    }),
    prisma.book.findMany({
      where: { readingYear: year },
      include: { author: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const years = Array.from(
    new Set([...availableYears.map(({ readingYear }) => readingYear), currentYear]),
  ).sort((a, b) => a - b);

  return (
    <div className="space-y-6">
      <nav aria-label="Reading year" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/?year=${year - 1}`}
            aria-label={`Previous year: ${year - 1}`}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-emerald-500/50 hover:text-white"
          >
            ← Previous
          </Link>
          <h2 className="text-xl font-bold text-white">
            {year === 2007 ? "Pre-2008" : year}
          </h2>
          <Link
            href={`/?year=${year + 1}`}
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
              href={`/?year=${availableYear}`}
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
      <BookGrid books={books} year={year} />
    </div>
  );
}

type DashboardBook = Prisma.BookGetPayload<{ include: { author: true } }>[];

function BookGrid({ books, year }: { books: DashboardBook; year: number }) {
  if (books.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
        <p className="text-slate-300 font-semibold">No books for this year yet</p>
        <p className="text-slate-500 text-sm mt-1">
          There are no books recorded for {year}. Select another year or upload the
          legacy workbook with “Import workbook”.
        </p>
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </section>
  );
}

function BookGridSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading books"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse"
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-48 rounded-xl bg-slate-800 border border-slate-700/60"
        />
      ))}
    </section>
  );
}
