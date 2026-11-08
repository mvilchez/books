"use client";

import { useActionState } from "react";
import { deleteOrphanAuthorsForm } from "@/app/actions/authorNationalityActions";
import type { AuthorActionResult } from "@/app/actions/authorNationalityActions";
import { TrashIcon } from "@/components/icons";

const initialState: AuthorActionResult = { status: "idle", message: "" };

export default function OrphanAuthorsDeleteButton({
  count,
}: {
  count: number;
}) {
  const [state, formAction, pending] = useActionState(
    deleteOrphanAuthorsForm,
    initialState,
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Delete all ${count} orphan authors? This cannot be undone.`,
          )
        ) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center gap-2"
    >
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <TrashIcon /> : `Delete all ${count}`}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="ml-2 text-xs text-rose-400">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="ml-2 text-xs text-emerald-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
