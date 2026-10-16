"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mergeSimilarTags } from "@/app/actions/openLibraryImageActions";
import type { SimilarTagPair } from "@/lib/tag-similarity";

type TagSummary = { id: string; name: string; count: number };
type ReviewPair = SimilarTagPair<TagSummary>;

export default function SimilarTagReview({ pairs }: { pairs: ReviewPair[] }) {
  const router = useRouter();
  const [pendingPair, setPendingPair] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function mergeTags(keep: TagSummary, mergeTag: TagSummary) {
    const pairKey = `${keep.id}:${mergeTag.id}`;
    setPendingPair(pairKey);
    setMessage("");
    try {
      const result = await mergeSimilarTags(keep.id, mergeTag.id);
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      setMessage(`${mergeTag.name} was merged into ${keep.name}.`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not merge the tags.",
      );
    } finally {
      setPendingPair(null);
    }
  }

  if (pairs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
        No likely duplicate tag names were found. Suggestions are approximate;
        review before merging because similar names can have different meanings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pairs.map(({ first, second, similarity }) => {
        const keep =
          first.count > second.count ||
          (first.count === second.count &&
            first.name.length <= second.name.length)
            ? first
            : second;
        const merge = keep.id === first.id ? second : first;
        const key = `${keep.id}:${merge.id}`;
        return (
          <article
            key={[first.id, second.id].sort().join(":")}
            className="rounded-xl border border-slate-700 bg-slate-800/60 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">
                  {first.name} <span className="text-slate-500">↔</span> {second.name}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {Math.round(similarity * 100)}% name similarity · {first.count} and{" "}
                  {second.count} books
                </p>
              </div>
              <button
                type="button"
                disabled={pendingPair !== null}
                onClick={() => void mergeTags(keep, merge)}
                className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
              >
                {pendingPair === key
                  ? "Merging…"
                  : `Merge “${merge.name}” into “${keep.name}”`}
              </button>
            </div>
          </article>
        );
      })}
      {message ? (
        <p role="status" className="text-sm text-slate-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
