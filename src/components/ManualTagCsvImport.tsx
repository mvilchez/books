"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type ImportResponse = {
  success?: boolean;
  updatedBooks?: number;
  savedTags?: number;
  error?: string;
};

export default function ManualTagCsvImport() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/import/manual-tags", {
        method: "POST",
        body: formData,
      });
      const result: ImportResponse = await response.json();
      if (!response.ok || result.success !== true) {
        setMessage(result.error ?? "Manual tag import failed.");
        return;
      }
      setMessage(
        `Updated ${result.updatedBooks} books with ${result.savedTags} manual tags.`,
      );
      form.reset();
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Manual tag import failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-slate-700 bg-slate-800/60 p-4"
    >
      <h2 className="font-semibold text-white">Apply manual tags from CSV</h2>
      <p className="mt-1 text-sm text-slate-400">
        Edit the report&apos;s <code>manual_tags</code> column (use semicolons between
        tags), then upload the saved CSV. Empty cells clear manual tags for that book.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          required
          accept=".csv,text/csv"
          className="max-w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {pending ? "Importing…" : "Import manual tags"}
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-3 text-sm text-slate-300">
          {message}
        </p>
      ) : null}
    </form>
  );
}
