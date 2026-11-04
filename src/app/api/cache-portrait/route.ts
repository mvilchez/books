import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import {
  getOpenLibraryAuthorPhotoUrl,
  getOpenLibraryAuthorUrl,
  getLocalPortraitPath,
} from "@/lib/open-library-images";

export async function GET(
  request: Request,
) {
  const { searchParams } = new URL(request.url);
  const authorId = searchParams.get("authorId");
  const size = (searchParams.get("size") as "S" | "M" | "L") ?? "S";

  if (!authorId) {
    return new NextResponse("Missing authorId parameter", { status: 400 });
  }

  // Download from Open Library
  try {
    let photoUrl: string | null = null;
    let sourceUrl: string | null = null;

    const numericAuthorId = Number(authorId);
    if (authorId.startsWith("Q")) {
      // Wikidata ID - use Open Library to get the photo
      photoUrl = getOpenLibraryAuthorPhotoUrl(numericAuthorId, size);
      sourceUrl = getOpenLibraryAuthorUrl(authorId);
    } else {
      // Assume it's an Open Library author ID
      photoUrl = getOpenLibraryAuthorPhotoUrl(numericAuthorId, size);
      sourceUrl = getOpenLibraryAuthorUrl(authorId);
    }

    if (!photoUrl) {
      return new NextResponse("No photo available", { status: 404 });
    }

    // Try to extract photoId from URL for dedup
    const photoIdMatch = photoUrl.match(/\/a\/id\/(\d+)-/);
    const resolvedPhotoId = photoIdMatch ? Number(photoIdMatch[1]) : null;

    // Check local cache (WebP first, then JPG)
    if (resolvedPhotoId !== null) {
      const webpPath = getLocalPortraitPath(resolvedPhotoId, size);
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

    // Download the image
    const response = await fetch(photoUrl);
    if (!response.ok) return new NextResponse("Failed", { status: 500 });

    const buffer = await response.arrayBuffer();

    // Convert to WebP
    const sharp = (await import("sharp")).default;
    const webpBuffer = await sharp(Buffer.from(buffer)).webp({ quality: 75 }).toBuffer();

    // Save to local cache
    if (resolvedPhotoId !== null) {
      const dir = path.join("public", "portraits");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const filePath = getLocalPortraitPath(resolvedPhotoId, size);
      fs.writeFileSync(filePath, webpBuffer);
    }

    return new NextResponse(webpBuffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    console.error("Cache portrait error:", error);
    return new NextResponse("Error", { status: 500 });
  }
}