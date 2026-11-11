"use client"
import type { PersonalizedRecommendation } from "@/lib/analytics-types";
import { useState, useCallback } from "react";

/**
 * RecommendationsList component with action buttons
 * /* Buttons handle actions internally via inline onClick handlers */
export function RecommendationsList({
  items,
}: {
  items: PersonalizedRecommendation[];
}) {
  const { handleMarkAsRead, showSelector, selectedBookId, confirmSelection, closeSelector } = useMarkAsRead(items);

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
    </div>
  );
}

/** Fetch completed books by author and mark recommendation as read */
async function markRecommendationAsRead(
  recommendationId: string,
  readBookId: string
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.personalizedRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "MARKED_AS_READ" as const,
      readBookId,
    },
  });
}

/** Hook to handle the mark-as-read selection logic */
function useMarkAsRead(items: PersonalizedRecommendation[]) {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState<boolean>(false);
  const [completedBooks, setCompletedBooks] = useState<
    Array<{ id: string; title: string }>
  >([]);

  const handleMarkAsRead = useCallback(
    async (book: PersonalizedRecommendation) => {
      const { getCurrentUser } = await import("@/lib/auth");
      const { prisma } = await import("@/lib/prisma");

      const user = await getCurrentUser();
      if (!user) {
        alert("User not authenticated");
        return;
      }

      const author = book.author;
      const books = await prisma.book.findMany({
        where: {
          userId: user.id,
          author: { name: author },
          status: "COMPLETED",
        },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      });

      if (books.length === 0) {
        alert(`No completed books found by "${author}" in your library.`);
        return;
      }

      if (books.length === 1) {
        await markRecommendationAsRead(book.id, books[0].id);
        alert(`Marked "${books[0].title}" as read for recommendation`);
        return;
      }

      setSelectedBookId("multiple");
      setShowSelector(true);
    },
    [items]
  );

  const confirmSelection = useCallback(
    async (bookId: string) => {
      const recId = items.length > 0 ? items[items.length - 1].id : "";
      setShowSelector(false);
      setSelectedBookId(bookId);
      await markRecommendationAsRead(recId, bookId);
      alert("Book marked as read");
    },
    [items]
  );

  const closeSelector = useCallback(() => {
    setShowSelector(false);
    setSelectedBookId(null);
    setCompletedBooks([]);
  }, []);

  return {
    handleMarkAsRead,
    showSelector,
    selectedBookId,
    confirmSelection,
    closeSelector,
  };
}
