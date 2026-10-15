export type AuthorPortraitIdentity = {
  id: string;
  name: string;
};

export type WikidataPortraitCandidate = {
  authorId: string;
  authorName: string;
  wikidataId: string;
  fileName: string;
};

export type VerifiedAuthorPortrait = {
  authorId: string;
  authorName: string;
  wikidataId: string;
  portraitUrl: string;
  portraitSourceUrl: string;
  portraitArtist: string;
  portraitLicense: string;
  portraitLicenseUrl: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function nameKey(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function parseWikidataSearchMatch(
  value: unknown,
  author: AuthorPortraitIdentity,
): string | null {
  const root = record(value);
  const apiError = record(root?.error);
  if (apiError) {
    const code = typeof apiError.code === "string" ? apiError.code : "unknown";
    const info = typeof apiError.info === "string" ? apiError.info : "no details";
    throw new Error(`Wikidata API error (${code}): ${info}`);
  }
  const rawResults = root?.search;
  if (!Array.isArray(rawResults)) {
    throw new Error("Wikidata returned a malformed entity-search response.");
  }

  const exactMatches = new Map<string, string>();
  for (const rawResult of rawResults) {
    const result = record(rawResult);
    const id = result?.id;
    const label = result?.label;
    if (
      typeof id === "string" &&
      /^Q\d+$/.test(id) &&
      typeof label === "string" &&
      nameKey(label) === nameKey(author.name)
    ) {
      exactMatches.set(id, label);
    }
  }
  return exactMatches.size === 1 ? exactMatches.keys().next().value ?? null : null;
}

export function parseWikidataPortraitEntity(
  value: unknown,
  author: AuthorPortraitIdentity,
  wikidataId: string,
): WikidataPortraitCandidate | null {
  const root = record(value);
  const entities = record(root?.entities);
  const entity = record(entities?.[wikidataId]);
  const claims = record(entity?.claims);
  if (!claims) return null;

  const isHuman =
    Array.isArray(claims.P31) &&
    claims.P31.some((claim) => {
      const mainsnak = record(record(claim)?.mainsnak);
      const datavalue = record(mainsnak?.datavalue);
      const item = record(datavalue?.value);
      return item?.id === "Q5";
    });
  const imageClaims = Array.isArray(claims.P18)
    ? claims.P18
        .map((claim) => {
          const mainsnak = record(record(claim)?.mainsnak);
          const datavalue = record(mainsnak?.datavalue);
          return typeof datavalue?.value === "string" ? datavalue.value : null;
        })
        .filter((fileName): fileName is string => fileName !== null)
    : [];
  const distinctImages = [...new Set(imageClaims)];
  if (!isHuman || distinctImages.length !== 1) return null;

  return {
    authorId: author.id,
    authorName: author.name,
    wikidataId,
    fileName: distinctImages[0],
  };
}

function metadataValue(metadata: unknown, key: string): string | null {
  const entry = record(record(metadata)?.[key]);
  return typeof entry?.value === "string" ? entry.value : null;
}

function plainText(value: string | null): string {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /&#(?:x([0-9a-f]+)|(\d+));/gi,
      (_match, hex: string, decimal: string) => {
        const codePoint = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
        return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : " ";
      },
    )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function safeHttpsUrl(
  value: string | null,
  hostname: string,
  pathPrefix?: string,
  stripSearch = false,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== hostname ||
      (pathPrefix && !url.pathname.startsWith(pathPrefix))
    ) {
      return null;
    }
    if (stripSearch) {
      url.search = "";
      url.hash = "";
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function parseCommonsPortrait(
  value: unknown,
  candidate: WikidataPortraitCandidate,
): VerifiedAuthorPortrait | null {
  const root = record(value);
  const query = record(root?.query);
  const pages = record(query?.pages);
  if (!pages) throw new Error("Wikimedia Commons returned a malformed image response.");

  const expectedTitle = `File:${candidate.fileName}`
    .replace(/_/g, " ")
    .toLocaleLowerCase("en");
  const matchingPage = Object.values(pages).find((page) => {
    const title = record(page)?.title;
    return (
      typeof title === "string" &&
      title.replace(/_/g, " ").toLocaleLowerCase("en") === expectedTitle
    );
  });
  const page = record(matchingPage);
  const imageInfo = Array.isArray(page?.imageinfo) ? record(page.imageinfo[0]) : null;
  if (!imageInfo) return null;

  const portraitUrl = safeHttpsUrl(
    typeof imageInfo.thumburl === "string" ? imageInfo.thumburl : null,
    "thumb.wikimedia.org",
    "/wikipedia/commons/thumb/",
    true,
  );
  const portraitSourceUrl = safeHttpsUrl(
    typeof imageInfo.descriptionurl === "string" ? imageInfo.descriptionurl : null,
    "commons.wikimedia.org",
    "/wiki/File:",
  );
  const metadata = imageInfo.extmetadata;
  const portraitArtist =
    plainText(metadataValue(metadata, "Artist")) ||
    plainText(metadataValue(metadata, "Credit"));
  const portraitLicense = plainText(metadataValue(metadata, "LicenseShortName"));
  const rawLicenseUrl = metadataValue(metadata, "LicenseUrl");
  let portraitLicenseUrl: string | null = null;
  if (rawLicenseUrl) {
    try {
      const licenseUrl = new URL(rawLicenseUrl);
      if (licenseUrl.protocol === "https:") {
        portraitLicenseUrl = licenseUrl.toString();
      }
    } catch {
      portraitLicenseUrl = null;
    }
  }

  if (
    !portraitUrl ||
    !portraitSourceUrl ||
    !portraitArtist ||
    !portraitLicense
  ) {
    return null;
  }

  return {
    authorId: candidate.authorId,
    authorName: candidate.authorName,
    wikidataId: candidate.wikidataId,
    portraitUrl,
    portraitSourceUrl,
    portraitArtist,
    portraitLicense,
    portraitLicenseUrl,
  };
}
