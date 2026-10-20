"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Representative saga image: a collage of up to four saved Open Library
 * covers for the saga. Purely local data — no extra fetch per card. When the
 * saga has no saved covers, a gradient panel with the saga initial renders.
 */
export default function SagaCardCover({
  sagaName,
  coverIds,
}: {
  sagaName: string;
  coverIds: number[];
}) {
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const visible = coverIds.filter((id) => !failed.has(id)).slice(0, 4);
  const markFailed = (id: number) =>
    setFailed((previous) => new Set(previous).add(id));

  return (
    <div
      className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900"
      aria-hidden={visible.length > 0}
    >
      {visible.length > 0 ? (
        <div
          className={`grid h-full w-full ${
            visible.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {visible.map((id) => (
            <div key={id} className="relative min-h-0 min-w-0">
              <Image
                src={`https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                unoptimized
                loading="lazy"
                className="object-cover"
                onError={() => markFailed(id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <span className="text-5xl font-extrabold text-slate-600">
          {sagaName.trim().charAt(0).toUpperCase() || "§"}
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900/70 to-transparent" />
    </div>
  );
}
