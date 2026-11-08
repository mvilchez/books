import Link from "next/link";
import { Suspense } from "react";
import { findOrphanBooks } from "@/lib/books";
import { getUsedTags } from "@/lib/tags";
import BookGenreAssigner from "@/components/BookGenreAssigner";

export default function OrphanBooksPage() {
  return (
    <Suspense fallback={<OrphanBooksSkeleton />}>
      <OrphanBooksContent />
    </Suspense>
  );
}

async function OrphanBooksContent() {
  const [books, allTags] = await Promise.all([
    findOrphanBooks(),
    getUsedTags(),
  ]);
  const genres = allTags.filter((tag) => tag.category === "GENRE");

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
            Orphan books maintenance
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Orphan books are books without a genre assigned. Pick a genre from
            the existing library tags to categorize each one.
          </p>
        </header>
        <p className="text-sm text-slate-400">
          {books.length} orphan book(s) found.
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Assign genre</th>
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
                    <td className="px-4 py-3">{book.author.name}</td>
                    <td className="px-4 py-3">{book.readingYear}</td>
                    <td className="px-4 py-3">{book.totalPages ?? "—"}</td>
                    <td className="px-4 py-3">
                      <BookGenreAssigner
                        book={{
                          id: book.id,
                          title: book.title,
                          authorName: book.author.name,
                        }}
                        genres={genres}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            No orphan books — every book has a genre.
          </p>
        )}
      </div>
    </main>
  );
}

function OrphanBooksSkeleton() {
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
