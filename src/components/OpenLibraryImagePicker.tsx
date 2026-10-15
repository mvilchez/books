"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  saveAuthorPhoto,
  saveBookCover,
  searchAuthorCandidates,
  searchBookCoverCandidates,
} from "@/app/actions/openLibraryImageActions";
import type {
  OpenLibraryAuthorPhotoCandidate,
  OpenLibraryBookCandidate,
} from "@/lib/open-library-images";

type ActionResult<T> =
  | { status: "success"; data: T; message?: string }
  | { status: "error"; message: string };

export default function OpenLibraryImagePicker({
  bookId,
}: {
  bookId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [bookCandidates, setBookCandidates] = useState<OpenLibraryBookCandidate[]>([]);
  const [authorCandidates, setAuthorCandidates] = useState<OpenLibraryAuthorPhotoCandidate[]>([]);
  const [loadedCoverIds, setLoadedCoverIds] = useState<Set<number>>(new Set());
  const [failedCoverIds, setFailedCoverIds] = useState<Set<number>>(new Set());
  const [loadedAuthorPhotoIds, setLoadedAuthorPhotoIds] = useState<Set<number>>(new Set());
  const [failedAuthorPhotoIds, setFailedAuthorPhotoIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const runAction = <T,>(
    action: () => Promise<ActionResult<T>>,
    onSuccess: (data: T) => void,
  ) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        if (result.status === "error") {
          setError(result.message);
          return;
        }
        setMessage(result.message ?? "");
        onSuccess(result.data);
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "The image request failed.",
        );
      }
    });
  };

  return (
    <section className="mt-8 space-y-4 border-t border-slate-700 pt-6" aria-labelledby="open-library-images">
      <div>
        <h2 id="open-library-images" className="text-lg font-bold text-white">
          Book and author images
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Search Open Library only when requested. Review every match before saving; images are loaded directly from Open Library.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setBookCandidates([]);
            setLoadedCoverIds(new Set());
            setFailedCoverIds(new Set());
            runAction(
              () => searchBookCoverCandidates(bookId),
              setBookCandidates,
            );
          }}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50 disabled:opacity-50"
        >
          {isPending ? "Searching…" : "Find book cover"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setAuthorCandidates([]);
            setLoadedAuthorPhotoIds(new Set());
            setFailedAuthorPhotoIds(new Set());
            runAction(
              () => searchAuthorCandidates(bookId),
              setAuthorCandidates,
            );
          }}
          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50 disabled:opacity-50"
        >
          {isPending ? "Searching…" : "Find author photo"}
        </button>
      </div>

      {message ? <p role="status" className="text-sm text-emerald-300">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-rose-400">{error}</p> : null}

      {bookCandidates.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {bookCandidates.map((candidate) => (
            <li key={`${candidate.workId}:${candidate.coverId}`} className="flex gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded bg-slate-800">
                <Image
                  src={`https://covers.openlibrary.org/b/id/${candidate.coverId}-S.jpg?default=false`}
                  alt={`Cover preview for ${candidate.title}`}
                  fill
                  sizes="56px"
                  unoptimized
                  loading="lazy"
                  className="object-cover"
                  onLoad={() =>
                    setLoadedCoverIds((ids) => new Set(ids).add(candidate.coverId))
                  }
                  onError={() =>
                    setFailedCoverIds((ids) => new Set(ids).add(candidate.coverId))
                  }
                />
              </div>
              <div className="min-w-0">
                <a
                  href={`https://openlibrary.org/works/${candidate.workId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-white underline decoration-slate-600 underline-offset-2 hover:text-emerald-300"
                >
                  {candidate.title}
                </a>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {candidate.authors.join(", ") || "Author not listed"}
                </p>
                {candidate.isbn[0] ? (
                  <p className="mt-1 text-xs text-slate-500">ISBN: {candidate.isbn[0]}</p>
                ) : null}
                <button
                  type="button"
                  disabled={isPending || !loadedCoverIds.has(candidate.coverId) || failedCoverIds.has(candidate.coverId)}
                  onClick={() =>
                    runAction(
                      () => saveBookCover(bookId, candidate.workId, candidate.coverId),
                      () => setBookCandidates([]),
                    )
                  }
                  className="mt-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                >
                  {failedCoverIds.has(candidate.coverId)
                    ? "Cover unavailable"
                    : loadedCoverIds.has(candidate.coverId)
                      ? "Use this cover"
                      : "Loading preview…"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {authorCandidates.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {authorCandidates.map((candidate) => (
            <li key={`${candidate.authorId}:${candidate.photoId}`} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-slate-800">
                <Image
                  src={candidate.photoUrl}
                  alt={`Portrait preview for ${candidate.name}`}
                  fill
                  sizes="64px"
                  unoptimized
                  loading="lazy"
                  className="object-cover"
                  onLoad={() =>
                    setLoadedAuthorPhotoIds((ids) => new Set(ids).add(candidate.photoId))
                  }
                  onError={() =>
                    setFailedAuthorPhotoIds((ids) => new Set(ids).add(candidate.photoId))
                  }
                />
              </div>
              <div className="min-w-0">
                <a
                  href={`https://openlibrary.org/authors/${candidate.authorId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-semibold text-white underline decoration-slate-600 underline-offset-2 hover:text-emerald-300"
                >
                  {candidate.name} · Open Library
                </a>
                <p className="mt-1 text-xs text-slate-400">
                  Review this photo for the current author.
                </p>
                <button
                  type="button"
                  disabled={
                    isPending ||
                    !loadedAuthorPhotoIds.has(candidate.photoId) ||
                    failedAuthorPhotoIds.has(candidate.photoId)
                  }
                  onClick={() =>
                    runAction(
                      () => saveAuthorPhoto(bookId, candidate.authorId, candidate.photoId),
                      () => setAuthorCandidates([]),
                    )
                  }
                  className="mt-2 text-xs font-bold text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                >
                  {failedAuthorPhotoIds.has(candidate.photoId)
                    ? "Photo unavailable"
                    : loadedAuthorPhotoIds.has(candidate.photoId)
                      ? "Use this photo"
                      : "Loading preview…"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
