"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createReadingBook,
  type BookFormState,
} from "@/app/actions/bookActions";

const initialState: BookFormState = { status: "idle", message: "" };

export default function NewReadingBookForm({
  initialTitle = "",
  initialAuthor = "",
}: {
  initialTitle?: string;
  initialAuthor?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createReadingBook,
    initialState,
  );

  if (state.status === "success") {
    return (
      <div role="status" className="space-y-4">
        <p className="font-semibold text-emerald-400">{state.message}</p>
        <Link
          href={`/?year=${state.year}`}
          className="inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
        >
          View {state.year} dashboard
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-300">
          Book title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={191}
          autoComplete="off"
          defaultValue={initialTitle}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label htmlFor="author" className="mb-1 block text-sm font-medium text-slate-300">
          Author
        </label>
        <input
          id="author"
          name="author"
          type="text"
          required
          maxLength={191}
          autoComplete="off"
          defaultValue={initialAuthor}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="mb-1 block text-sm font-medium text-slate-300">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label htmlFor="totalPages" className="mb-1 block text-sm font-medium text-slate-300">
            Total pages <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="totalPages"
            name="totalPages"
            type="number"
            min={1}
            step={1}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
          />
        </div>
      </div>
      <div>
        <label htmlFor="genre" className="mb-1 block text-sm font-medium text-slate-300">
          Genre <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="genre"
          name="genre"
          type="text"
          maxLength={191}
          autoComplete="off"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
        />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-rose-400">{state.message}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Adding book…" : "Start reading"}
      </button>
    </form>
  );
}
