import Link from "next/link";
import { Suspense } from "react";
import AuthorPortrait from "@/components/AuthorPortrait";
import BookCover from "@/components/BookCover";
import BookSearch from "@/components/BookSearch";
import { parseBookSearchQuery } from "@/lib/book-search";
import { searchBooks, searchTags } from "@/lib/books";

type SearchParams = Promise<{ q?: string | string[] }>;

export default function SearchResultsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<SearchResultsSkeleton />}>
      <SearchResultsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchResultsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const queryValues =
    typeof params.q === "string"
      ? [params.q]
      : Array.isArray(params.q)
        ? params.q
        : [];
  const parsed = parseBookSearchQuery(queryValues);
  const [books, tags] = parsed.valid
    ? await Promise.all([
        searchBooks(parsed.query),
        searchTags(parsed.query),
      ])
    : [[], []];

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← Back to library
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Book search results
            </h1>
            {parsed.valid ? (
              <p className="mt-1 text-sm text-slate-400">
                {books.length} {books.length === 1 ? "book" : "books"} and{" "}
                {tags.length} {tags.length === 1 ? "tag" : "tags"} matching{" "}
                <span className="font-semibold text-slate-200">
                  &ldquo;{parsed.query}&rdquo;
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-rose-300">
                {parsed.reason === "too_short"
                  ? "Enter at least 2 characters to search."
                  : parsed.reason === "too_long"
                    ? "Search queries must be 100 characters or fewer."
                    : "Provide one search query to see results."}
              </p>
            )}
          </div>
          <BookSearch />
        </header>

        {tags.length > 0 ? (
          <section aria-labelledby="matching-tags" className="space-y-3">
            <h2 id="matching-tags" className="text-lg font-bold text-white">
              Matching tags
            </h2>
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    href={`/tags/${encodeURIComponent(tag.id)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-200 transition hover:bg-violet-500/20"
                  >
                    {tag.name}
                    <span className="text-xs text-violet-300/70">
                      {tag.category.toLowerCase()} · {tag.bookCount} books
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {books.length > 0 ? (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/40">
            {books.map((book) => (
              <li key={book.id}>
                <Link
                  href={`/books/${encodeURIComponent(book.id)}`}
                  className="flex flex-wrap items-center gap-4 p-4 transition hover:bg-slate-800"
                >
                  <BookCover
                    editionKey={book.editionKey}
                    openLibraryCoverId={book.openLibraryCoverId}
                    title={book.title}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-white">
                      {book.title}
                    </h2>
                    <div className="mt-1">
                      <AuthorPortrait author={book.author} links={false} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="rounded-full border border-slate-700 px-2.5 py-1">
                      {book.readingYear === 2007
                        ? "Pre-2008"
                        : book.readingYear}
                    </span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1">
                      {book.status.replaceAll("_", " ")}
                    </span>
                    {book.genre ? (
                      <span className="rounded-full border border-slate-700 px-2.5 py-1">
                        {book.genre.name}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : parsed.valid && tags.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
            No books match this search.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function SearchResultsSkeleton() {
  return (
    <main
      className="min-h-screen animate-pulse bg-slate-900 p-6 text-slate-100 md:p-12"
      aria-busy="true"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-6 w-40 rounded bg-slate-800" />
        <div className="h-24 rounded-xl bg-slate-800" />
        <div className="h-72 rounded-xl bg-slate-800" />
      </div>
    </main>
  );
}
