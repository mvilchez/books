// src/app/stats/_components.tsx — server-only presentational helpers (no 'use client').
import Link from 'next/link';
import type { AuthorBookList, AuthorRank, Suggestion } from '@/lib/analytics-types';
import { getBookStatusPresentation } from '@/lib/book-status-presentation';

export const nf = new Intl.NumberFormat('es-ES');

const TONES = {
  emerald: 'border-emerald-500/30 text-emerald-400',
  blue: 'border-blue-500/30 text-blue-400',
  amber: 'border-amber-500/30 text-amber-400',
  purple: 'border-purple-500/30 text-purple-400',
  rose: 'border-rose-500/30 text-rose-400',
  sky: 'border-sky-500/30 text-sky-400',
} as const;

export function Kpi({ label, value, tone }: { label: string; value: string | number; tone: keyof typeof TONES }) {
  return (
    <div className={`min-w-0 rounded-xl border bg-slate-900/70 p-3 sm:p-4 ${TONES[tone]}`}>
      <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">
        {label}
      </p>
      <p className={`mt-1.5 break-words text-xl font-bold sm:text-2xl ${TONES[tone].split(' ')[1]}`}>
        {value}
      </p>
    </div>
  );
}

export function TopList({ title, items }: { title: string; items: { id: string; label: string; value: string }[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-white sm:text-lg">{title}</h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No completed books yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-slate-300">{item.label}</span>
              <span className="shrink-0 rounded-md bg-slate-950 px-2.5 py-1 text-xs font-bold text-emerald-400 sm:text-sm">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopAuthorsBooks({
  authors,
  booksByAuthor,
}: {
  authors: AuthorRank[];
  booksByAuthor: AuthorBookList[];
}) {
  return (
    <section className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-white sm:text-lg">Top 5 authors and their books</h3>
      {authors.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No completed books yet.</p>
      ) : (
        <div className="space-y-3">
          {authors.map((author) => {
            const books = booksByAuthor.find((entry) => entry.authorId === author.id)?.books ?? [];
            const completedStyle = getBookStatusPresentation('COMPLETED');
            return (
              <details key={author.id} className="group rounded-lg bg-slate-900/60">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm marker:content-none hover:bg-slate-900 sm:px-4">
                  <Link
                    href={`/search?q=${encodeURIComponent(author.name)}`}
                    aria-label={`Search all books by ${author.name}`}
                    className="font-semibold text-slate-200 hover:text-emerald-300"
                  >
                    {author.name}
                  </Link>
                  <span className="shrink-0 text-xs font-bold text-emerald-400">
                    {author.books} books
                  </span>
                </summary>
                <ul className="space-y-2 border-t border-slate-700/70 px-4 py-3">
                  {books.map((book) => (
                    <li
                      key={book.id}
                      className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border-l-2 px-3 py-2 text-sm ${completedStyle.row}`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/books/${book.id}`}
                          className="truncate text-slate-200 transition hover:text-emerald-300"
                        >
                          {book.title}
                        </Link>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${completedStyle.badge}`}>
                          {completedStyle.label}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-emerald-200/70">
                        {book.readingYear}
                        {book.rating === null ? '' : ` · ${book.rating}/10`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SuggestionsList({ items }: { items: Suggestion[] }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-white sm:text-lg">Smart next reading suggestions</h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">
          Add items to WISH_LIST under your favorite genres to trigger recommendations.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((book) => (
            <div key={book.id} className="rounded-lg border border-slate-700/40 bg-slate-900/60 p-3">
              <h4 className="font-bold text-white text-sm">{book.title}</h4>
              <p className="text-xs text-slate-400 mt-0.5">by {book.author} | {book.genre ?? 'Sin género'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading statistics">
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl border border-slate-800 bg-slate-800/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`h-[min(70vw,360px)] min-h-56 rounded-xl bg-slate-800 ${i < 2 ? 'lg:col-span-2' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
