import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  markSagaBookUnreadAction,
  startSagaWishlistBookAction,
} from "@/app/actions/bookActions";
import AuthorPortrait from "@/components/AuthorPortrait";
import BookCover from "@/components/BookCover";
import BookSearch from "@/components/BookSearch";
import SagaSeriesSection from "@/components/SagaSeriesSection";
import { getSagaBooks } from "@/lib/books";
import { getSagaBookAction } from "@/lib/saga-book-action";
import { decodeSagaRouteName } from "@/lib/saga-route";
import { getSagaSeriesView } from "@/lib/saga-series";

export default function SagaDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  return (
    <Suspense fallback={<SagaDetailSkeleton />}>
      <SagaDetail params={params} />
    </Suspense>
  );
}

async function SagaDetail({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  // Next.js hands the raw (still percent-encoded) segment to the route, while
  // saga names are stored decoded — decode before the exact lookup.
  const name = decodeSagaRouteName(rawName);
  if (name === null) notFound();

  const books = await getSagaBooks(name);
  if (books.length === 0) notFound();

  const authors = [...new Set(books.map((book) => book.author.name))];
  const wishlistBook = books.find(
    (book) => getSagaBookAction(book.status) === "start",
  );
  const maxPosition = books.reduce(
    (max, book) => Math.max(max, book.seriesPosition ?? 0),
    0,
  );
  const nextPosition = maxPosition + 1;
  const newBookUrl = buildNewBookUrl({
    seriesName: name,
    seriesPosition: nextPosition,
    titleSuggestions: books.slice(0, 20).map((book) => book.title),
    authorSuggestions: authors.slice(0, 20),
    initialAuthor: authors.length === 1 ? authors[0] : "",
  });
  const goodreadsUrl = `https://www.goodreads.com/search?q=${encodeURIComponent(`${name} series ${authors.join(" ")}`)}`;
  const primaryAuthor = authors.length === 1 ? authors[0] : (authors[0] ?? "");
  const libraryBooks = books.map((book) => ({
    id: book.id,
    title: book.title,
    authorName: book.author.name,
    seriesPosition: book.seriesPosition,
    status: book.status,
    openLibraryCoverId: book.openLibraryCoverId,
  }));
  const seriesView = await getSagaSeriesView(
    name,
    primaryAuthor,
    libraryBooks,
    books[0]?.title ?? null,
  );

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/sagas"
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← All sagas
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <p className="text-sm text-slate-400">{authors.join(", ")}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
              {name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {books.length} {books.length === 1 ? "book" : "books"} in your
              library
            </p>
          </div>
          <BookSearch />
        </header>

        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          {wishlistBook ? (
            <form action={startSagaWishlistBookAction}>
              <input type="hidden" name="bookId" value={wishlistBook.id} />
              <input type="hidden" name="seriesName" value={name} />
              <button
                type="submit"
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
              >
                Start next book: {wishlistBook.title}
              </button>
            </form>
          ) : (
            <Link
              href={newBookUrl}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              Add and start next saga book
            </Link>
          )}
          <Link
            href={newBookUrl}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50 hover:text-white"
          >
            Enter next book details
          </Link>
          <a
            href={goodreadsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-400 hover:text-white"
          >
            Look up saga on Goodreads ↗
          </a>
          <p className="w-full text-xs text-slate-500">
            Goodreads does not provide a documented public series API, so saga
            order here comes from your saved book data. Use Goodreads to check
            the next title, then enter it above.
          </p>
        </section>

        <SagaSeriesSection
          sagaName={name}
          entries={seriesView.entries}
          representativeCoverId={seriesView.representativeCoverId}
          fallbackCoverIds={books
            .map((book) => book.openLibraryCoverId)
            .filter(
              (coverId): coverId is number =>
                coverId !== null &&
                Number.isSafeInteger(coverId) &&
                coverId > 0,
            )
            .slice(0, 4)}
        />

        <h2 className="pt-2 text-xl font-bold text-white">In your library</h2>
        <ol className="space-y-3">
          {books.map((book, index) => (
            <li
              key={book.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-800/50 p-4"
            >
              <span className="w-12 shrink-0 text-center text-sm font-bold text-emerald-300">
                {book.seriesPosition ?? index + 1}
              </span>
              <BookCover
                editionKey={book.editionKey}
                openLibraryCoverId={book.openLibraryCoverId}
                title={book.title}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/books/${encodeURIComponent(book.id)}`}
                  className="font-semibold text-white hover:text-emerald-300"
                >
                  {book.title}
                </Link>
                <div className="mt-1">
                  <AuthorPortrait
                    author={book.author}
                    links={false}
                    searchLink={false}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">
                  {book.status.replaceAll("_", " ")}
                </span>
                {getSagaBookAction(book.status) === "start" ? (
                  <form action={startSagaWishlistBookAction}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="seriesName" value={name} />
                    <button
                      type="submit"
                      className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
                    >
                      Start reading
                    </button>
                  </form>
                ) : getSagaBookAction(book.status) === "unread" ? (
                  <form action={markSagaBookUnreadAction}>
                    <input type="hidden" name="bookId" value={book.id} />
                    <input type="hidden" name="seriesName" value={name} />
                    <button
                      type="submit"
                      className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/10"
                    >
                      Mark unread
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}

function buildNewBookUrl({
  seriesName,
  seriesPosition,
  titleSuggestions,
  authorSuggestions,
  initialAuthor,
}: {
  seriesName: string;
  seriesPosition: number;
  titleSuggestions: string[];
  authorSuggestions: string[];
  initialAuthor: string;
}): string {
  const params = new URLSearchParams({
    seriesName,
    seriesPosition: String(seriesPosition),
    author: initialAuthor,
  });
  for (const title of titleSuggestions) params.append("titleSuggestions", title);
  for (const author of authorSuggestions) params.append("authorSuggestions", author);
  return `/books/new?${params.toString()}`;
}

function SagaDetailSkeleton() {
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
