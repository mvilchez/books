"use client"

import Image from "next/image";
import Link from "next/link";
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

function getNationalityFlagUrl(countryCode: string | null | undefined): string | null {
  if (!countryCode) return null;
  const code = countryCode.toUpperCase().trim();
  // Validate ISO 3166-1 alpha-2 format (two uppercase letters)
  if (!/^[A-Z]{2}$/.test(code)) return null;
  // Use flagcdn.com for country flags
  return `/flags/${code.toLowerCase()}.svg`;
}

function getUnFlagUrl(): string {
  return "/flags/un.svg";
}

function trustedPortraitUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isCommonsImage =
      url.hostname === "thumb.wikimedia.org" && url.pathname.startsWith("/wikipedia/commons/thumb/");
    const isOpenLibraryImage =
      url.hostname === "covers.openlibrary.org" && /^\/a\/id\/\d+-[SML]\\.jpg$/.test(url.pathname);
    return url.protocol === "https:" && (isCommonsImage || isOpenLibraryImage) ? url.toString() : null;
  } catch {
    return null;
  }
}

function trustedOpenLibrarySourceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "openlibrary.org" && /^\/authors\/OL\d+A$/.test(url.pathname)
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
    return url.protocol === "https:" && url.hostname === "commons.wikimedia.org" && url.pathname.startsWith("/wiki/File:")
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
  searchLink = true,
  nationality,
}: {
  author: PortraitAuthor;
  size?: "small" | "large";
  links?: boolean;
  nationality?: string;
  searchLink?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const sourceUrl = trustedCommonsSourceUrl(author.portraitSourceUrl);
  const openLibrarySourceUrl = trustedOpenLibrarySourceUrl(author.portraitSourceUrl);
  const licenseUrl = trustedHttpsLink(author.portraitLicenseUrl);
  const hasAttribution = openLibrarySourceUrl !== null ||
    (!!sourceUrl && !!author.portraitArtist?.trim() && !!author.portraitLicense?.trim());
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

  const nationalityFlagUrl = getNationalityFlagUrl(nationality);

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
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{initials || "?"}</span>
        )}
      </div>
      <figcaption className="min-w-0">
        {searchLink ? (
          <Link
            href={`/search?q=${encodeURIComponent(author.name)}`}
            className="block truncate text-sm font-semibold text-slate-200 hover:text-emerald-300"
            aria-label={`Search all books by ${author.name}`}
          >
            {author.name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold text-slate-200">
            {author.name}
          </span>
        )}
        {nationalityFlagUrl ? (
          <img
            src={nationalityFlagUrl}
            alt={`Nationality: ${nationality || "Unknown"}`
            }
            width={isLarge ? 20 : 16}
            height={isLarge ? 20 : 16}
            className="ms-2 align-middle"
          />
        ) : nationality ? (
          <img
            src={getUnFlagUrl()}
            alt="Nationality: Unknown"
            width={isLarge ? 20 : 16}
            height={isLarge ? 20 : 16}
            className="ms-2 align-middle"
          />
        ) : null}
        {openLibrarySourceUrl ? (
          <div className="ms-2 align-middle">
            <Link
              href={openLibrarySourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-slate-400 underline decoration-slate-500 underline-offset-2 hover:text-emerald-300"
            >
              View on OpenLibrary
            </Link>
          </div>
        ) : null}
        {portraitUrl && openLibrarySourceUrl ? (
          links ? (
            <a
              href={openLibrarySourceUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-[10px] text-slate-400 underline decoration-slate-500 underline-offset-2 hover:text-emerald-300"
            >
              Photo via Open Library
            </a>
          ) : (
            <span className="block truncate text-[10px] text-slate-400">
              Photo via Open Library
            </span>
          )
        ) : portraitUrl && sourceUrl && author.portraitArtist && author.portraitLicense ? (
          <span className="block truncate text-[10px] text-slate-400">
            Photo: {" "}
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
            {" · "}{links && licenseUrl ? (
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