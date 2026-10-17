"use client";

import { useState, useTransition } from "react";
import { applyOpenLibraryCandidate } from "@/app/actions/openLibraryImageActions";

export default function ApplyOpenLibraryCandidateButton({
  bookId,
  candidateId,
}: {
  bookId: string;
  candidateId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function applyCandidate() {
    setError(null);
    startTransition(async () => {
      const result = await applyOpenLibraryCandidate(bookId, candidateId);
      if (result.status === "error") setError(result.message);
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={applyCandidate}
        disabled={pending}
        className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Applying…" : "Apply this match"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
