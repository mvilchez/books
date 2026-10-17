import Link from "next/link";
import { Suspense } from "react";
import ApplyOpenLibraryCandidateButton from "@/components/ApplyOpenLibraryCandidateButton";
import { prisma } from "@/lib/prisma";

export default function OpenLibraryMatchesReportPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <OpenLibraryMatchesReport />
    </Suspense>
  );
}

async function OpenLibraryMatchesReport() {
  const books = await prisma.book.findMany({
    where: {
      metadataCheckedAt: { not: null },
      metadataCandidates: { some: {} },
    },
    select: {
      id: true,
      title: true,
      author: { select: { name: true } },
      metadataCheckedAt: true,
      metadataCandidates: {
        select: {
          id: true,
          workId: true,
          title: true,
          authorNames: true,
          subjects: true,
          firstPublishYear: true,
          titleSimilarity: true,
          authorSimilarity: true,
        },
        orderBy: [{ titleSimilarity: "desc" }, { authorSimilarity: "desc" }],
      },
    },
    orderBy: [{ author: { name: "asc" } }, { title: "asc" }],
  });

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          ← Back to library
        </Link>
        <header className="border-b border-slate-800 pb-5">
          <h1 className="text-3xl font-extrabold text-white">
            Possible Open Library matches
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            These books had no accepted title-and-author match. Review the suggested
            records before using them; similarity scores are clues, not confirmation.
            Applying a match saves its Open Library link, cover, available publication
            year, and subjects without replacing existing book details.
          </p>
        </header>
        <p className="rounded-xl border border-slate-800 bg-slate-800/60 px-4 py-3 text-sm text-slate-300">
          {books.length.toLocaleString("en")} books have possible records.
        </p>
        {books.length ? (
          <div className="space-y-5">
            {books.map((book) => (
              <section
                key={book.id}
                className="rounded-xl border border-slate-700/70 bg-slate-800/40 p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-white">
                    <Link
                      href={`/books/${encodeURIComponent(book.id)}`}
                      className="hover:text-emerald-300"
                    >
                      {book.title}
                    </Link>
                  </h2>
                  <span className="text-sm text-slate-400">{book.author.name}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Checked {book.metadataCheckedAt?.toLocaleDateString()}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {book.metadataCandidates.map((candidate) => {
                    const authors = JSON.parse(candidate.authorNames) as string[];
                    const subjects = JSON.parse(candidate.subjects) as string[];
                    return (
                      <article
                        key={candidate.workId}
                        className="rounded-lg border border-slate-700 bg-slate-900/70 p-4"
                      >
                        <h3 className="font-semibold text-emerald-300">
                          <a
                            href={`https://openlibrary.org/works/${encodeURIComponent(candidate.workId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:underline"
                          >
                            {candidate.title}
                          </a>
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          {authors.join(", ") || "Author not listed"}
                          {candidate.firstPublishYear
                            ? ` · ${candidate.firstPublishYear}`
                            : ""}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Title similarity: {Math.round(candidate.titleSimilarity * 100)}%
                          {" · "}
                          Author similarity: {Math.round(candidate.authorSimilarity * 100)}%
                        </p>
                        {subjects.length > 0 && (
                          <p className="mt-2 text-xs text-slate-500">
                            Subjects: {subjects.join(", ")}
                          </p>
                        )}
                        <ApplyOpenLibraryCandidateButton
                          bookId={book.id}
                          candidateId={candidate.id}
                        />
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
            No possible matches are awaiting review.
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
