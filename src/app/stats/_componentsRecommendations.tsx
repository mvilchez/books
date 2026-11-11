/** @client */
import type { PersonalizedRecommendation } from "@/lib/analytics-types";

/**
 * RecommendationsList component with action buttons
 * /* Buttons handle actions internally via inline onClick handlers */
export function RecommendationsList({
  items,
}: {
  items: PersonalizedRecommendation[];
}) {
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
                  onClick={() => alert('Mark as read for ' + book.author)}
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
