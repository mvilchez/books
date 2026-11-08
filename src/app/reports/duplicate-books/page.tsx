import Link from "next/link";
import { Suspense } from "react";
import { findDuplicateBooks } from "@/lib/books";
import DuplicateGroupFusion from "@/components/DuplicateGroupFusion";

export default function DuplicateBooksPage() {
  return (
    <Suspense fallback={<DuplicatesSkeleton />}>
      <DuplicateBooksContent />
    </Suspense>
  );
}

async function DuplicateBooksContent() {
  const groups = await findDuplicateBooks();

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
            Duplicate books finder
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Records sharing the same title and author are potential duplicates.
            Choose the record to keep in each group: its tags are preserved and
            the other records are deleted. Rereads in different years are
            listed separately — only fuse records that are truly the same book.
          </p>
        </header>
        <p className="text-sm text-slate-400">
          {groups.length} duplicate group(s) found.
        </p>
        {groups.length > 0 ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <DuplicateGroupFusion
                key={`${group.authorName}|${group.title}`}
                group={group}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            No duplicate records were found.
          </p>
        )}
      </div>
    </main>
  );
}

function DuplicatesSkeleton() {
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
