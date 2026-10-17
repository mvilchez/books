import Link from "next/link";
import { Suspense } from "react";
import SimilarTagReview from "@/components/SimilarTagReview";
import { getUsedTags } from "@/lib/tags";
import { findSimilarTagPairs } from "@/lib/tag-similarity";

export default function ManageTagsPage() {
  return (
    <Suspense fallback={<TagsSkeleton />}>
      <ManageTagsContent />
    </Suspense>
  );
}

async function ManageTagsContent() {
  const tags = await getUsedTags();
  const tagsByCategory = new Map<string, typeof tags>();
  for (const tag of tags) {
    tagsByCategory.set(tag.category, [
      ...(tagsByCategory.get(tag.category) ?? []),
      tag,
    ]);
  }
  const uniqueSuggestions = [...tagsByCategory.values()].flatMap((categoryTags) =>
    findSimilarTagPairs(
      categoryTags.map(({ id, name, count }) => ({ id, name, count })),
    ),
  );

  return (
    <main className="min-h-screen bg-slate-900 p-6 text-slate-100 md:p-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
        >
          ← Back to library
        </Link>
        <header className="border-b border-slate-800 pb-5">
          <h1 className="text-3xl font-extrabold text-white">Review similar tags</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Possible duplicates are suggested by spelling and word similarity
            within the same category. Review each pair before merging; similar
            words do not always mean the same thing. Merging moves all book links
            to the retained tag and removes the other tag.
          </p>
        </header>
        <p className="text-sm text-slate-400">
          {uniqueSuggestions.length} possible duplicate pairs found across{" "}
          {tags.length} tags.
        </p>
        <SimilarTagReview pairs={uniqueSuggestions} />
      </div>
    </main>
  );
}

function TagsSkeleton() {
  return (
    <main
      className="min-h-screen animate-pulse bg-slate-900 p-6 text-slate-100 md:p-12"
      aria-busy="true"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-6 w-40 rounded bg-slate-800" />
        <div className="h-24 rounded-xl bg-slate-800" />
        <div className="h-72 rounded-xl bg-slate-800" />
      </div>
    </main>
  );
}
