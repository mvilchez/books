"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useActionState } from "react";
import {
  addPendingBook,
  type PendingBookFormState,
} from "@/app/actions/bookActions";
import { findBookRecommendations } from "@/app/actions/openLibraryImageActions";
import type { OpenLibraryRecommendationResult } from "@/lib/open-library-images";

type ActionResult =
  | {
      status: "success";
      data: OpenLibraryRecommendationResult;
      message?: string;
    }
  | { status: "error"; message: string };

const initialPendingBookState: PendingBookFormState = {
  status: "idle",
  message: "",
};

export default function BookRecommendations({
  bookId,
  authorName,
}: {
  bookId: string;
  authorName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<OpenLibraryRecommendationResult | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function search() {
    setResult(null);
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const response: ActionResult = await findBookRecommendations(bookId);
        if (response.status === "error") {
          setError(response.message);
          return;
        }
        setMessage(response.message ?? "");
        setResult(response.data);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The recommendation search failed.",
        );
      }
    });
  }

  return (
    <section
      aria-labelledby="book-recommendations-heading"
      className="mt-8 space-y-4 border-t border-slate-700 pt-6"
    >
      <div>
        <h2
          id="book-recommendations-heading"
          className="text-lg font-bold text-white"
        >
          Discover more by {authorName}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Search Open Library in Spanish first, then English if no unread
          suggestions are found. Completed books are excluded.
        </p>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={search}
        className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50 disabled:cursor-wait disabled:opacity-50"
      >
        {isPending ? "Searching Open Library…" : "Find recommendations"}
      </button>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}
      {result && result.books.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {result.books.map((book) => {
            const bookAuthor = book.authors[0] ?? authorName;
            const newBookHref = `/books/new?${new URLSearchParams({
              title: book.title,
              author: bookAuthor,
            }).toString()}`;

            return (
              <li
                key={book.workId}
                className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-4"
              >
                <a
                  href={`https://openlibrary.org/works/${encodeURIComponent(book.workId)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <span className="block font-semibold text-white">
                    {book.title}
                  </span>
                  {book.authors.length > 0 ? (
                    <span className="mt-1 block text-sm text-slate-400">
                      by {book.authors.join(", ")}
                    </span>
                  ) : null}
                  {book.firstPublishYear ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      First published {book.firstPublishYear}
                    </span>
                  ) : null}
                  <span className="mt-3 block text-xs font-semibold text-emerald-300">
                    View on Open Library →
                  </span>
                </a>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={newBookHref}
                    className="inline-flex rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  >
                    Start reading
                  </Link>
                  <AddToLibraryButton
                    title={book.title}
                    author={bookAuthor}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function AddToLibraryButton({
  title,
  author,
}: {
  title: string;
  author: string;
}) {
  const [state, formAction, pending] = useActionState(
    addPendingBook,
    initialPendingBookState,
  );

  if (state.status === "success" && state.bookId) {
    return (
      <span className="text-xs text-emerald-300">
        Added ·{" "}
        <Link
          href={`/books/${encodeURIComponent(state.bookId)}`}
          className="font-semibold underline underline-offset-2"
        >
          View book
        </Link>
      </span>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="author" value={author} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500/50 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to library"}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-rose-400">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
