"use client"
import type { PersonalizedRecommendation } from "@/lib/analytics-types";
import { useState, useCallback } from "react";
import {
  getCompletedBooksByAuthor,
  markRecommendationAsRead,
} from "@/app/actions/recommendationActions";

/**
 * RecommendationsList component with action buttons
 * /* Buttons handle actions internally via inline onClick handlers */
export function RecommendationsList({
  items,
}: {
  items: PersonalizedRecommendation[];
}) {
  const {
    handleMarkAsRead,
    selection,
    selectedBookId,
    setSelectedBookId,
    confirmSelection,
    closeSelector,
  } = useMarkAsRead();

  return (
    <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:p-5">
      <h3 className="mb-4 text-base font-bold text-white sm:text-lg">
        Personalized recommendations for you
      </h3>
      {items.length === 0 ? (
        <p className="text-slate-400 text-sm italic">
          Add more completed books with ratings to get personalized recommendations.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((book) => (
            <div
              key={book.id}
              className="flex items-start gap-3 rounded-lg border border-slate-700/40 bg-slate-900/60 p-3"
            >
              <div className="w-10 h-14 rounded-md bg-slate-700 flex-shrink-0 flex items-center justify-center text-slate-400 text-xs">
                {book.firstPublishYear ? book.firstPublishYear : "—"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {book.title}
                </p>
                <p className="text-slate-400 text-sm truncate">
                  by {book.author}{book.firstPublishYear ? ` (${book.firstPublishYear})` : ""}
                </p>
              </div>
              <span className="text-slate-500 text-xs">
                {book.reason}
              </span>
              <div className="ml-4 flex gap-2">
                {/* Dismissed button - removes from recommendations */}
                <button
                  onClick={() => alert('Dismiss recommendation ' + book.id)}
                  className="rounded-md border border-slate-700/30 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-colors"
                  disabled={false}
                >
                  Dismissed
                </button>
                {/* Recalculate button - get 5 new recommendations */}
                <button
                  onClick={() => alert('Recalculate recommendations')}
                  className="rounded-md border border-slate-700/30 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-colors"
                  disabled={false}
                >
                  Recalculate
                </button>
                {/* Mark as read button - same book, different workId */}
                <button
                  onClick={() => handleMarkAsRead(book)}
                  className="rounded-md border border-slate-700/30 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-colors"
                  disabled={false}
                >
                  Mark as read
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selection && (
        <div className="mt-4 rounded-lg border border-slate-700 p-4" role="dialog" aria-label="Select completed book">
          <label htmlFor="completed-book" className="mb-2 block text-sm text-slate-300">
            Select the completed book by {selection.author}:
          </label>
          <select
            id="completed-book"
            value={selectedBookId ?? ""}
            onChange={(event) => setSelectedBookId(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-white"
          >
            {selection.books.map((book) => (
              <option key={book.id} value={book.id}>{book.title}</option>
            ))}
          </select>
          <div className="mt-3 flex gap-2">
            <button onClick={confirmSelection} className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white">
              Confirm
            </button>
            <button onClick={closeSelector} className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-300">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Hook to handle the mark-as-read selection logic */
function useMarkAsRead() {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    recommendationId: string;
    author: string;
    books: { id: string; title: string }[];
  } | null>(null);

  const handleMarkAsRead = useCallback(
    async (book: PersonalizedRecommendation) => {
      const books = await getCompletedBooksByAuthor(book.author);

      if (books.length === 0) {
        alert(`No completed books found by "${book.author}" in your library.`);
        return;
      }

      if (books.length === 1) {
        const result = await markRecommendationAsRead(book.id, books[0].id);
        if (!result.success) {
          alert("Could not mark this recommendation as read.");
          return;
        }
        alert(`Marked "${books[0].title}" as read for recommendation`);
        return;
      }

      setSelection({ recommendationId: book.id, author: book.author, books });
      setSelectedBookId(books[0].id);
    },
    []
  );

  const closeSelector = useCallback(() => {
    setSelection(null);
    setSelectedBookId(null);
  }, []);

  const confirmSelection = useCallback(async () => {
    if (!selection || !selectedBookId) return;

    const result = await markRecommendationAsRead(
      selection.recommendationId,
      selectedBookId,
    );
    if (!result.success) {
      alert("Could not mark this recommendation as read.");
      return;
    }

    closeSelector();
      alert("Book marked as read");
  }, [closeSelector, selectedBookId, selection]);

  return {
    handleMarkAsRead,
    selection,
    selectedBookId,
    setSelectedBookId,
    confirmSelection,
    closeSelector,
  };
}
