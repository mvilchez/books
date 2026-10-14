"use client";

import { updateBookProgress } from "@/app/actions/bookActions";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import BookCover from "@/components/BookCover";

/** The exact shape `BookGrid` passes down: a Book with its author included. */
type BookWithAuthor = Prisma.BookGetPayload<{ include: { author: true } }>;

export default function BookCard({ book }: { book: BookWithAuthor }) {
  // The import never fills `currentPages` (verified: 0 rows carry it) — only
  // live tracking does. A COMPLETED book therefore reports its full run via
  // `totalPages`, matching CONTEXT.md §4 where completed pages are counted
  // from totalPages, not currentPages.
  const isCompleted = book.status === "COMPLETED";
  const pagesRead = isCompleted
    ? (book.totalPages ?? book.currentPages)
    : book.currentPages;

  const percentage =
    book.totalPages !== null && book.totalPages > 0
      ? Math.min(Math.round((pagesRead / book.totalPages) * 100), 100)
      : isCompleted
        ? 100 // finished, but the source had no page count (pre-2014 rows)
        : 0;

  return (
    <article className="bg-slate-800 rounded-xl border border-slate-700/60 p-5 shadow-xl transition hover:border-emerald-500/40 flex flex-col justify-between">
      <Link
        href={`/books/${book.id}`}
        className="group flex gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        aria-label={`View details for ${book.title} by ${book.author.name}`}
      >
        <BookCover
          editionKey={book.editionKey}
          title={book.title}
        />
        <div className="min-w-0 flex-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-bold text-lg text-white tracking-wide truncate group-hover:text-emerald-300">
              {book.title}
            </h3>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                book.status === "COMPLETED"
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : book.status === "READING"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-slate-700 text-slate-400"
              }`}
            >
              {book.status}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1 mb-2 italic">
            by {book.author.name}
          </p>
          {book.rating ? (
            <div className="text-amber-400 text-xs font-semibold mb-4">
              Rating: {book.rating}/10 ★
            </div>
          ) : null}
          <span className="text-xs font-semibold text-emerald-400">
            View book details →
          </span>
        </div>
      </Link>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
          <span>
            Progress: {pagesRead} / {book.totalPages ?? "—"} pages
          </span>
          <span>{percentage}%</span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-950">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Increment control only tracks live reading — a finished book is
            already at 100% and its pages live in currentPages = 0. */}
        {!isCompleted && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={async () =>
                await updateBookProgress(book.id, book.currentPages + 10)
              }
              className="flex-1 bg-slate-700 text-xs py-2 rounded-lg font-semibold hover:bg-slate-600 transition text-white"
            >
              +10 Pages
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
