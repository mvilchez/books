"use client";

import Image from "next/image";
import { useState } from "react";
import { getBookCoverUrl } from "@/lib/book-cover";

export default function BookCover({
  editionKey,
  openLibraryCoverId = null,
  title,
  size = "small",
}: {
  editionKey: string;
  openLibraryCoverId?: number | null;
  title: string;
  size?: "small" | "large";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const coverUrl = getBookCoverUrl(editionKey, openLibraryCoverId);
  const isLarge = size === "large";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-600/70 bg-gradient-to-br from-slate-700 to-slate-900 text-center ${
        isLarge ? "h-72 w-48" : "h-20 w-14"
      }`}
    >
      {coverUrl && !imageFailed ? (
        <Image
          src={coverUrl}
          alt={`Cover of ${title}`}
          fill
          sizes={isLarge ? "192px" : "56px"}
          loading="lazy"
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`line-clamp-4 px-2 font-semibold leading-snug text-slate-300 ${
            isLarge ? "text-base" : "text-[9px]"
          }`}
        >
          {title}
        </span>
      )}
    </div>
  );
}
