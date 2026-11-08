import Link from "next/link";
import { Suspense } from "react";
import { getBooksWithoutPublicationYear } from "@/lib/books";

export default function BooksWithoutPubYearPage() {
  return (
    <Suspense fallback={<BooksWithoutPubYearSkeleton />}>
      <BooksWithoutPubYearContent />
    </Suspense>
  );
}

async function BooksWithoutPubYearContent() {
  const books = await getBooksWithoutPublicationYear();

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          ← Back to library
        </Link>
        <header className="border-b border-slate-800 pb-5">
          <h1 className="text-3xl font-extrabold text-white">
            Books without publication year
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            The publication year comes from the source workbook&apos;s
            <strong className="text-slate-300">Año</strong> column (pre-2014
            tabs often lack it). Open a book from the list to edit it on its
            detail page.
          </p>
        </header>
        <p className="text-sm text-slate-400">
          {books.length} book(s) without a recorded publication year.
        </p>
        {books.length > 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden">
            <table className="w-full text-sm divide-y divide-slate-800">
              <thead className="bg-slate-950">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Reading year</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Pages</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Genre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Open in editor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {books.map((book) => (
                  <tr key={book.id} className="text-slate-300">
                    <td className="px-4 py-3 font-semibold">
                      <Link
                        href={`/books/${encodeURIComponent(book.id)}`}
                        className="text-white hover:text-emerald-300"
                      >
                        {book.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/search?q=${encodeURIComponent(book.author.name)}`}
                        aria-label={`Search all books by ${book.author.name}`}
                        className="hover:text-emerald-300"
                      >
                        {book.author.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{book.readingYear}</td>
                    <td className="px-4 py-3">
                      {book.totalPages ?? "—"}
                    </td>
                    <td className="px-4 py-3">{book.genre?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/books/${encodeURIComponent(book.id)}`}
                        className="rounded border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            Every book has a recorded publication year.
          </p>
        )}
      </div>
    </main>
  );
}

function BooksWithoutPubYearSkeleton() {
  return (
    <main className="min-h-screen animate-pulse bg-slate-900 p-6 text-slate-100 md:p-12" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-6 w-40 rounded bg-slate-800" />
        <div className="h-24 rounded-xl bg-slate-800" />
        <div className="h-96 rounded-xl bg-slate-800" />
      </div>
    </main>
  );
}
