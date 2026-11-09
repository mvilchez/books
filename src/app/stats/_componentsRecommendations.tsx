/** @client */
import type { PersonalizedRecommendation } from "@/lib/analytics-types";

/**
 * RecommendationsList component with action buttons
 * Actions are handled by callback functions passed from the parent component
 * If no handlers are provided, buttons are disabled
 */
export function RecommendationsList({
  items,
  onDelete,
  onRefresh,
  onMarkRead,
}: {
  items: PersonalizedRecommendation[];
  onDelete?: (id: string) => void;
  onRefresh?: () => void;
  onMarkRead?: (id: string) => void;
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
                {/* Delete button - removes from recommendations */}
                <button
                  onClick={onDelete ? () => onDelete(book.id) : undefined}
                  className="rounded-md border border-slate-700/30 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-colors"
                  disabled={!onDelete}
                >
                  Delete
                </button>
                {/* Refresh button - get 5 new recommendations */}
                <button
                  onClick={onRefresh ? () => onRefresh() : undefined}
                  className="rounded-md border border-slate-700/30 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-colors"
                  disabled={!onRefresh}
                >
                  Refresh
                </button>
                {/* Mark as read button - same book, different workId */}
                <button
                  onClick={onMarkRead ? () => onMarkRead(book.id) : undefined}
                  className="rounded-md border border-slate-700/30 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-900 transition-colors"
                  disabled={!onMarkRead}
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
