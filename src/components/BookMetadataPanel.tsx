"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookTagCategory } from "@prisma/client";
import { enrichBookMetadata } from "@/app/actions/openLibraryImageActions";

const categoryLabels: Record<BookTagCategory, string> = {
  GENRE: "Genre",
  FORMAT: "Format",
  LANGUAGE: "Language",
  SUBJECT: "Subject",
  MOOD: "Mood",
};

type BookMetadataTag = {
  category: BookTagCategory;
  name: string;
  source: "LIBRARY" | "OPEN_LIBRARY";
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
}) {
  const router = useRouter();
  const lookupKey = `${bookId}:${title}:${author}`;
  const attemptedLookupKey = useRef<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState(
    metadataCheckedAt ? "Open Library metadata has been checked." : "Checking Open Library metadata…",
  );
  const [lookupFailed, setLookupFailed] = useState(false);

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

  const groupedTags = tags.reduce<Map<BookTagCategory, BookMetadataTag[]>>(
    (groups, tag) => groups.set(tag.category, [...(groups.get(tag.category) ?? []), tag]),
    new Map(),
  );

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
                    key={`${tag.source}:${category}:${tag.name}`}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      tag.source === "OPEN_LIBRARY"
                        ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                    }`}
                  >
                    {tag.name}
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
      <p className="mt-4 text-xs text-slate-500">
        Blue tags are sourced from Open Library; green tags come from your library.
      </p>
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
