"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setBookGenre } from "@/app/actions/bookActions";
import type { BookActionResult } from "@/app/actions/bookActions";

const initialState: BookActionResult = { status: "idle", message: "" };

type BookGenreAssignerProps = {
  book: { id: string; title: string; authorName: string };
  genres: { id: string; name: string }[];
};

export default function BookGenreAssigner({
  book,
  genres,
}: BookGenreAssignerProps) {
  const [state, formAction, pending] = useActionState(
    setBookGenre,
    initialState,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    router.refresh();
  }, [router, state.status]);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="bookId" value={book.id} />
      <label className="text-xs text-slate-400 shrink-0">Genre</label>
      <select
        name="genreId"
        defaultValue=""
        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-slate-200 focus:border-emerald-500"
      >
        <option value="">— Assign genre —</option>
        {genres.map((genre) => (
          <option key={genre.id} value={genre.id}>
            {genre.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Saving…" : "Assign"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="mt-1 text-xs text-rose-400">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="mt-1 text-xs text-emerald-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
