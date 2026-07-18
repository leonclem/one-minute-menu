# Build Plan — Chunk 2: Customer-Facing /studio Shell

**Requirements refs:** §7.1, §9.5, §10 Phase 1, §14 first build ticket.

**Branch:** `studio/chunk-02-studio-shell`

**Goal:** Authenticated user can upload a food photo, stage simple edits, generate a
transformed output via the existing photo-control pipeline, persist it against their
account, and download it — behind `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO`.

## Decisions for this chunk

- Minimal persistence: single `studio_images` table (projects/dishes deferred to Chunk 3).
- Nav-only prominence: add Studio to header; leave post-login landing unchanged.
- FOH omits camera/composition controls and model selector in this shell.
- Pre-credits cost guard: `STUDIO_DAILY_GENERATION_LIMIT` (default 25).

## Scope

1. Migration `070_studio_images.sql` + RLS; persist to `ai-generated-images/{userId}/studio/…`.
2. `requireUserApi`, shared request-validation, `/api/studio/extract` + `/api/studio/mutate`.
3. Move reusable controls to `src/components/photo-controls/`.
4. `/studio` page + client (flag/auth/approval gates, gallery, download).
5. Studio nav link + env examples.
6. Tests + tracker updates.

## Acceptance criteria

- [x] `/studio` exists, gated by `isPhotoStudioEnabled()` (404 when off).
- [x] Authenticated user can upload, stage lighting/garnish/sides, generate.
- [x] Output displayed and saved in `studio_images` + storage.
- [x] Output can be downloaded; recent gallery loads across sessions.
- [x] Admin Photo Control still works (controls moved to shared folder; APIs unchanged behaviourally).
- [x] Studio appears in nav when flag enabled; post-login landing unchanged.
- [x] Tests pass; tracker updated.
