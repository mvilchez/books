"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  markSagaBookUnreadAction,
  startSagaWishlistBookAction,
} from "@/app/actions/bookActions";
import { getSagaBookAction } from "@/lib/saga-book-action";
import type { SagaSeriesEntry } from "@/lib/saga-series";

/**
 * Full Open Library series listing for one saga: hero cover (first OL series
 * cover, else a collage of saved covers) plus every installment ordered by
 * series position and marked read / in-library / missing.
 */
export default function SagaSeriesSection({
  sagaName,
  entries,
  representativeCoverId,
  fallbackCoverIds,
}: {
  sagaName: string;
  entries: SagaSeriesEntry[];
  representativeCoverId: number | null;
  fallbackCoverIds: number[];
}) {
  const [heroFailed, setHeroFailed] = useState(false);
  const heroId = heroFailed ? null : representativeCoverId;

  if (entries.length === 0) return null;

  const readCount = entries.filter((entry) => entry.isRead).length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/50">
      <div className="flex flex-wrap gap-5 p-5">
        {heroId !== null ? (
          <div className="relative h-56 w-36 shrink-0 overflow-hidden rounded-lg border border-slate-600/70 bg-slate-900">
            <Image
              src={`https://covers.openlibrary.org/b/id/${heroId}-L.jpg?default=false`}
              alt={`Representative cover for the ${sagaName} saga`}
              fill
              sizes="144px"
              unoptimized
              loading="lazy"
              className="object-cover"
              onError={() => setHeroFailed(true)}
            />
          </div>
        ) : fallbackCoverIds.length > 0 ? (
          <div className="grid h-56 w-36 shrink-0 grid-cols-2 overflow-hidden rounded-lg border border-slate-600/70 bg-slate-900">
            {fallbackCoverIds.slice(0, 4).map((id) => (
              <div key={id} className="relative min-h-0 min-w-0">
                <Image
                  src={`https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`}
                  alt=""
                  fill
                  sizes="72px"
                  unoptimized
                  loading="lazy"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-white">Full series</h2>
          <p className="mt-1 text-sm text-slate-400">
            {readCount} of {entries.length} read · ordered from Open Library
            series data
          </p>
          <ol className="mt-4 space-y-2">
            {entries.map((entry) => (
              <li
                key={`${entry.seriesPosition}-${entry.title}`}
                className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-900/40 p-2.5"
              >
                <span className="w-8 shrink-0 text-center text-sm font-bold text-emerald-300">
                  {entry.seriesPosition}
                </span>
                {entry.coverId !== null ? (
                  <span className="relative block h-16 w-11 shrink-0 overflow-hidden rounded border border-slate-600/60 bg-slate-800">
                    <Image
                      src={`https://covers.openlibrary.org/b/id/${entry.coverId}-S.jpg?default=false`}
                      alt=""
                      fill
                      sizes="44px"
                      unoptimized
                      loading="lazy"
                      className="object-cover"
                    />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-16 w-11 shrink-0 items-center justify-center rounded border border-slate-600/60 bg-slate-800 px-1 text-center text-[8px] font-semibold leading-tight text-slate-400"
                  >
                    {entry.title}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {entry.libraryBookId ? (
                      <Link
                        href={`/books/${encodeURIComponent(entry.libraryBookId)}`}
                        className="hover:text-emerald-300"
                      >
                        {entry.title}
                      </Link>
                    ) : (
                      entry.title
                    )}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {entry.authors.join(", ")}
                    {entry.firstPublishYear ? ` · ${entry.firstPublishYear}` : ""}
                  </span>
                </span>
                {entry.isRead ? (
                  <span className="shrink-0 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                    ✓ Read
                  </span>
                ) : entry.inLibrary ? (
                  <span className="shrink-0 rounded-full border border-sky-500/50 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                    📚 In library
                  </span>
                ) : (
                  <a
                    href={entry.workUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:border-slate-400 hover:text-white"
                  >
                    ○ Missing
                  </a>
                )}
                {entry.inLibrary && entry.libraryBookId ? (
                  getSagaBookAction(entry.libraryStatus) === "start" ? (
                    <form action={startSagaWishlistBookAction}>
                      <input type="hidden" name="bookId" value={entry.libraryBookId} />
                      <input type="hidden" name="seriesName" value={sagaName} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
                      >
                        Start reading
                      </button>
                    </form>
                  ) : getSagaBookAction(entry.libraryStatus) === "unread" ? (
                    <form action={markSagaBookUnreadAction}>
                      <input type="hidden" name="bookId" value={entry.libraryBookId} />
                      <input type="hidden" name="seriesName" value={sagaName} />
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/10"
                      >
                        Mark unread
                      </button>
                    </form>
                  ) : null
                ) : null}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Series data from Open Library (cached for one day). Goodreads
            offers no public series API, so this page links out to a Goodreads
            search instead of importing from it.
          </p>
        </div>
      </div>
    </section>
  );
}
