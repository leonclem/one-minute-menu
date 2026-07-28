# Production deploy backlog

**Purpose:** running total of everything that must happen in production (or any
non-local environment) before/at the next deliberate deploy. Updated in the
**same commit** as each chunk that adds migrations or env vars.

This is the source of truth for “what’s waiting to go live.” Do **not** rely on
`git log` alone — multiple chunks/patches may land on `main` before a deliberate
production deploy; commit history is a poor deploy checklist.

**Last production deploy:** Chunk 6 Studio credits + direct-to-Supabase upload
patch (`e9c856c` on `main`). Confirmed live by LC on 2026-07-28; the exact deploy
date was not recorded at the time.

**Next pending:** Group A Studio model-call configuration rollout: set or confirm
`STUDIO_THINKING_LEVEL`, `STUDIO_IMAGE_SIZE`, and (if tuning is needed)
`STUDIO_MAX_REFS`, then complete the Group A production smoke test after the
manual app deploy. Everything committed to `main` up to and including `e9c856c`
is live in production.

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
| `NEXT_PUBLIC_PRODUCT_MODE` | Chunk 1 | `menu-builder` | `photo-studio` when ready to pivot FOH | Applied | Prod 2026-07-24 (`42f35d5`). Likely left at default until full switchover — confirm in Vercel if needed. |
| `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO` | Chunk 1 | `false` (off) | `true` to expose `/studio` + Studio nav | Applied | Prod 2026-07-24 (`42f35d5`). Required for `/studio`; confirm set `true` in Vercel. |
| `NEXT_PUBLIC_ENABLE_LEGACY_MENUS` | Chunk 1 | `true` | `false` with photo-studio mode to hide Dashboard nav | Applied | Prod 2026-07-24 (`42f35d5`). Optional soft-transition control. |
| `STUDIO_DAILY_GENERATION_LIMIT` | Chunk 2 | `25` | Set explicitly if you want a different cap | Applied | Prod 2026-07-24 (`42f35d5`). Default 25 unless overridden in Vercel. |
| `STUDIO_OUTPUT_VALIDATION_ENABLED` | Chunk 5 | `true` (on when unset) | `true` for private beta quality signals; `false` to skip re-extract cost | Applied | Prod 2026-07-24 (`42f35d5`). Default on when unset. |
| `NEXT_PUBLIC_STUDIO_ADMIN_ONLY` | Chunk 5 | `true` (on when unset) | `true` until ready for non-admin users; `false` to open FOH Studio | Applied | Prod 2026-07-24 (`42f35d5`). Default on when unset. |
| `STUDIO_CREDIT_COST_NB2` | Chunk 6 | `1` | `1` unless pricing changes | Applied | Credit cost for Flash / NB2 Studio mutates. Live with Chunk 6 (`e9c856c`); default 1 unless overridden in Vercel. |
| `STUDIO_CREDIT_COST_NB_PRO` | Chunk 6 | `3` | `3` unless pricing changes | Applied | Credit cost for Pro Studio mutates. Live with Chunk 6 (`e9c856c`); default 3 unless overridden in Vercel. |
| `STUDIO_DISH_FAILURE_LIMIT` | Chunk 6 | `5` | `5` unless ops wants a different breaker | Applied | Consecutive billable provider failures before dish block. Live with Chunk 6 (`e9c856c`); default 5 unless overridden in Vercel. |
| `STUDIO_THINKING_LEVEL` | Group A patch | `high` | `high` unless approved latency/cost evidence changes it | Pending | Flash-only; accepts `minimal` or `high`. Thinking tokens are billed even when their output is not inspected. |
| `STUDIO_IMAGE_SIZE` | Group A patch | `2K` | `2K` | Pending | Studio sends uppercase documented size tokens (`1K`, `2K`, `4K`). |
| `STUDIO_MAX_REFS` | Group A patch | Documented per-model limit (Flash: 10 object refs; Pro: 14 total) | Leave unset for the documented limit, or set a positive tuning value | Pending | The requested value is clamped to the applicable documented model limit and warns when clamped. |

---

## Database migrations (production Supabase)

Apply to production **before** deploying app code that depends on them.
Prefer `npx supabase db push` against the linked production project (never
`supabase db reset`). Local may already be applied; this table is about **prod**.

| Migration | Added in | Status | Notes |
|---|---|---|---|
| `supabase/migrations/070_studio_images.sql` | Chunk 2 | Applied | Prod 2026-07-24 (`42f35d5`). |
| `supabase/migrations/071_studio_dishes.sql` | Chunk 3 | Applied | Prod 2026-07-24 (`42f35d5`). Apply after 070. |
| `supabase/migrations/072_studio_dish_current_image.sql` | Chunk 3 | Applied | Prod 2026-07-24 (`42f35d5`). Apply after 071. |
| `supabase/migrations/073_studio_reference_libraries.sql` | Chunk 4 | Applied | Prod 2026-07-24 (`42f35d5`; seed refresh also in Chunk 5 commit). Apply after 072. |
| `supabase/migrations/074_studio_credits.sql` | Chunk 6 | Applied | Balances + ledger + `studio_apply_credit_delta` + dish failure/block columns. Live with Chunk 6 (`e9c856c`). |

---

## Other production actions

Non-env, non-migration steps that must not be forgotten.

| Action | Added in | Status | Notes |
|---|---|---|---|
| Smoke-test `/studio` after enabling flags | Chunk 2 | Applied | Prod 2026-07-24 — admin `/studio` exercised (413 on large upload led to direct-upload patch). |
| Smoke-test dish library | Chunk 3 | Applied | Prod 2026-07-24 (`42f35d5` deploy). |
| Smoke-test reference libraries | Chunk 4 | Applied | Prod 2026-07-24 (`42f35d5` deploy). |
| Smoke-test output validation | Chunk 5 | Applied | Prod 2026-07-24 (`42f35d5` deploy). |
| Smoke-test Studio credits | Chunk 6 | Applied | Admin grant → `/studio` shows balance → generate decrements; 0 balance → 402; blocked dish after N billable failures cannot generate until admin clears. |
| Smoke-test direct-upload (5–9 MiB) | Direct-upload patch | Applied | Large PNG upload no 413; extract + mutate OK. |
| Smoke-test Group A Studio model-call configuration | Group A patch | Pending | After the manual deploy and required per-call approval, verify input-matched aspect ratio, configured Flash thinking level, uppercase image-size handling, and reference-cap override/clamping behaviour. |

---

## Deploy history (optional log)

Record completed production deploys here so the backlog above can be cleared
with confidence.

| Date | What went live | Cleared backlog items |
|---|---|---|
| 2026-07-24 | Chunks 1–5 cumulative — commit `42f35d5` (*Chunk 5 validation, admin-only gate, and style library refresh*). Includes Studio shell, dish library, reference libraries, post-gen validation, admin-only FOH gate. | All env vars (Chunk 1–5), migrations `070`–`073`, smoke tests (Chunk 2–5). **Not included:** direct-upload patch (built locally after this deploy). |
| 2026-07-27 / 28 (exact date not recorded) | Chunk 6 Studio credits + direct-to-Supabase upload patch — commit `e9c856c` (*feat(studio): implement Chunk 6 for credits and usage control*). Confirmed live by LC on 2026-07-28. | Migration `074`, Chunk 6 credit env vars (`STUDIO_CREDIT_COST_NB2`, `STUDIO_CREDIT_COST_NB_PRO`, `STUDIO_DISH_FAILURE_LIMIT`), Chunk 6 credits smoke test, direct-upload smoke test. Backlog rows were left stale at the time and corrected retrospectively on 2026-07-28. |
