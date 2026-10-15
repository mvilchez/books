"use client";

import Image from "next/image";
import { useState } from "react";
import type { Author } from "@prisma/client";

type PortraitAuthor = Pick<
  Author,
  | "name"
  | "portraitUrl"
  | "portraitSourceUrl"
  | "portraitArtist"
  | "portraitLicense"
  | "portraitLicenseUrl"
>;

function trustedPortraitUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "thumb.wikimedia.org" &&
      url.pathname.startsWith("/wikipedia/commons/thumb/")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function trustedCommonsSourceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "commons.wikimedia.org" &&
      url.pathname.startsWith("/wiki/File:")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function trustedHttpsLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function AuthorPortrait({
  author,
  size = "small",
  links = true,
}: {
  author: PortraitAuthor;
  size?: "small" | "large";
  links?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const sourceUrl = trustedCommonsSourceUrl(author.portraitSourceUrl);
  const licenseUrl = trustedHttpsLink(author.portraitLicenseUrl);
  const hasAttribution =
    !!sourceUrl &&
    !!author.portraitArtist?.trim() &&
    !!author.portraitLicense?.trim();
  const portraitUrl =
    imageFailed || !hasAttribution
      ? null
      : trustedPortraitUrl(author.portraitUrl);
  const isLarge = size === "large";
  const initials = author.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase("es");

  return (
    <figure className="flex min-w-0 items-center gap-3">
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-600 bg-slate-700 text-xs font-bold text-slate-200 ${
          isLarge ? "h-16 w-16" : "h-10 w-10"
        }`}
      >
        {portraitUrl ? (
          <Image
            src={portraitUrl}
            alt={`Portrait of ${author.name}`}
            width={isLarge ? 64 : 40}
            height={isLarge ? 64 : 40}
            sizes={isLarge ? "64px" : "40px"}
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{initials || "?"}</span>
        )}
      </div>
      <figcaption className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-200">
          {author.name}
        </span>
        {portraitUrl && sourceUrl && author.portraitArtist && author.portraitLicense ? (
          <span className="block truncate text-[10px] text-slate-400">
            Photo:{" "}
            {links ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-500 underline-offset-2 hover:text-emerald-300"
              >
                {author.portraitArtist}
              </a>
            ) : (
              <span>{author.portraitArtist}</span>
            )}
            {" · "}
            {links && licenseUrl ? (
              <a
                href={licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-slate-500 underline-offset-2 hover:text-emerald-300"
              >
                {author.portraitLicense}
              </a>
            ) : (
              <span>{author.portraitLicense}</span>
            )}
            {" · Wikimedia Commons"}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
