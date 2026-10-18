"use client";

import { useActionState } from "react";
import {
  completeReadingBook,
  type BookFormState,
} from "@/app/actions/bookActions";
import { CheckIcon } from "@/components/icons";

const initialState: BookFormState = { status: "idle", message: "" };

export default function CompleteBookForm({
  bookId,
  title,
  compact = false,
}: {
  bookId: string;
  title: string;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    completeReadingBook,
    initialState,
  );

  return (
    <form action={formAction} className={compact ? "min-w-48 space-y-1" : "mt-4 space-y-2"}>
      <input type="hidden" name="bookId" value={bookId} />
      <label
        htmlFor={`completion-rating-${bookId}`}
        className="block text-xs font-semibold text-slate-300"
      >
        Rate to complete
      </label>
      <div className="flex gap-2">
        <input
          id={`completion-rating-${bookId}`}
          name="rating"
          type="number"
          min={0}
          max={10}
          step="0.1"
          required
          aria-label={`Rating for ${title}`}
          className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-2 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
        >
          <CheckIcon />
          {pending ? "Saving…" : "Complete"}
        </button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-rose-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
