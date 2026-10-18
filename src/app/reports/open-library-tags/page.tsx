import Link from "next/link";
import { Suspense } from "react";
import ManualTagCsvImport from "@/components/ManualTagCsvImport";
import {
  RetryMetadataButton,
  RetryTagGapsButton,
} from "@/components/MetadataRetryButtons";
import {
  getBooksWithoutOpenLibraryTags,
  getOpenLibraryCreationGaps,
} from "@/lib/books";

export default function OpenLibraryTagReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <OpenLibraryTagReportContent />
    </Suspense>
  );
}

async function OpenLibraryTagReportContent() {
  const [books, creationGaps] = await Promise.all([
    getBooksWithoutOpenLibraryTags(),
    getOpenLibraryCreationGaps(),
  ]);
  const uncheckedCount = books.filter((book) => book.metadataCheckedAt === null).length;

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          ← Back to library
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-3xl font-extrabold text-white">
              Open Library tag gaps
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Books without saved Open Library tags. Manual lookups here and on
              book pages are on demand; opening a book detail page performs its
              individual metadata lookup.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/v1/reports/open-library-tags"
              className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
            >
              Download CSV
            </a>
            <a
              href="/api/v1/reports/open-library-create-gaps"
              className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
              title="Books confirmed missing from Open Library, with links and suggested subjects for creating them manually"
            >
              Download creation report
            </a>
            <RetryTagGapsButton limit={10} />
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <ReportCount label="Books missing Open Library tags" value={books.length} />
          <ReportCount label="Not checked yet" value={uncheckedCount} />
          <ReportCount
            label="Confirmed Open Library creation gaps"
            value={creationGaps.length}
          />
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>
            <strong className="text-slate-300">Retry</strong> re-runs the Open
            Library search for a book, ignoring the one-day search cache. Use it
            after adding a missing book to Open Library manually — the retry
            links the new record and saves its tags automatically. The header
            button retries up to ten of the oldest checked books, oldest first,
            with a short pause between requests; run it repeatedly to work
            through the backlog.
          </p>
          <p>
            The <strong className="text-slate-300">creation report</strong>{" "}
            lists books already checked (so they were searched for) that still
            have no Open Library record. Each row includes a search link to
            double-check, a direct link to Open Library&apos;s add-book form,
            and suggested subjects prefilled from the book&apos;s genre and
            manual tags. After creating a record, hit <strong>Retry</strong> on
            that book to link it.
          </p>
          <p>
            To fill tags by hand instead, open a book and use{" "}
            <strong className="text-slate-300">Add or edit manual subject tags</strong>.
            Tags are saved to the database and appear in the cloud and search.
          </p>
        </div>
        <ManualTagCsvImport />

        {books.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-700/60">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="bg-slate-800 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Book</th>
                  <th scope="col" className="px-4 py-3">Author</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Genre</th>
                  <th scope="col" className="px-4 py-3">Manual tags</th>
                  <th scope="col" className="px-4 py-3">Metadata</th>
                  <th scope="col" className="px-4 py-3">Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                {books.map((book) => (
                  <tr key={book.id} className="text-slate-300">
                    <th scope="row" className="px-4 py-3 font-semibold">
                      <Link
                        href={`/books/${encodeURIComponent(book.id)}`}
                        className="text-white hover:text-emerald-300"
                      >
                        {book.title}
                      </Link>
                    </th>
                    <td className="px-4 py-3">
                      <Link
                        href={`/search?q=${encodeURIComponent(book.author.name)}`}
                        aria-label={`Search all books by ${book.author.name}`}
                        className="hover:text-emerald-300"
                      >
                        {book.author.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {book.metadataCheckedAt
                        ? "Checked; no tags found"
                        : "Not checked"}
                    </td>
                    <td className="px-4 py-3">{book.genre?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {book.tags.map(({ tag }) => tag.name).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {[book.publicationYear, book.totalPages ? `${book.totalPages} pages` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RetryMetadataButton bookId={book.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
            Every book has Open Library tags.
          </p>
        )}
      </div>
    </main>
  );
}

function ReportSkeleton() {
  return (
    <main
      className="min-h-screen animate-pulse bg-slate-900 p-6 text-slate-100 md:p-12"
      aria-busy="true"
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-6 w-48 rounded bg-slate-800" />
        <div className="h-32 rounded-xl bg-slate-800" />
        <div className="h-96 rounded-xl bg-slate-800" />
      </div>
    </main>
  );
}

function ReportCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value.toLocaleString("en")}</p>
    </div>
  );
}
