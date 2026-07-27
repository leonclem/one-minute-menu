# Patch — Direct-to-Supabase Upload (2026-07-27)

**Type:** Independent patch (not a requirements phase / chunk).

**Requirements refs (adjacent):** §7.2 (studio image persistence), §10 Phase 4 (extract/mutate pipeline).

**Branch:** `main` (no feature branch — per LC decision 2026-07-27)

**Deploy status:** Built locally — **not yet in production** (discovered need after
2026-07-24 Chunk 5 prod deploy; commit unmerged/uncommitted as of 2026-07-27).

**Goal:** Fix production 413 errors when uploading source images larger than ~3 MB effective
limit. Route file bytes directly from the browser to Supabase Storage (bypassing Vercel's
hard 4.5 MB function body limit), then pass `imageId` references through Studio API routes.
Raise the studio upload limit to **9 MiB**.

## Problem

Studio routes previously sent full base64 images inside JSON through Vercel. A 5 MB PNG
inflates to ~6.7 MB on the wire and is rejected with HTTP 413 before app code runs.

## Solution

```text
Browser → Supabase Storage (binary, up to 9 MiB)
Browser → POST /api/studio/source   { imageId, dishId, mimeType }
Browser → POST /api/studio/extract  { imageId }
Browser → POST /api/studio/mutate   { sourceImageId, ... }
Server  → downloads bytes from storage for Gemini calls
```

## Scope

### 1. Shared limit (9 MiB)

- `PHOTO_CONTROL_MAX_IMAGE_BYTES = 9 * 1024 * 1024` in `request-validation.ts`
- `image-uploader.ts` imports shared constant; adds `validateImageFileForUpload()` for
  file-only checks (no data URL required)

### 2. Server helpers

- `src/lib/studio/storage-paths.ts` — path/extension helpers
- `src/lib/studio/image-bytes.ts` — `loadStudioImageBytes()`, `downloadStudioStorageObject()`
- `registerStudioSourceImage()` in `persistence.ts` for client-pre-uploaded sources

### 3. Client upload

- `src/lib/studio/client-upload.ts` — `uploadStudioSourceFile()` via browser Supabase client

### 4. API routes

- `/api/studio/source` — `{ imageId, dishId, mimeType }` (no base64)
- `/api/studio/extract` — `{ imageId }`
- `/api/studio/mutate` — `sourceImageId` required; loads bytes server-side

### 5. FOH client

- `studio-client.tsx` — upload → register → extract flow; mutate by `sourceImageId`;
  gallery re-extract without re-downloading base64 into JSON

### 6. Out of scope

- Admin Photo Control sandbox (`/admin/photo-control`) — still uses base64 JSON

## Production deploy

No new migration or env var. Existing `ai-generated-images` bucket (10 MiB) and RLS
policies already support `{userId}/studio/{imageId}.{ext}` uploads.

## Manual test plan

1. Upload a 5–9 MiB PNG on `/studio` — no 413
2. Extraction populates controls
3. Generate a variant — no 413 on mutate
4. Re-open dish from gallery — hydrates without re-posting image bytes
5. File > 9 MiB — rejected client-side before upload
