import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { getBookCoverUrl, getLocalCoverPath, localCoverExists } from "@/lib/book-cover";

export async function GET(
  request: Request,
) {
  const { searchParams } = new URL(request.url);
  const editionKey = searchParams.get("editionKey");
  const coverIdParam = searchParams.get("coverId");
  const size = (searchParams.get("size") as "S" | "M" | "L") ?? "S";

  let openLibraryCoverId: number | null = null;

  if (coverIdParam) {
    const parsed = Number(coverIdParam);
    if (Number.isSafeInteger(parsed) && parsed > 0) {
      openLibraryCoverId = parsed;
    }
  } else if (editionKey) {
    const isbn = editionKey.match(/^isbn:([0-9a-z]{10,13})$/i)?.[1];
    if (isbn) {
      // ISBN-only lookup: we can't resolve coverId from ISBN without a network call
      // Fall back to downloading directly
      openLibraryCoverId = null;
    }
  }

  if (!editionKey && !openLibraryCoverId) {
    return new NextResponse("Missing editionKey or coverId parameter", { status: 400 });
  }

  // Try WebP first, then JPG
  if (openLibraryCoverId !== null) {
    const webpPath = getLocalCoverPath(openLibraryCoverId, size);
    const jpgPath = webpPath.replace(".webp", ".jpg");

    if (fs.existsSync(webpPath)) {
      const img = fs.readFileSync(webpPath);
      return new NextResponse(img, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    }

    if (fs.existsSync(jpgPath)) {
      const img = fs.readFileSync(jpgPath);
      return new NextResponse(img, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    }
  }

  // Download from Open Library
  try {
    const coverUrl = getBookCoverUrl(editionKey ?? "", openLibraryCoverId ?? undefined, size);
    if (!coverUrl) return new NextResponse("Not found", { status: 404 });

    const response = await fetch(coverUrl);
    if (!response.ok) return new NextResponse("Failed", { status: 500 });

    const buffer = await response.arrayBuffer();

    // Convert to WebP
    const sharp = (await import("sharp")).default;
    const webpBuffer = await sharp(Buffer.from(buffer)).webp({ quality: 75 }).toBuffer();

    // Save to local cache
    if (openLibraryCoverId !== null) {
      const dir = path.join("public", "covers");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = getLocalCoverPath(openLibraryCoverId, size);
      fs.writeFileSync(filePath, webpBuffer);
    }

    return new NextResponse(webpBuffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    console.error("Cache cover error:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
