"use client"
import type { PersistedPersonalizedRecommendation } from "@/lib/analytics-types";
import { useState, useTransition } from "react";
import {
  discardRecommendation,
  getRecommendationHistory,
  markRecommendationAsDeleted,
  recalculateRecommendations,
  startRecommendedBook,
} from "@/app/actions/recommendationActions";

/** Displays the persisted recommendation list and lets users generate or refresh it. */
export function RecommendationsList({
  items,
}: {
  items: PersistedPersonalizedRecommendation[];
}) {
  const [recommendations, setRecommendations] = useState(items);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const activeRecommendations = recommendations.filter(
    ({ status }) => status === "ACTIVE",
  );

  function generate() {
    setError("");
    startTransition(async () => {
      try {
        const result = await recalculateRecommendations();
        setRecommendations(result.recommendations);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not generate recommendations.",
        );
      }
    });
  }

  function markAsRead(recommendationId: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await markRecommendationAsDeleted(recommendationId);
        if (!result.success) {
          setError("Could not mark this recommendation as read.");
          return;
        }
        setRecommendations(result.newRecs);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not mark this recommendation as read.",
        );
      }
    });
  }

  function startReading(recommendationId: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await startRecommendedBook(recommendationId);
        setRecommendations(result.recommendations);
        if (!result.success) setError(result.message);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not start this recommended book.",
        );
      }
    });
  }

  function discard(recommendationId: string) {
    setError("");
    startTransition(async () => {
      try {
        const result = await discardRecommendation(recommendationId);
        if (!result.success) {
          setError("Could not discard this recommendation.");
          return;
        }
        setRecommendations(result.recommendations);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not discard this recommendation.",
        );
      }
    });
  }

  function toggleHistory() {
    if (showAll) {
      setShowAll(false);
      return;
    }

    setError("");
    startTransition(async () => {
      try {
        const history = await getRecommendationHistory();
        setRecommendations(history);
        setHistoryLoaded(true);
        setShowAll(true);
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load recommendation history.",
        );
      }
    });
  }

  function renderRecommendation(
    book: PersistedPersonalizedRecommendation,
    includeStatus: boolean,
  ) {
    return (
      <div
        key={book.id}
        className="flex items-start gap-3 rounded-lg border border-slate-700/40 bg-slate-900/60 p-3"
      >
        <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-md bg-slate-700 text-xs text-slate-400">
          {book.firstPublishYear ?? "—"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{book.title}</p>
          <p className="truncate text-sm text-slate-400">
            by {book.author}{book.firstPublishYear ? ` (${book.firstPublishYear})` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">{book.reason}</p>
          {includeStatus ? (
            <p className="mt-1 text-xs text-slate-400">
              Status: {book.status === "ACTIVE"
                ? "Active"
                : book.status === "DELETED"
                  ? "Read / removed"
                  : book.status === "MARKED_AS_READ"
                    ? "Read"
                    : "Dismissed"}
            </p>
          ) : null}
        </div>
        {book.status === "ACTIVE" ? (
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={() => startReading(book.id)}
              className="rounded-md border border-emerald-700/60 px-2 py-1 text-xs text-emerald-300 hover:border-emerald-500"
              disabled={isPending}
            >
              Start reading
            </button>
            <button
              type="button"
              onClick={() => markAsRead(book.id)}
              className="rounded-md border border-slate-700/30 px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
              disabled={isPending}
            >
              Mark as read
            </button>
            <button
              type="button"
              onClick={() => discard(book.id)}
              className="rounded-md border border-rose-900/60 px-2 py-1 text-xs text-rose-300 hover:border-rose-600"
              disabled={isPending}
            >
              Discard
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-white sm:text-lg">
        Personalized recommendations for you
      </h3>
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="mb-4 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50 disabled:cursor-wait disabled:opacity-50"
      >
        {isPending
          ? "Generating…"
          : recommendations.length === 0
            ? "Generate recommendations"
            : "Generate a new list"}
      </button>
      <button
        type="button"
        onClick={toggleHistory}
        disabled={isPending}
        className="mb-4 ml-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-400"
        aria-expanded={showAll}
      >
        {showAll
          ? "Show active recommendations"
          : historyLoaded
            ? `View all recommendations (${recommendations.length})`
            : "View all recommendations"}
      </button>
      {error ? (
        <p role="alert" className="mb-4 text-sm text-rose-400">
          {error}
        </p>
      ) : null}
      {recommendations.length === 0 ? (
        <p className="text-slate-400 text-sm italic">
          Generate a list from your rated books and reading preferences.
        </p>
      ) : (
        <div className="space-y-4">
          {(showAll ? recommendations : activeRecommendations).map((book) =>
            renderRecommendation(book, showAll),
          )}
          {!showAll && activeRecommendations.length === 0 ? (
            <p className="text-sm italic text-slate-400">
              No active recommendations. Generate a new list or review your history.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
