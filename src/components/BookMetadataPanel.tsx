"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BookTagCategory, BookTagSource } from "@prisma/client";
import { enrichBookMetadata } from "@/app/actions/openLibraryImageActions";
import { deleteBookTag } from "@/app/actions/openLibraryImageActions";
import ManualSubjectTags from "@/components/ManualSubjectTags";

const categoryLabels: Record<BookTagCategory, string> = {
  GENRE: "Genre",
  FORMAT: "Format",
  LANGUAGE: "Language",
  SUBJECT: "Subject",
  MOOD: "Mood",
};

type BookMetadataTag = {
  id: string;
  category: BookTagCategory;
  name: string;
  source: BookTagSource;
};

export default function BookMetadataPanel({
  bookId,
  title,
  author,
  metadataCheckedAt,
  publicationYear,
  totalPages,
  bookFormat,
  isbn13,
  seriesName,
  seriesPosition,
  tags,
  existingSubjectTags,
}: {
  bookId: string;
  title: string;
  author: string;
  metadataCheckedAt: string | null;
  publicationYear: number | null;
  totalPages: number | null;
  bookFormat: string | null;
  isbn13: string | null;
  seriesName: string | null;
  seriesPosition: number | null;
  tags: BookMetadataTag[];
  existingSubjectTags: { id: string; name: string }[];
}) {
  const router = useRouter();
  const lookupKey = `${bookId}:${title}:${author}`;
  const attemptedLookupKey = useRef<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState(
    metadataCheckedAt ? "Open Library metadata has been checked." : "Checking Open Library metadata…",
  );
  const [lookupFailed, setLookupFailed] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [tagDeleteMessage, setTagDeleteMessage] = useState("");

  useEffect(() => {
    if (metadataCheckedAt || attemptedLookupKey.current === lookupKey) return;
    attemptedLookupKey.current = lookupKey;
    let active = true;
    void enrichBookMetadata(bookId)
      .then((result) => {
        if (!active) return;
        if (result.status === "error") {
          setLookupFailed(true);
          setLookupMessage(result.message);
          return;
        }
        setLookupMessage(result.data.message);
        router.refresh();
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLookupFailed(true);
        setLookupMessage(
          error instanceof Error
            ? error.message
            : "Open Library metadata lookup failed.",
        );
      });
    return () => {
      active = false;
    };
  }, [bookId, lookupKey, metadataCheckedAt, router]);

  const uniqueTags = [
    ...new Map(
      [...tags]
        .sort(
          (left, right) =>
            Number(right.source === "LIBRARY" && right.category === "SUBJECT") -
            Number(left.source === "LIBRARY" && left.category === "SUBJECT"),
        )
        .map((tag) => [`${tag.source}:${tag.category}:${tag.id}`, tag]),
    ).values(),
  ];
  const groupedTags = uniqueTags.reduce<Map<BookTagCategory, BookMetadataTag[]>>(
    (groups, tag) => groups.set(tag.category, [...(groups.get(tag.category) ?? []), tag]),
    new Map(),
  );

  async function deleteTag(tag: BookMetadataTag) {
    const tagKey = `${tag.source}:${tag.category}:${tag.id}`;
    setDeletingTagId(tagKey);
    setTagDeleteMessage("");
    try {
      const result = await deleteBookTag(bookId, tag.id, tag.source);
      if (result.status === "error") {
        setTagDeleteMessage(result.message);
        return;
      }
      setTagDeleteMessage(result.message ?? "Tag removed from this book.");
      router.refresh();
    } catch (error) {
      setTagDeleteMessage(
        error instanceof Error ? error.message : "Could not remove the tag.",
      );
    } finally {
      setDeletingTagId(null);
    }
  }

  return (
    <section
      aria-labelledby="book-metadata-heading"
      className="mt-8 rounded-xl border border-slate-700/60 bg-slate-900/50 p-5"
    >
      <h2 id="book-metadata-heading" className="text-lg font-bold text-white">
        Book metadata &amp; tags
      </h2>
      <p className="mt-1 text-sm text-slate-400" role="status">
        {lookupMessage}
      </p>
      {lookupFailed && (
        <p className="mt-1 text-xs text-slate-500">
          The lookup will retry the next time this page is opened.
        </p>
      )}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <MetadataField label="Published" value={publicationYear} />
        <MetadataField label="Pages" value={totalPages} />
        <MetadataField label="Format" value={bookFormat} />
        <MetadataField label="ISBN-13" value={isbn13} />
        <MetadataField
          label="Series"
          value={
            seriesName
              ? `${seriesName}${seriesPosition === null ? "" : ` · ${seriesPosition}`}`
              : null
          }
        />
      </dl>
      {groupedTags.size > 0 ? (
        <div className="mt-5 space-y-4">
          {[...groupedTags].map(([category, categoryTags]) => (
            <div key={category}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {categoryLabels[category]}
              </h3>
              <div className="flex flex-wrap gap-2">
                {categoryTags.map((tag) => (
                  <span
                    key={`${tag.source}:${category}:${tag.id}`}
                    className={`relative inline-flex items-center gap-1 rounded-full border py-0.5 pl-3 pr-1 text-xs ${
                      tag.source === "OPEN_LIBRARY"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                        : tag.category === "SUBJECT"
                          ? "border-violet-500/30 bg-violet-500/10 text-violet-200"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    <Link
                      href={`/tags/${encodeURIComponent(tag.id)}`}
                      className="py-0.5 hover:underline"
                    >
                      {tag.name}
                    </Link>
                    <button
                      type="button"
                      disabled={deletingTagId !== null}
                      onClick={() => void deleteTag(tag)}
                      aria-label={`Remove ${tag.name} (${tag.source.toLowerCase()}) tag from this book`}
                      title={`Remove ${tag.source === "OPEN_LIBRARY" ? "Open Library" : "library"} tag from this book`}
                      className="absolute -right-1.5 -top-2 flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-[10px] font-bold text-slate-300 shadow transition hover:border-rose-400 hover:bg-rose-500 hover:text-white disabled:cursor-wait disabled:opacity-50"
                    >
                      {deletingTagId === `${tag.source}:${tag.category}:${tag.id}`
                        ? "…"
                        : "×"}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          Tags will appear when library or online metadata is available.
        </p>
      )}
      {tagDeleteMessage ? (
        <p role="status" className="mt-3 text-xs text-slate-400">
          {tagDeleteMessage}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Blue tags are from Open Library, green tags are library genres/formats, and violet subject tags are manually maintained.
      </p>
      <ManualSubjectTags
        bookId={bookId}
        currentTags={tags
          .filter((tag) => tag.source === "LIBRARY" && tag.category === "SUBJECT")
          .map((tag) => tag.name)}
        existingTags={existingSubjectTags}
      />
    </section>
  );
}

function MetadataField({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-200">{value ?? "—"}</dd>
    </div>
  );
}
