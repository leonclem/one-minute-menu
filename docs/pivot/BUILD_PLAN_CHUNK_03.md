# Build Plan — Chunk 3: Image Library Per Dish

**Requirements refs:** §7.2, §7.3, §10 Phase 2.

**Branch:** `studio/chunk-03-dish-library`

**Goal:** Move Studio from a flat recent-images gallery to a dish-scoped image library:
create/select a dish, persist source + generated variants under it, pick a working image,
favourite one default, and archive/delete unwanted variants — still behind
`NEXT_PUBLIC_ENABLE_PHOTO_STUDIO`.

## Decisions proposed for this chunk

Record in the tracker Decisions log when implementing (or adjust if rejected):

1. **Dishes without projects (lean §7.2).** Ship `studio_dishes` owned by `user_id` only.
   Defer `photo_projects` / multi-project nesting until multi-client/agency workflows need it.
   Rationale: Chunk 2 already named tables `studio_*`; a project layer adds UI/API surface
   without MVP value for a single-operator library.
2. **Evolve `studio_images`, do not rename to `image_assets`.** Add `dish_id`,
   `is_favourite`, `archived_at` (and indexes). Keep existing storage paths and APIs working
   with additive columns. Avoid a parallel assets table and a painful rename migration while
   local/prod may already have Chunk 2 rows.
3. **Defer `image_edits` ledger.** Prompt/model/controls already live on `studio_images`
   (`prompt`, `model`, `metadata`). A dedicated edits table fits Phase 4 validation better.
4. **Stay on `/studio`.** Dish picker + per-dish gallery in the existing shell; no
   `/studio/projects/*` routes yet (route-group restructure remains incremental per tracker §9.4).
5. **Soft-archive by default for generated variants; hard-delete allowed.** Archive hides
   from the library; delete removes DB row + storage object. Source images used by
   generated children: prefer archive, or block hard-delete while children exist
   (implementation detail at build time — pick the safer of the two).

## Scope

### 1. Migration

Additive migration (e.g. `071_studio_dishes.sql`):

- `studio_dishes`: `id`, `user_id`, `name`, `description` (nullable), `created_at`,
  `updated_at`; RLS (select/insert/update/delete own rows).
- Alter `studio_images`:
  - `dish_id UUID NULL REFERENCES studio_dishes(id) ON DELETE SET NULL` (or RESTRICT —
    prefer SET NULL only if we must tolerate orphan cleanup; otherwise RESTRICT + require
    archive/delete flow).
  - `is_favourite BOOLEAN NOT NULL DEFAULT false`
  - `archived_at TIMESTAMPTZ NULL`
  - Indexes: `(user_id, dish_id, created_at DESC)`, partial unique favourite per dish
    (one favourite per dish among non-archived rows).
- Backfill: existing `studio_images` rows get a per-user default dish
  (e.g. name `"My dishes"`) so the gallery does not empty for anyone who already generated.

Append Pending rows to `PENDING_PRODUCTION_DEPLOY.md` for the new migration (+ smoke note).

### 2. Server / lib

- Dish CRUD helpers under `src/lib/studio/` (list/create/rename; optional soft constraints
  on empty names).
- Extend `persistStudioImage` to require/accept `dishId`; keep daily generation limit logic.
- Image library helpers: list by dish (exclude archived), set favourite (clear others),
  archive, delete (+ storage remove), set-as-working (return URL/id for client).
- API routes (auth via existing `requireUserApi` / studio gates):
  - `GET/POST /api/studio/dishes`
  - `PATCH/DELETE /api/studio/dishes/[dishId]` (rename / delete empty-or-archived dish)
  - `GET /api/studio/images?dishId=` (or fold into page RSC load)
  - `PATCH /api/studio/images/[imageId]` (favourite, archive, unarchive)
  - `DELETE /api/studio/images/[imageId]`
- Wire `/api/studio/source` + `/api/studio/mutate` to attach `dish_id` on persist.

### 3. FOH `/studio` UX

- Dish selector: list dishes, create new, rename; selecting a dish scopes the gallery.
- Gallery shows source + generated for the active dish (not a flat global recent list).
- Actions per thumbnail: use as working image, favourite/default, download (existing),
  archive/delete.
- When generating, new outputs land on the active dish; “use as working” loads that image
  into the editor (same extract/mutate flow as upload).
- Light metadata on hover or detail strip: role, created time, model (FOH-friendly;
  no admin-only prompt dump required this chunk).

### 4. Tests

- Migration-facing / lib unit tests for dish create, favourite uniqueness, archive filter,
  delete storage cleanup (mocked Supabase as in Chunk 2).
- API route tests for dish + image library endpoints (auth + ownership).
- Client behaviour covered lightly if patterns already exist; at minimum lib/API tests green.

### 5. Tracker / backlog

- Update §7.2 / §7.3 / Phase 2 rows and chunk log in `PIVOT_TRACKER.md`.
- Log the lean-model decisions above in the Decisions log.
- Pending deploy rows for the new migration.

## Out of scope for this chunk

- `photo_projects` / multi-project nesting and `/studio/projects/*` routes.
- `image_edits` table / Phase 4 validation scoring.
- Background/surface reference libraries (Phase 3 / later chunk).
- Credits (Phase 5).
- Before/after compare UI polish beyond selecting working image + gallery.
- Cut-out / export roles (roles stay `source` | `generated` unless already needed).
- Production deploy.

## Acceptance criteria

- [x] User can create and select dishes; library is scoped to the active dish.
- [x] Upload + generate attach images to the active dish; variants persist across sessions.
- [x] User can set one favourite/default image per dish.
- [x] User can set any library image as the current working source for further edits.
- [x] User can archive and/or delete unwanted variants (storage cleaned on delete).
- [x] Existing Chunk 2 rows remain visible via backfill into a default dish.
- [x] Flag gating and Admin Photo Control behaviour unchanged.
- [x] Tests pass; tracker + pending deploy backlog updated in the same commits.
- [x] Every library feature has a corresponding FOH control (dish picker, gallery actions).

## Gallery images (no seed assets)

The dish library shows **the signed-in user’s own uploads and generations** — there is no
curated example pack to install. Populate it by using `/studio` (upload → generate). Empty
state copy explains this when a dish has no images yet.

## Estimated shape

Roughly: 1 migration, dish/image lib helpers + tests, 3–5 API routes + tests, Studio client
gallery/dish UI updates, tracker/deploy docs. No new env vars expected.
