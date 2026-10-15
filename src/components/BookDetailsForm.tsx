"use client";

import { useActionState } from "react";
import type { ReadingStatus } from "@prisma/client";
import {
  setBookStillReading,
  updateBookDetails,
  type BookFormState,
} from "@/app/actions/bookActions";

const initialState: BookFormState = { status: "idle", message: "" };

const statuses: { value: ReadingStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "READING", label: "Reading" },
  { value: "COMPLETED", label: "Completed" },
  { value: "WISH_LIST", label: "Wish list" },
];

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white";
const labelClass = "mb-1 block text-sm font-medium text-slate-300";

export default function BookDetailsForm({
  book,
}: {
  book: {
    id: string;
    title: string;
    author: string;
    genre: string;
    status: ReadingStatus;
    rating: number | null;
    readingYear: number;
    publicationYear: number | null;
    totalPages: number | null;
    currentPages: number;
    startDate: string;
    finishDate: string;
    origin: string;
    editionKey: string;
  };
}) {
  const [state, formAction, pending] = useActionState(
    updateBookDetails,
    initialState,
  );
  const [readingState, stillReadingAction, readingPending] = useActionState(
    setBookStillReading,
    initialState,
  );

  return (
    <div className="mt-8 space-y-5 border-t border-slate-700 pt-6">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="bookId" value={book.id} />
        <h2 className="text-lg font-bold text-white">Edit book details</h2>

        <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="title" className={labelClass}>Title</label>
          <input id="title" name="title" required maxLength={191} defaultValue={book.title} className={inputClass} />
        </div>
        <div>
          <label htmlFor="author" className={labelClass}>Author</label>
          <input id="author" name="author" required maxLength={191} defaultValue={book.author} className={inputClass} />
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Status</label>
          <select id="status" name="status" defaultValue={book.status} className={inputClass}>
            {statuses.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rating" className={labelClass}>Personal rating (0–10)</label>
          <input id="rating" name="rating" type="number" min={0} max={10} step="0.1" defaultValue={book.rating ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="readingYear" className={labelClass}>Reading year</label>
          <input id="readingYear" name="readingYear" type="number" min={1} max={9999} step={1} required defaultValue={book.readingYear} className={inputClass} />
        </div>
        <div>
          <label htmlFor="publicationYear" className={labelClass}>Publication year</label>
          <input id="publicationYear" name="publicationYear" type="number" min={1} max={9999} step={1} defaultValue={book.publicationYear ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="totalPages" className={labelClass}>Total pages</label>
          <input id="totalPages" name="totalPages" type="number" min={0} step={1} defaultValue={book.totalPages ?? ""} className={inputClass} />
        </div>
        <div>
          <label htmlFor="currentPages" className={labelClass}>Pages read</label>
          <input id="currentPages" name="currentPages" type="number" min={0} step={1} required defaultValue={book.currentPages} className={inputClass} />
        </div>
        <div>
          <label htmlFor="startDate" className={labelClass}>Start date</label>
          <input id="startDate" name="startDate" type="date" defaultValue={book.startDate} className={inputClass} />
        </div>
        <div>
          <label htmlFor="finishDate" className={labelClass}>Finish date</label>
          <input id="finishDate" name="finishDate" type="date" defaultValue={book.finishDate} className={inputClass} />
        </div>
        <div>
          <label htmlFor="genre" className={labelClass}>Genre</label>
          <input id="genre" name="genre" maxLength={191} defaultValue={book.genre} className={inputClass} />
        </div>
        <div>
          <label htmlFor="origin" className={labelClass}>Origin</label>
          <input id="origin" name="origin" maxLength={191} defaultValue={book.origin} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="editionKey" className={labelClass}>Edition key</label>
          <input id="editionKey" name="editionKey" maxLength={191} defaultValue={book.editionKey} className={inputClass} />
        </div>
        </div>

        {state.status === "error" && (
          <p role="alert" className="text-sm text-rose-400">{state.message}</p>
        )}
        {state.status === "success" && (
          <p role="status" className="text-sm font-semibold text-emerald-400">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>

      {book.status !== "READING" && (
        <form action={stillReadingAction}>
          <input type="hidden" name="bookId" value={book.id} />
          <button
            type="submit"
            disabled={readingPending}
            className="rounded-lg border border-blue-500/40 px-4 py-2 text-sm font-bold text-blue-300 transition hover:bg-blue-500/10 disabled:cursor-wait disabled:opacity-60"
          >
            {readingPending ? "Updating…" : "Still reading"}
          </button>
        </form>
      )}
      {readingState.status === "error" && (
        <p role="alert" className="text-sm text-rose-400">
          {readingState.message}
        </p>
      )}
      {readingState.status === "success" && (
        <p role="status" className="text-sm font-semibold text-emerald-400">
          {readingState.message}
        </p>
      )}
    </div>
  );
}
