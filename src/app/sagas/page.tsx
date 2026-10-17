import Link from "next/link";
import { Suspense } from "react";
import BookSearch from "@/components/BookSearch";
import { getSagaList } from "@/lib/books";

export default function SagasPage() {
  return (
    <Suspense fallback={<SagasSkeleton />}>
      <SagaList />
    </Suspense>
  );
}

async function SagaList() {
  const sagas = await getSagaList();
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
              Book sagas
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Series grouped from saga information saved with your books.
            </p>
          </div>
          <BookSearch />
        </header>
        {sagas.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sagas.map((saga) => (
              <li key={saga.name}>
                <Link
                  href={`/sagas/${encodeURIComponent(saga.name)}`}
                  className="block h-full rounded-xl border border-slate-700/60 bg-slate-800/60 p-5 transition hover:border-emerald-500/50 hover:bg-slate-800"
                >
                  <h2 className="text-lg font-bold text-white">{saga.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {saga.authors.join(", ") || "Author unknown"}
                  </p>
                  <p className="mt-3 text-xs text-emerald-300">
                    {saga.bookCount} {saga.bookCount === 1 ? "book" : "books"} in
                    your library
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-400">
            No saga information is saved yet. Enrich book metadata or add a saga
            name to a book to see it here.
          </p>
        )}
      </div>
    </main>
  );
}

function SagasSkeleton() {
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
