"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  deleteBook,
  type DeleteBookFormState,
} from "@/app/actions/bookActions";
import { TrashIcon } from "@/components/icons";

const initialState: DeleteBookFormState = { status: "idle", message: "" };

export default function DeleteBookButton({
  bookId,
  title,
  returnTo,
  compact = false,
}: {
  bookId: string;
  title: string;
  returnTo: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteBook, initialState);

  useEffect(() => {
    if (state.status !== "success") return;
    if (returnTo === "refresh") {
      router.refresh();
    } else {
      router.push(returnTo);
    }
  }, [returnTo, router, state.status]);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
          event.preventDefault();
        }
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="bookId" value={bookId} />
      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-60 ${
          compact ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        <TrashIcon />
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="text-xs text-rose-400">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
