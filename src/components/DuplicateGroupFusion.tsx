"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fuseDuplicateBooks } from "@/app/actions/bookActions";
import type { BookActionResult } from "@/app/actions/bookActions";
import type { DuplicateBookGroup } from "@/lib/duplicate-books";

const initialState: BookActionResult = { status: "idle", message: "" };

export default function DuplicateGroupFusion({
  group,
}: {
  group: DuplicateBookGroup;
}) {
  const [state, formAction, pending] = useActionState(
    fuseDuplicateBooks,
    initialState,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
  }, [router, state.status]);

  return (
    <article className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="mb-3">
        <p className="font-semibold text-white">
          {group.title} — {group.authorName}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {group.bookCount} records · reading years:{" "}
          {group.years.join(", ")}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Pick the record to keep. Its tags are preserved; the other records
          are deleted.
        </p>
      </div>
      <form action={formAction} className="space-y-2">
        <ul className="divide-y divide-slate-800 sm:grid sm:grid-cols-2 sm:gap-3 sm:divide-y-0 sm:border sm:border-slate-800">
          {group.books.map((book) => (
            <li
              key={book.id}
              className="p-3 sm:px-4 sm:py-3 last:sm:border-b-0"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="keeper"
                  value={book.id}
                  defaultChecked={book.id === group.books[0].id}
                  className="shrink-0 mt-0.5 text-emerald-500"
                />
                <span className="text-sm text-slate-200">{book.title}</span>
                <span className="text-xs text-slate-500">
                  {book.readingYear} · {book.status} ·
                  {book.totalPages ?? "—"} pages
                </span>
              </label>
            </li>
          ))}
        </ul>
        {group.books.map((book) => (
          <input key={book.id} type="hidden" name="bookIds" value={book.id} />
        ))}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {pending
            ? "Fusing…"
            : `Fuse into the selected record and delete the other ${
                group.bookCount - 1
              } record(s)`}
        </button>
      </form>
      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="mt-2 text-xs text-emerald-400">
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
