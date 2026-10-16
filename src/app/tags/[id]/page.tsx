import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import BookCard from "@/components/BookCard";
import BookSearch from "@/components/BookSearch";
import { prisma } from "@/lib/prisma";

export default function TagBooksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<TagBooksSkeleton />}>
      <TagBooksContent params={params} />
    </Suspense>
  );
}

async function TagBooksContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tag = await prisma.tag.findUnique({
    where: { id },
    include: {
      books: {
        include: {
          book: { include: { author: true, genre: true } },
        },
        orderBy: { book: { title: "asc" } },
      },
    },
  });
  if (!tag) notFound();

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          ← Back to library
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-sm text-slate-400">{tag.category.toLowerCase()}</p>
            <h1 className="mt-1 text-3xl font-extrabold text-white">{tag.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {tag.books.length} {tag.books.length === 1 ? "book" : "books"}
            </p>
          </div>
          <BookSearch />
        </header>
        {tag.books.length > 0 ? (
          <section
            aria-label={`Books tagged ${tag.name}`}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {tag.books.map(({ book }) => (
              <BookCard key={book.id} book={book} returnTo="refresh" />
            ))}
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
            No books have this tag yet.
          </p>
        )}
      </div>
    </main>
  );
}

function TagBooksSkeleton() {
  return (
    <main
      className="min-h-screen animate-pulse bg-slate-900 p-6 text-slate-100 md:p-12"
      aria-busy="true"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-6 w-40 rounded bg-slate-800" />
        <div className="h-24 rounded-xl bg-slate-800" />
        <div className="h-72 rounded-xl bg-slate-800" />
      </div>
    </main>
  );
}
