"use client";

import { useActionState } from "react";
import {
  completeReadingBook,
  updateBookProgress,
  type BookFormState,
} from "@/app/actions/bookActions";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import BookCover from "@/components/BookCover";
import AuthorPortrait from "@/components/AuthorPortrait";

const initialCompletionState: BookFormState = { status: "idle", message: "" };

/** The exact shape `BookGrid` passes down: a Book with author and genre included. */
type BookWithAuthorAndGenre = Prisma.BookGetPayload<{
  include: { author: true; genre: true };
}>;

export default function BookCard({ book }: { book: BookWithAuthorAndGenre }) {
  const [completionState, completionAction, completionPending] = useActionState(
    completeReadingBook,
    initialCompletionState,
  );

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
  const formatDate = (date: Date | null) =>
    date
      ? new Intl.DateTimeFormat("es-ES", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)
      : "—";

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
          <div className="mb-2 mt-1">
            <AuthorPortrait author={book.author} links={false} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-400">
            <dt>Genre</dt>
            <dd className="truncate text-slate-300">{book.genre?.name ?? "—"}</dd>
            <dt>Started</dt>
            <dd className="text-slate-300">{formatDate(book.startDate)}</dd>
            <dt>Finished</dt>
            <dd className="text-slate-300">{formatDate(book.finishDate)}</dd>
            <dt>Published</dt>
            <dd className="text-slate-300">{book.publicationYear ?? "—"}</dd>
            <dt>Origin</dt>
            <dd className="truncate text-slate-300">{book.origin ?? "—"}</dd>
          </dl>
          {book.rating !== null ? (
            <div className="mt-2 text-amber-400 text-xs font-semibold">
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
        {book.status === "READING" && (
          <form action={completionAction} className="mt-4 space-y-2">
            <input type="hidden" name="bookId" value={book.id} />
            <label
              htmlFor={`completion-rating-${book.id}`}
              className="block text-xs font-semibold text-slate-300"
            >
              Rate this book to mark it completed
            </label>
            <div className="flex gap-2">
              <input
                id={`completion-rating-${book.id}`}
                name="rating"
                type="number"
                min={0}
                max={10}
                step="0.1"
                required
                aria-label={`Rating for ${book.title}`}
                className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                disabled={completionPending}
                className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
              >
                {completionPending ? "Saving…" : "Mark completed"}
              </button>
            </div>
            {completionState.status === "error" && (
              <p role="alert" className="text-xs text-rose-400">
                {completionState.message}
              </p>
            )}
          </form>
        )}
      </div>
    </article>
  );
}
