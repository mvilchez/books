"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  retryBookMetadataLookup,
  retryOpenLibraryTagGaps,
} from "@/app/actions/openLibraryImageActions";

const buttonClass =
  "rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60";

function ResultMessage({
  message,
  isError,
}: {
  message: string | null;
  isError: boolean;
}) {
  if (!message) return null;
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`mt-1 text-xs ${isError ? "text-rose-400" : "text-slate-400"}`}
    >
      {message}
    </p>
  );
}

/** Re-run one book's Open Library metadata lookup (fresh, uncached). */
export function RetryMetadataButton({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleRetry() {
    setMessage(null);
    startTransition(async () => {
      const result = await retryBookMetadataLookup(bookId);
      setIsError(result.status === "error");
      setMessage(
        result.status === "error" ? result.message : result.data.message,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handleRetry}
        disabled={pending}
        className={buttonClass}
      >
        {pending ? "Retrying…" : "Retry"}
      </button>
      <ResultMessage message={message} isError={isError} />
    </div>
  );
}

/** Re-run lookups for a batch of the oldest checked tag-gap books. */
export function RetryTagGapsButton({ limit = 10 }: { limit?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function handleRetry() {
    setMessage(null);
    startTransition(async () => {
      const result = await retryOpenLibraryTagGaps(limit);
      if (result.status === "error") {
        setIsError(true);
        setMessage(result.message);
      } else {
        setIsError(false);
        setMessage(result.message ?? "Retried the checked tag-gap batch.");
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handleRetry}
        disabled={pending}
        className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
      >
        {pending
          ? `Retrying up to ${limit} books…`
          : `Retry up to ${limit} checked books`}
      </button>
      <ResultMessage message={message} isError={isError} />
    </div>
  );
}