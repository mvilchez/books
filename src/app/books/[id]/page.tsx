import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookCover from "@/components/BookCover";

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const book = await prisma.book.findUnique({
    where: { id },
    include: { author: true, genre: true },
  });

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

  const details = [
    { label: "Genre", value: book.genre?.name },
    { label: "Reading year", value: book.readingYear },
    { label: "Publication year", value: book.publicationYear },
    { label: "Started", value: formatDate(book.startDate) },
    { label: "Finished", value: formatDate(book.finishDate) },
    { label: "Origin", value: book.origin },
  ].filter(
    (detail) =>
      detail.value !== null &&
      detail.value !== undefined &&
      detail.value !== "",
  );

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/?year=${book.readingYear}`}
          className="text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
        >
          ← Back to {book.readingYear === 2007 ? "pre-2008" : book.readingYear}
        </Link>

        <article className="mt-6 rounded-2xl border border-slate-700/60 bg-slate-800 p-6 shadow-xl md:p-10">
          <div className="flex flex-col gap-8 sm:flex-row">
            <BookCover
              key={book.id}
              editionKey={book.editionKey}
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
              <p className="mt-2 text-lg italic text-slate-300">
                by {book.author.name}
              </p>
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

          {details.length > 0 && (
            <section
              aria-labelledby="book-information"
              className="mt-10 border-t border-slate-700 pt-8"
            >
              <h2
                id="book-information"
                className="text-lg font-bold text-white"
              >
                Book information
              </h2>
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {details.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}

function formatDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
