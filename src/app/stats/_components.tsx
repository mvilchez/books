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
    <div className={`bg-slate-800 p-5 rounded-xl border ${TONES[tone]}`}>
      <p className="text-slate-400 text-xs font-semibold uppercase">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${TONES[tone].split(' ')[1]}`}>{value}</p>
    </div>
  );
}

export function TopList({ title, items }: { title: string; items: { id: string; label: string; value: string }[] }) {
  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No completed books yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between items-center text-sm">
              <span className="text-slate-300">{item.label}</span>
              <span className="bg-slate-900 px-3 py-1 rounded-md text-emerald-400 font-bold">{item.value}</span>
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
    <section className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">Top 5 authors and their books</h3>
      {authors.length === 0 ? (
        <p className="text-slate-400 text-sm italic">No completed books yet.</p>
      ) : (
        <div className="space-y-3">
          {authors.map((author) => {
            const books = booksByAuthor.find((entry) => entry.authorId === author.id)?.books ?? [];
            const completedStyle = getBookStatusPresentation('COMPLETED');
            return (
              <details key={author.id} className="group rounded-lg bg-slate-900/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-4 text-sm marker:content-none hover:bg-slate-900">
                  <span className="font-semibold text-slate-200">{author.name}</span>
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
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
      <h3 className="text-lg font-bold text-white mb-4">Smart next reading suggestions</h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">
          Add items to WISH_LIST under your favorite genres to trigger recommendations.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((book) => (
            <div key={book.id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/40">
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
    <div className="space-y-10 animate-pulse" aria-busy="true" aria-label="Loading statistics">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-16 rounded-full bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-800" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-[360px] rounded-xl bg-slate-800 ${i === 0 ? 'lg:col-span-2' : ''}`} />
        ))}
      </div>
    </div>
  );
}
