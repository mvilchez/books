import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma"; // Step 2.3 singleton — never `new PrismaClient()` in app code
import BookCard from "@/components/BookCard";
import IngestionWidget from "@/components/IngestionWidget";

export default function DashboardPage() {
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
        <BookGrid />
      </Suspense>
    </main>
  );
}

async function BookGrid() {
  const books = await prisma.book.findMany({
    include: { author: true },
    orderBy: { updatedAt: "desc" },
  });

  if (books.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
        <p className="text-slate-300 font-semibold">No books yet</p>
        <p className="text-slate-500 text-sm mt-1">
          Upload the legacy workbook with “Import workbook” to fill the shelf.
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
