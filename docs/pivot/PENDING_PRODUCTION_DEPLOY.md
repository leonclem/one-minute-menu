# Pending production deploy backlog

**Purpose:** running total of everything that must happen in production (or any
non-local environment) before/at the next deliberate deploy. Updated in the
**same commit** as each chunk that adds migrations or env vars.

This is the source of truth for “what’s waiting to go live.” Do **not** rely on
`git log` since an old branch — chunk branches are short-lived and merge to
`main` often; once merged, branch history is a poor backlog.

**How to use**

1. When a chunk adds a migration or env var → append a row below (status
   `Pending`).
2. When you apply that item to an environment → set status to `Applied` (or
   `Skipped` with a reason) and note the date/environment.
3. Before `npm run deploy:vercel`, walk every `Pending` row for that
   environment. See also the process checklist in [GIT_WORKFLOW.md](GIT_WORKFLOW.md).

**Statuses:** `Pending` · `Applied` · `Skipped`

---

## Environment variables (Vercel / production)

Set in Vercel → Project → Settings → Environment Variables (and any other
non-local env you care about). Defaults in code are safe if unset unless noted.

| Var | Added in | Default if unset | Intended production value | Status | Notes |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_PRODUCT_MODE` | Chunk 1 | `menu-builder` | `photo-studio` when ready to pivot FOH | Pending | Safe to leave unset until switchover. |
| `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO` | Chunk 1 | `false` (off) | `true` to expose `/studio` + Studio nav | Pending | Required for customer Studio. |
| `NEXT_PUBLIC_ENABLE_LEGACY_MENUS` | Chunk 1 | `true` | `false` with photo-studio mode to hide Dashboard nav | Pending | Optional soft-transition control. |
| `STUDIO_DAILY_GENERATION_LIMIT` | Chunk 2 | `25` | Set explicitly if you want a different cap | Pending | Soft pre-credits cost guard. |

---

## Database migrations (production Supabase)

Apply to production **before** deploying app code that depends on them.
Prefer `npx supabase db push` against the linked production project (never
`supabase db reset`). Local may already be applied; this table is about **prod**.

| Migration | Added in | Status | Notes |
|---|---|---|---|
| `supabase/migrations/070_studio_images.sql` | Chunk 2 | Pending | Creates `studio_images` + RLS. Required for `/api/studio/*` persistence. |
| `supabase/migrations/071_studio_dishes.sql` | Chunk 3 | Pending | Creates `studio_dishes`, adds `dish_id`/`is_favourite`/`archived_at` to `studio_images`, backfills default dish. Apply after 070. |
| `supabase/migrations/072_studio_dish_current_image.sql` | Chunk 3 | Pending | Adds `studio_dishes.current_image_id` for persisted Current variant per dish. Apply after 071. |

---

## Other production actions

Non-env, non-migration steps that must not be forgotten.

| Action | Added in | Status | Notes |
|---|---|---|---|
| Smoke-test `/studio` after enabling flags | Chunk 2 | Pending | Upload → generate → download; confirm Admin Photo Control still works. |
| Smoke-test dish library | Chunk 3 | Pending | Create/rename dish; upload; generate; favourite; use-as-working; archive/delete. |

---

## Deploy history (optional log)

Record completed production deploys here so the backlog above can be cleared
with confidence.

| Date | What went live | Cleared backlog items |
|---|---|---|
| _(none yet)_ | | |
