import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookDetail } from "@/lib/books";
import { getSimilarBooks } from "@/lib/analytics";
import { getSubjectTagOptions } from "@/lib/tags";
import BookCover from "@/components/BookCover";
import BookDetailsForm from "@/components/BookDetailsForm";
import BookRecommendations from "@/components/BookRecommendations";
import DeleteBookButton from "@/components/DeleteBookButton";
import AuthorPortrait from "@/components/AuthorPortrait";
import OpenLibraryImagePicker from "@/components/OpenLibraryImagePicker";
import BookMetadataPanel from "@/components/BookMetadataPanel";
import { getOpenLibraryWorkUrl } from "@/lib/open-library-images";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [book, existingSubjectTags, similarBooks] = await Promise.all([
    getBookDetail(id),
    getSubjectTagOptions(),
    getSimilarBooks(id, 5),
  ]);

  if (!book) notFound();

  const isCompleted = book.status === "COMPLETED";
  const pagesRead = isCompleted
    ? (book.totalPages ?? book.currentPages)
    : book.currentPages;
  const percentage =
    book.totalPages !== null && book.totalPages > 0
      ? Math.min(Math.round((pagesRead / book.totalPages) * 100), 100)
      : isCompleted
        ? 100
        : 0;

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/?year=${book.readingYear}`}
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← Back to {book.readingYear === 2007 ? "pre-2008" : book.readingYear}
        </Link>
        <div className="mt-4 flex justify-end">
          <DeleteBookButton
            bookId={book.id}
            title={book.title}
            returnTo={`/?year=${book.readingYear}`}
          />
        </div>

        <article className="mt-2 rounded-2xl border border-slate-700/60 bg-slate-800 p-6 shadow-xl md:p-10">
          <div className="flex flex-col gap-8 sm:flex-row">
            <BookCover
              key={book.id}
              editionKey={book.editionKey}
              openLibraryCoverId={book.openLibraryCoverId}
              title={book.title}
              size="large"
            />
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                {book.status}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white">
                {book.title}
              </h1>
              <div className="mt-2">
                <AuthorPortrait author={book.author} size="large" />
              </div>
              {book.rating !== null && (
                <p className="mt-4 font-semibold text-amber-400">
                  Rating: {book.rating}/10 ★
                </p>
              )}

              <section aria-labelledby="reading-progress" className="mt-8">
                <div className="mb-2 flex justify-between gap-4 text-sm text-slate-300">
                  <h2 id="reading-progress" className="font-semibold">
                    Reading progress
                  </h2>
                  <span>
                    {pagesRead} / {book.totalPages ?? "—"} pages ({percentage}%)
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Reading progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentage}
                  className="h-2 overflow-hidden rounded-full border border-slate-950 bg-slate-900"
                >
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </section>
            </div>
          </div>

          {book.openLibraryWorkId ? (
            <p className="mt-3 text-right text-xs">
              <a
                href={getOpenLibraryWorkUrl(book.openLibraryWorkId) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-emerald-300"
              >
                Cover source: Open Library
              </a>
            </p>
          ) : null}

          {book.synopsis ? (
            <section
              aria-labelledby="book-synopsis"
              className="mt-6 rounded-xl border border-slate-700/60 bg-slate-900/50 p-5"
            >
              <h2 id="book-synopsis" className="text-lg font-bold text-white">
                Synopsis
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {book.synopsis}
              </p>
              {book.synopsisSourceUrl ? (
                <p className="mt-3 text-xs text-slate-500">
                  Source
                  {book.synopsisLanguage
                    ? ` · ${book.synopsisLanguage.toUpperCase()}`
                    : ""}
                  :{" "}
                  <a
                    href={book.synopsisSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-slate-600 underline-offset-2 hover:text-emerald-300"
                  >
                    {book.synopsisSourceUrl.includes("openlibrary.org")
                      ? "Open Library"
                      : "Google Books"}
                  </a>
                </p>
              ) : null}
            </section>
          ) : null}

          <OpenLibraryImagePicker bookId={book.id} />

          <section className="mt-6 rounded-xl border border-slate-700/60 bg-slate-900/50 p-5">
            <h2 className="text-lg font-bold text-white">Similar books in your library</h2>
            {similarBooks.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">No strong matches found yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {similarBooks.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <Link href={`/books/${b.id}`} className="text-slate-200 hover:text-emerald-300 font-semibold">
                      {b.title}
                    </Link>
                    <span className="text-xs text-slate-400">
                      {b.author} · {b.score.toFixed(1)} · {b.reasons.join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <BookRecommendations
            bookId={book.id}
            authorName={book.author.name}
          />

          <BookMetadataPanel
            key={book.id}
            bookId={book.id}
            title={book.title}
            author={book.author.name}
            metadataCheckedAt={book.metadataCheckedAt?.toISOString() ?? null}
            publicationYear={book.publicationYear}
            totalPages={book.totalPages}
            bookFormat={book.bookFormat}
            isbn13={book.isbn13}
            seriesName={book.seriesName}
            seriesPosition={book.seriesPosition}
            tags={book.tags.map(({ tag, source }) => ({
              id: tag.id,
              category: tag.category,
              name: tag.name,
              source,
            }))}
            existingSubjectTags={existingSubjectTags}
          />

          <BookDetailsForm
            key={book.updatedAt.toISOString()}
            book={{
              id: book.id,
              title: book.title,
              author: book.author.name,
              genre: book.genre?.name ?? "",
              status: book.status,
              rating: book.rating,
              readingYear: book.readingYear,
              publicationYear: book.publicationYear,
              totalPages: book.totalPages,
              currentPages: book.currentPages,
              startDate: formatDate(book.startDate),
              finishDate: formatDate(book.finishDate),
              origin: book.origin ?? "",
              editionKey: book.editionKey,
              seriesName: book.seriesName ?? "",
              seriesPosition: book.seriesPosition,
            }}
          />
        </article>
      </div>
    </main>
  );
}

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}
