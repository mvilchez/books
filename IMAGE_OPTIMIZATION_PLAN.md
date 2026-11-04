# Image Optimization Plan — Covers & Portraits

## Goal
Compress cached cover and portrait images while maintaining full operation:
- Show covers when needed (book lists, detail pages, search results)
- Show portraits when needed (author cards, detail pages)
- Save covers and portraits when needed (caching scripts, API routes on-demand download)

---

## Current State

| Asset | Count | Total Size | Avg per File | Format | Naming |
|-------|-------|------------|--------------|--------|--------|
| Covers | 468 | ~7.4 MB | ~16 KB | JPEG (`-S`) | `{bookId}.jpg?default=false` |
| Portraits | 39+ | ~144 KB | ~4 KB | JPEG (`-S`) | `{authorId}.jpg` (once fixed) |

**Problems:**
1. No deduplication — same Open Library cover/portrait stored multiple times under different local UUIDs
2. JPEG instead of WebP — ~30–40% larger than necessary
3. No responsive sizing — always `-S`, no option for `-M`/`-L` on detail pages
4. Orphaned files accumulate with no cleanup mechanism

---

## Phase 1: Deduplication + WebP Conversion

**Estimated savings:** 40–60%

### 1.1 Add `sharp` dependency
```bash
npm install sharp
```

### 1.2 Update `src/lib/book-cover.ts`
- Add `CoverSize` type (`"S" | "M" | "L"`)
- `getBookCoverUrl(editionKey, openLibraryCoverId, size)` — support `size` param (default `"S"`)
- `getLocalCoverPath(openLibraryCoverId, size)` — return `public/covers/ol{id}-{size}.webp`
- `localCoverExists(openLibraryCoverId, size)` — check filesystem

### 1.3 Update `src/lib/open-library-images.ts`
- `getOpenLibraryAuthorPhotoUrl(photoId, size)` — already supports `size` param, keep
- `getLocalPortraitPath(photoId, size)` — return `public/portraits/ol{id}-{size}.webp`
- `localPortraitExists(photoId, size)` — check filesystem

### 1.4 Update `src/scripts/cache-covers.ts`
- Filename: `ol${openLibraryCoverId}-S.webp` (dedup by Open Library ID, not book UUID)
- Convert downloaded JPEG to WebP via `sharp(buffer).webp({ quality: 75 }).toFile(...)`
- Skip if file already exists (idempotent)
- Keep `?default=false` stripped from filename

### 1.5 Update `src/scripts/cache-author-portraits.ts`
- Filename: `ol${photoId}-S.webp` (dedup by Open Library photo ID)
- Convert downloaded JPEG to WebP via `sharp`
- Skip if file already exists
- Already uses `searchOpenLibraryAuthorPhotos()` — keep that logic

### 1.6 Update `src/app/api/cache-cover/route.ts`
- Accept `editionKey` or cover ID via `searchParams`
- Resolve to Open Library cover ID
- Serve `.webp` if exists, else `.jpg`, else download+convert+serve
- Set `Cache-Control: public, max-age=86400, immutable`

### 1.7 Update `src/app/api/cache-portrait/route.ts`
- Accept `authorId` via `searchParams`
- Resolve to Open Library photo ID via profile lookup
- Serve `.webp` if exists, else `.jpg`, else download+convert+serve

### 1.8 Add `src/scripts/cleanup-cached-images.ts`
- List all files in `public/covers/` and `public/portraits/`
- Query DB for all referenced `openLibraryCoverId` and portrait `photoId` values
- Delete unreferenced files

---

## Phase 2: On-Demand Caching + Responsive Sizing

**Estimated savings:** Additional 20–30% on top of Phase 1

### 2.1 Responsive sizing in components
- Book cover components: use `-S` for lists/grids, `-M` for detail pages
- Author portrait: use `-S` for cards, `-M` for detail pages
- Pass `size` prop through to `getBookCoverUrl()` / `getOpenLibraryAuthorPhotoUrl()`

### 2.2 On-demand API caching (already implemented, enhance)
- `/api/cache-cover?coverId=12345&size=M` — download/convert/cache `-M` on first request
- `/api/cache-portrait?photoId=67890&size=M` — same for portraits
- Files stored as `ol{id}-{size}.webp` for deduplication across sizes

### 2.3 Update components to prefer local files
- `AuthorPortrait.tsx` — check `localPortraitExists()` first, use local path, fallback to `/api/cache-portrait`
- Book cover components — check `localCoverExists()` first, use local path, fallback to `/api/cache-cover`

### 2.4 Add content-addressable filenames (optional)
- `sha256(url)` as filename to detect Open Library image updates
- Fallback to ID-based naming if hash computation fails

---

## Phase 3: Advanced Optimizations (Future)

- AVIF support via `sharp`
- Blur-up / LQIP placeholders (tiny base64-encoded 8px images)
- Offload `public/covers/` and `public/portraits/` to S3/R2 for production

---

## Backward Compatibility

- Existing `.jpg` files continue to work (API routes fall back to JPG if WebP missing)
- No database schema changes required
- `npm run dev`, `npm run build`, `npm run lint`, `npm test` all remain clean
- `package.json` gains only `sharp` dependency
