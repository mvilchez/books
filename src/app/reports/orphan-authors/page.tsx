import Link from "next/link";
import { Suspense } from "react";
import { getOrphanAuthors } from "@/app/actions/authorNationalityActions";
import OrphanAuthorsDeleteButton from "@/components/OrphanAuthorsDeleteButton";

export default function OrphanAuthorsPage() {
  return (
    <Suspense fallback={<OrphanAuthorsSkeleton />}>
      <OrphanAuthorsContent />
    </Suspense>
  );
}

async function OrphanAuthorsContent() {
  const authors = await getOrphanAuthors();

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
            Delete orphan authors
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            These authors have no books and only clutter the author list.
            Deleting them is permanent and cannot be undone.
          </p>
        </header>
        <p className="text-sm text-slate-400">
          {authors.length} orphan author(s) found.
        </p>
        {authors.length > 0 ? (
          <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <ul className="divide-y divide-slate-800 text-sm text-slate-200">
              {authors.map((author) => (
                <li key={author.id} className="px-4 py-3">
                  {author.name}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <OrphanAuthorsDeleteButton count={authors.length} />
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            No orphan authors — every author has at least one book.
          </p>
        )}
      </div>
    </main>
  );
}

function OrphanAuthorsSkeleton() {
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
