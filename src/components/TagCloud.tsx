import Link from "next/link";
import type { BookTagCategory } from "@prisma/client";

const categoryLabels: Record<BookTagCategory, string> = {
  GENRE: "Genre",
  FORMAT: "Format",
  LANGUAGE: "Language",
  SUBJECT: "Subject",
  MOOD: "Mood",
};

export type TagCloudItem = {
  id: string;
  name: string;
  category: BookTagCategory;
  count: number;
};

export default function TagCloud({
  tags,
  maximumVisible = 20,
}: {
  tags: TagCloudItem[];
  maximumVisible?: number;
}) {
  if (tags.length === 0) return null;

  const visibleTags = tags.slice(0, maximumVisible);
  const maximumCount = Math.max(...visibleTags.map((tag) => tag.count));
  const minimumCount = Math.min(...visibleTags.map((tag) => tag.count));

  return (
    <section
      aria-labelledby="library-tags-heading"
      className="rounded-xl border border-slate-800 bg-slate-800/50 p-5"
    >
      <h2 id="library-tags-heading" className="text-lg font-bold text-white">
        Library tags
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        Genres and metadata tags across your books.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {visibleTags.map((tag) => {
          const scale =
            maximumCount === minimumCount
              ? 1
              : (tag.count - minimumCount) / (maximumCount - minimumCount);
          return (
            <Link
              href={`/tags/${encodeURIComponent(tag.id)}`}
              key={tag.id}
              title={`${categoryLabels[tag.category]} · ${tag.count} ${tag.count === 1 ? "book" : "books"}`}
              className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-medium text-emerald-200 hover:border-emerald-400/60 hover:bg-emerald-500/20"
              style={{ fontSize: `${0.75 + scale * 0.3}rem` }}
            >
              {tag.name}
              <span className="ml-1.5 text-xs text-slate-400">{tag.count}</span>
            </Link>
          );
        })}
      </div>
      {tags.length > visibleTags.length ? (
        <p className="mt-3 text-xs text-slate-500">
          Showing the {visibleTags.length} most frequent tags of {tags.length}.
          Visit a tag to browse its books.
        </p>
      ) : null}
    </section>
  );
}
