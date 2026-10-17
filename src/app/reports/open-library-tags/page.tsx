import Link from "next/link";
import { Suspense } from "react";
import ManualTagCsvImport from "@/components/ManualTagCsvImport";
import { getBooksWithoutOpenLibraryTags } from "@/lib/books";

export default function OpenLibraryTagReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <OpenLibraryTagReportContent />
    </Suspense>
  );
}

async function OpenLibraryTagReportContent() {
  const books = await getBooksWithoutOpenLibraryTags();
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
              Books without saved Open Library tags. This report reads your database
              only and does not send bulk requests to Open Library. Opening a book
              detail page performs its individual metadata lookup.
            </p>
          </div>
          <a
            href="/api/v1/reports/open-library-tags"
            className="rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Download CSV
          </a>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <ReportCount label="Books missing Open Library tags" value={books.length} />
          <ReportCount label="Not checked yet" value={uncheckedCount} />
        </div>

        <p className="text-sm text-slate-400">
          To fill gaps manually, open a book and use <strong className="text-slate-300">Add or edit manual subject tags</strong>.
          Tags are saved to the database and appear in the cloud and search.
        </p>
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
