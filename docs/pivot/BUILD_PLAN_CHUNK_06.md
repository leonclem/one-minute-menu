# Build Plan — Chunk 6: Credits & Usage Control

**Requirements refs:** §8.1, §10 Phase 5; open questions Q4 / Q7 / Q8.

**Branch:** `main` (no chunk branch — per 2026-07-27 workflow).

## Context docs (read alongside this plan)

| Doc | Role |
|---|---|
| [`GridMenu_Photo_Studio_Pivot_Requirements_2026-07-16.md`](./GridMenu_Photo_Studio_Pivot_Requirements_2026-07-16.md) | Source requirements (§8 Pricing, §10 Phase 5 tasks, §13 Q4/Q7/Q8) |
| [`PIVOT_TRACKER.md`](./PIVOT_TRACKER.md) | Decisions log, §8.1 traceability, chunk/patches log — update in same commits |
| [`PRODUCTION_DEPLOY_BACKLOG.md`](./PRODUCTION_DEPLOY_BACKLOG.md) | Pending prod migration/env/smoke rows for this chunk |
| [`GIT_WORKFLOW.md`](./GIT_WORKFLOW.md) | Commit on `main`, no chunk branches, manual prod deploy |
| [`IMAGE_PIPELINE_NOTES.md`](./IMAGE_PIPELINE_NOTES.md) | Generation/upload/extract; cost assumptions — note Studio ledger here |
| [`PATCH_DIRECT_SUPABASE_UPLOAD_2026-07-27.md`](./PATCH_DIRECT_SUPABASE_UPLOAD_2026-07-27.md) | Independent upload patch (Built, not yet deployed) — not a dependency for local Chunk 6 |
| [`.cursor/rules/pivot-tracker.mdc`](../../.cursor/rules/pivot-tracker.mdc) | Tracker + git discipline for agents |

Prior chunk style reference: [`BUILD_PLAN_CHUNK_05.md`](./BUILD_PLAN_CHUNK_05.md).

**Goal:** Support private-beta paid testing without overbuilding pricing. Add a real
Studio credit ledger, define per-generation costs, gate `/api/studio/mutate` when
balance is insufficient, let admins grant credits, show remaining credits in
FOH Studio, and circuit-break dishes that burn billable Gemini failures repeatedly.
Still behind `NEXT_PUBLIC_ENABLE_PHOTO_STUDIO` (+ admin-only gate until opened).

**Override note:** Started before production deploy of the direct-upload patch
(user choice 2026-07-27). Deploy that patch independently when ready; this chunk
does not depend on it for local/dev work.

## Decisions for this chunk (confirmed 2026-07-27)

Record in the tracker Decisions log when implementing:

1. **New Studio credit ledger — do not reuse `generation_quotas` as the ledger.**
   Legacy `generation_quotas` / `user_packs` remain for **menu** image generation
   only. Studio gets:
   - `studio_credit_balances` — one row per user (`balance`, `updated_at`)
   - `studio_credit_ledger` — append-only rows (`user_id`, `delta`, `balance_after`,
     `reason`, `ref_type`, `ref_id`, `created_by`, `metadata`, `created_at`)
   Rationale: variable cost (Q8), admin grants (Q4), failed-gen policy (Q7), and
   audit trail need a transaction log; the quota counter is monthly-reset, flat
   cost, menu-wired, and not a ledger.

2. **Billable operation = successful Studio mutate only.** Upload, register
   source, extract, library CRUD, and download are free. Post-gen soft validation
   re-extract is included in the mutate cost (not a second charge).

3. **Credit costs (private beta defaults, env-overridable):**
   - Nano Banana 2 / Flash (FOH default): **1 credit**
   - Nano Banana Pro: **3 credits** (Q8: Pro costs more; FOH still fixed to NB2,
     but cost table + admin sandbox path ready)
   - Env: `STUDIO_CREDIT_COST_NB2`, `STUDIO_CREDIT_COST_NB_PRO` (defaults above)

4. **Failed generations (Q7 — interim) + billable-failure circuit breaker:**
   - **Consume** credits when a generated image is persisted (including soft
     validation `warn` / `fail`).
   - **Do not consume** if mutate fails before persist (Gemini error, auth,
     request validation, daily safety rail, insufficient credits).
   - **Billable provider failures:** when the Nano Banana / Gemini call fails in
     a way that still likely incurred provider cost (e.g. model response received
     but unusable — safety filter, empty image, parse failure after a completed
     API round-trip — not pure client validation or “key missing”), increment a
     per-dish consecutive failure counter.
   - After **N** consecutive billable failures on a dish (default **5**, env
     `STUDIO_DISH_FAILURE_LIMIT`), **block further mutates for that dish** with a
     clear error (`STUDIO_DISH_GENERATION_BLOCKED`) until an admin clears the
     block (support investigation). Successful persist resets the counter to 0.
   - Store counter + block flag on `studio_dishes` (e.g. `generation_failure_count`,
     `generation_blocked_at`, `generation_blocked_reason`). Admin clear endpoint
     required.
   - Revisit refund UX after more internal testing; no complex customer refund UI yet.

5. **Admin credit grants (Q4):** Admin API + minimal admin UI to grant/revoke
   (positive or negative delta) with a required note. Ledger `reason = 'admin_grant'`.
   No self-serve purchase in this chunk. Admin can also clear a dish generation block.

6. **Stripe credit packs / plan packaging:** **Out of scope** (already Deferred
   5+). Keep existing Stripe menu subscription/pack plumbing untouched.

7. **Daily safety rail stays.** Keep `STUDIO_DAILY_GENERATION_LIMIT` as a
   secondary gate alongside credits (abuse / runaway). Credits are the product
   control; daily limit is the cost circuit-breaker. Surface both in mutate
   errors when hit.

8. **Starting balance:** New users get **0** Studio credits until an admin
   grants some (matches invited early-access model). No automatic free trial
   grant in this chunk (can add later for Phase 6 market test).

9. **Insufficient credits HTTP status:** **402** with code `STUDIO_INSUFFICIENT_CREDITS`.

## Scope

### 1. Schema

Migration `074_studio_credits.sql` (name may shift if another migration lands first):

- `studio_credit_balances (user_id PK → auth.users, balance int not null default 0
  check >= 0, updated_at)`
- `studio_credit_ledger` as above; index on `(user_id, created_at desc)`
- RLS: users read own balance + ledger; writes via service role / admin APIs only
- On `studio_dishes`: `generation_failure_count int not null default 0`,
  `generation_blocked_at timestamptz null`, `generation_blocked_reason text null`
- Optional: store `cost_credits` on `studio_images.metadata` at persist time (no
  dedicated `image_edits` table yet — consistent with Chunk 5)

### 2. Credit service (`src/lib/studio/credits.ts`)

- `getBalance(userId)`
- `getCreditCost(model)` — from env defaults
- `assertCanAfford(userId, cost)`
- `debitForGeneration({ userId, cost, studioImageId, model })` — atomic
  balance decrement + ledger row (reject if insufficient)
- `creditAdminGrant({ userId, delta, note, adminUserId })`
- Prefer a single Postgres function or carefully ordered admin-client transaction
  so balance never goes negative under concurrency

### 3. Dish failure circuit breaker (`src/lib/studio/generation-failures.ts`)

- Classify NanoBanana / mutate errors as `billable_failure` vs `non_billable`
- `recordBillableFailure(dishId)` → increment; if count ≥ limit, set block fields
- `recordGenerationSuccess(dishId)` → reset count + clear block if any
- `assertDishNotBlocked(dishId)` before mutate work
- Admin `clearDishGenerationBlock(dishId)`

### 4. Gate `/api/studio/mutate`

- After auth: check dish not blocked → daily limit → `balance >= cost`
- On success after persist: debit + reset failure counter; include
  `{ credits: { cost, balanceAfter } }` in the response
- On billable provider failure: record failure (may block dish); no credit debit
- On pre-persist non-billable failure: no debit, no failure increment
- **402** + `STUDIO_INSUFFICIENT_CREDITS` when broke
- **423** or **409** + `STUDIO_DISH_GENERATION_BLOCKED` when dish blocked
  (prefer **423 Locked**)

### 5. Admin grants + unblock

- `POST /api/admin/studio/credits` — `{ userId, delta, note }` (admin-only)
- `GET /api/admin/studio/credits?userId=` — balance + recent ledger
- `POST /api/admin/studio/dishes/[dishId]/clear-generation-block` — admin clear
- Minimal UI: extend existing admin user management (or a small Studio Credits
  panel) — grant amount + note; show current balance. Unblock can be a small
  admin action (API + minimal UI or documented curl for private beta if UI is
  heavy — prefer a simple button if dish id is reachable from admin).

### 6. FOH UI

- Show **Credits remaining** on `/studio` (header/control panel — one quiet line,
  not a dashboard strip)
- Disable / explain Generate when balance < cost
- Optional: show cost of next generate (“1 credit”) next to Generate
- If current dish is blocked, show a clear non-scary message to contact support
  (no generate)
- Do **not** replace admin Photo Control’s “AI prompts this session” in this chunk
  unless trivial; sandbox can stay session-counter for now

### 7. Customer read API

- `GET /api/studio/credits` — `{ balance, costs: { nb2, nbPro } }` for the signed-in
  user (admin-only gate still applies via existing Studio auth helper)

### 8. Tests

- Unit: cost lookup, insufficient balance, debit atomicity / reject path, admin
  grant positive + negative (floor at 0), failed mutate does not debit
- Unit: failure classifier + counter → block at N; success resets; assert blocked
- Route tests for mutate (mock credit + failure services) and admin grant auth
- No live Gemini / Stripe calls

### 9. Docs / tracker / deploy backlog

- Update `PIVOT_TRACKER.md`: Phase 5 + §8.1 rows; chunk log; Decisions log for
  items above
- Append `PRODUCTION_DEPLOY_BACKLOG.md`: migration `074`, env vars for credit
  costs + failure limit, smoke “grant credits → generate → balance decrements”
  and “blocked dish cannot generate”
- Light note in `IMAGE_PIPELINE_NOTES.md` cost section that Studio now uses the
  ledger (menu quota unchanged)

## Out of scope for this chunk

- Stripe Studio credit packs / subscription ↔ credit mapping
- Automatic signup / free-trial credit grants
- Pricing page rewrite (§16.1 / Phase 6 adjacency)
- Menu `generation_quotas` migration onto the Studio ledger
- Charging for extract, upload, or download
- Complex refund UI / partial credits for “bad” soft-validation outputs
- `image_edits` table
- Removing `STUDIO_DAILY_GENERATION_LIMIT`
- Opening `NEXT_PUBLIC_STUDIO_ADMIN_ONLY=false` (separate product decision)
- Production deploy
- Direct-upload prod deploy (independent patch)

## Acceptance criteria

- [x] Migration creates balance + ledger + dish failure/block columns; users cannot forge credits via client RLS
- [x] Mutate blocked when balance < cost; succeeds and debits when sufficient
- [x] Failed mutate (pre-persist) does not reduce balance
- [x] After N consecutive billable provider failures, dish mutates are blocked until admin clears
- [x] Successful generate resets the dish failure counter
- [x] Admin can grant/revoke credits with a note; ledger records the grant
- [x] FOH shows remaining credits and blocks Generate when broke or dish blocked
- [x] NB2 / NB Pro costs configurable via env; defaults 1 / 3
- [x] Daily limit still enforced as a secondary gate
- [x] Menu quota / Stripe menu packs unchanged
- [x] Tests cover balance, debit, grant, failure breaker, mutate gate paths
- [x] Tracker + pending deploy backlog updated in the same commits as the work

## Estimated shape

One migration, `credits.ts` + `generation-failures.ts` + tests, mutate wiring,
admin grant/unblock API + small UI, FOH balance/block display, env example +
backlog rows, tracker updates.
