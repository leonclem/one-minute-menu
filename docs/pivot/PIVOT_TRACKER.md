# Photo Studio Pivot — Requirements Tracker

Tracks what from `GridMenu_Photo_Studio_Pivot_Requirements_2026-07-16.md` is built, pending,
deferred, or deviates from the original document. Update this file in the same PR/commit as the
work it describes.

**Statuses:** `Not started` · `In progress` · `Built` · `Deferred` · `Deviation` (see Notes column)

---

## 1. Decisions log

Answers to the document's §13 Open Questions, plus decisions made during the build.
Subject to change; record changes as new dated rows rather than editing old ones.

| Date | Topic | Decision |
|---|---|---|
| 2026-07-17 | Branding (Q1) | TBC — check with SEO adviser whether to stay "GridMenu" or use "GridMenu Photo Studio". |
| 2026-07-17 | Landing page (Q2) | Old model is dead; no reason to keep existing landing page, but seek ICP/SEO feedback before replacing. |
| 2026-07-17 | First target buyer (Q3) | TBC — use existing contacts to gather intel/feedback. |
| 2026-07-17 | Early access (Q4) | Yes — manually invited users with admin-granted credits, with limitations on credit spend. |
| 2026-07-17 | Transformation disclaimer (Q5) | No disclaimer. Gemini watermarks images; make provision for a watermark-removal tool, possibly premium. |
| 2026-07-17 | First output format (Q6) | TBC — transparent cut-out judged least important on initial gut feel. |
| 2026-07-17 | Credits on failed generations (Q7) | TBD — review internal test results first. |
| 2026-07-17 | Pro model credit cost (Q8) | Model-dependent: NB Pro should consume more credits than NB2 since it costs GridMenu more. |
| 2026-07-17 | Existing subscribers (Q9) | Irrelevant — no current subscribers. Blank canvas. |
| 2026-07-17 | Menu export visibility (Q10) | Keep, but as a low-visibility secondary offering. |
| 2026-07-17 | Git workflow (§9.2) | Deviation from doc: instead of one long-lived pivot branch, use short-lived chunk branches off `main`, merged quickly behind feature flags (trunk-based). Rationale: no production users to protect, and long-lived branches are harder to merge and riskier for a developer newer to branching. Confirmed by LC. Full workflow: `docs/pivot/GIT_WORKFLOW.md`. |
| 2026-07-17 | Branch naming | `studio/chunk-NN-<slug>` (avoids "pivot" label ageing badly; branch names are ephemeral anyway). Chunk 1 branch renamed accordingly. |
| 2026-07-17 | Deployment | `main` does not auto-deploy (confirmed: `vercel.json` disables it). Production deploys are manual by LC once testing/build are green — checklist in `docs/pivot/GIT_WORKFLOW.md`. |
| 2026-07-17 | Tracker enforcement | Cursor rule `.cursor/rules/pivot-tracker.mdc` instructs the agent to update this tracker in the same commit as related work, log deviations, and guide git operations per the workflow doc. |
| 2026-07-17 | Supplementary pages | New requirement added as §16.1 addendum to the requirements doc: review Settings, Support, Pricing, Privacy, Terms, Contact Us for relevancy to the new positioning before public/beta launch. |
| 2026-07-17 | Feature flags scope (§9.3) | Deviation from doc: omit `NEXT_PUBLIC_ENABLE_EXPERIMENTAL_CAMERA` and `NEXT_PUBLIC_ENABLE_PLATING_SWAP` until those features exist (avoid dead config). |
| 2026-07-17 | Marketing CTAs | Follow-up: homepage / marketing CTAs left unchanged in Chunk 1; revisit with landing-page decision (Q2). |
| 2026-07-18 | Studio persistence (§7.2) | Deviation / deferral: Chunk 2 ships minimal `studio_images` table only; full projects/dishes/image_assets model deferred to Chunk 3. |
| 2026-07-18 | Studio landing | Chunk 2 adds Studio to primary nav when flag enabled; post-login landing remains dashboard/onboarding (nav-only). |
| 2026-07-18 | Studio FOH controls | First shell omits camera/composition section and model selector; lighting + garnish/sides + staged changes only. |
| 2026-07-18 | Pre-credits cost guard | `STUDIO_DAILY_GENERATION_LIMIT` (default 25) gates `/api/studio/mutate` until Phase 5 credits. |
| 2026-07-18 | Deploy backlog | Living checklist `docs/pivot/PENDING_PRODUCTION_DEPLOY.md` accumulates migrations/env vars across chunks until a deliberate production deploy. Prefer this over reconstructing from git branch history. |
| 2026-07-18 | Studio data model (§7.2) | Chunk 3: `studio_dishes` + evolve `studio_images` (`dish_id`, `is_favourite`, `archived_at`). Defer `photo_projects` and `image_edits`; do not rename to `image_assets`. |
| 2026-07-18 | Studio routes (§9.4) | Chunk 3 stays on `/studio` with in-page dish picker; `/studio/projects/*` deferred. |
| 2026-07-18 | Library delete policy | Soft-archive hides variants; hard-delete removes DB + storage. Block hard-delete of a source while non-archived children reference it. Dish delete requires no active images. |
| 2026-07-19 | Studio FOH UX shell | Control panel (left) + Preview/Variants (right); one accordion section open at a time (menu-builder pattern). Dish title + Upload/New; Download/Delete on Current only. |
| 2026-07-19 | FOH add garnish/side | Disabled in customer Studio (remove-only). Add remains in admin Photo Control. Revisit after lighting/background quality is stable. |
| 2026-07-19 | FOH rotation labels | Left 45° → `45-degree`, Overhead → `top-down`, Right 45° → `eye-level` (interim; true left/right yaw deferred). |
| 2026-07-19 | FOH lighting labels | Natural → `bright-and-airy`, Moody → `low-key`, Studio → new `studio` enum value. Preview assets under `public/studio/controls/`. |
| 2026-07-19 | Variant change audit | Per-generation `metadata.changeSummary` chips (vs previous working image). Cumulative vs OG deferred. Favourite/Archive FOH actions removed; click variant to load as Current. |
| 2026-07-19 | Dish current + editor JSON | `studio_dishes.current_image_id` persists Current across sessions; `metadata.editorState` stores extract/target JSON per variant. Re-clicking an already-selected rotation/lighting tile restages Generate. |

---

## 2. Requirements traceability

### Core principles (§5)

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | User controls, not prompt boxes | Built | `/studio` uses lighting + garnish/sides controls; no prompt box. |
| 5.2 | Preserve the dish (identity lock defaults) | Not started | Partially exists in photo-control prompt composer; needs review against §5.2 list. |
| 5.3 | Stage changes before generation (max 3, summary, reset) | Built | Pending-changes panel + max 3 in `/studio` (same engine as sandbox). |
| 5.4 | MVP prioritises reliable transformations | Not started | Governs control selection in Chunks 2+. |

### MVP features (§7)

| Ref | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 7.1 | Customer-facing `/studio` route | 1 | Built | Flag-gated; nav link via `shouldShowStudioNav`. |
| 7.2 | Project/dish/image data model | 2 | Deviation | `studio_dishes` + evolved `studio_images`; projects/`image_assets`/`image_edits` deferred (see decisions 2026-07-18). |
| 7.3 | Image library per dish | 2 | Built | Dish picker + per-dish gallery with favourite, use-as-working, archive, delete, download. |
| 7.4 | Lighting manipulation (6 styles + reference library) | 1/3 | In progress | FOH Natural / Moody / Studio tiles; curated reference library still Phase 3. |
| 7.5 | Background/surface swapping + library | 3 | Not started | |
| 7.6 | Plating/vessel style library | 7 | Deferred | Admin-only/experimental per doc. |
| 7.7 | Dish element manipulation (garnish/sides/clutter) | 1 | In progress | FOH remove-only for garnish/sides; add deferred. Clutter removal still pending. |
| 7.8 | Rotation & composition controls (replace camera pitch) | 1 | In progress | FOH rotation tiles (3 options); full composition/yaw later. |
| 7.9 | Output packs | Post-MVP | Deferred | One output at a time first. |
| 7.10 | Model selection (admin-visible only) | 1 | Built | FOH fixed to NB2/Flash; admin sandbox retains model selector. |

### Pricing & credits (§8)

| Ref | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 8.1 | Usage ledger for generations | 5 | Not started | `generation_quotas` + `user_packs` exist from legacy model; assess reuse vs new ledger. |
| 8.1 | Credit deduction around generation jobs | 5 | Not started | |
| 8.1 | Admin credit grants (private beta) | 5 | Not started | Per decision Q4: yes, with spend limits. |
| 8.1 | Stripe credit packs / plan packaging | 5+ | Deferred | Delay until user behaviour clearer. |

### Architecture (§9)

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 9.1 | Reuse existing repo | Built | Confirmed; no new repo. |
| 9.2 | Pivot branch workflow | Deviation | See decisions log 2026-07-17: chunk branches off `main` instead of one long-lived branch. Workflow doc: `docs/pivot/GIT_WORKFLOW.md`. |
| 9.3 | Feature flags (product mode, legacy menus, etc.) | Built | `src/lib/product-mode.ts`. Env vars in `env.example`. Experimental camera / plating flags deferred until features exist. |
| 9.4 | Route group structure | Not started | Existing app is not route-grouped as in doc; adopt incrementally rather than restructure up front (likely deviation — record when decided). |
| 9.5 | Migrate admin sandbox to FOH | Built | Partial: customer `/studio` reuses photo-control lib; admin sandbox retained. |

### Addendum requirements (§16)

| Ref | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 16.1 | Review supplementary pages (Settings, Support, Pricing, Privacy, Terms, Contact Us) for new positioning | 1–6 | Not started | Added 2026-07-17. Legal pages must cover AI generation, photo uploads, watermarking. Complete before public/beta launch. |

### Development phases (§10)

| Phase | Goal | Status | Chunk |
|---|---|---|---|
| 0 | Safety & setup (branch, flags, hide legacy nav, verify pipeline, document it) | Built | Chunk 1 — live Photo Control smoke check still manual (see `IMAGE_PIPELINE_NOTES.md`) |
| 1 | Customer-facing Photo Studio shell | Built | Chunk 2 — `/studio` + `studio_images` persistence |
| 2 | Image library per dish | Built | Chunk 3 — `studio_dishes` + dish library on `/studio` |
| 3 | Background & lighting reference libraries | Not started | |
| 4 | Controlled prompt/state layer | Not started | Partially exists in `src/lib/photo-control/` (JSON state, delta, composer). |
| 5 | Credits & usage control | Not started | |
| 6 | MVP market test | Not started | |
| 7 | Plating/vessel experimentation | Deferred | |

---

## 3. Chunk log

| Chunk | Scope | Branch | Status |
|---|---|---|---|
| 1 | Phase 0: pivot docs, feature flags, hide legacy nav, verify + document generation pipeline | `studio/chunk-01-foundations` | Built — see `docs/pivot/BUILD_PLAN_CHUNK_01.md` |
| 2 | Phase 1: customer-facing `/studio` shell with persistence | `studio/chunk-02-studio-shell` | Built — merged to `main` — see `docs/pivot/BUILD_PLAN_CHUNK_02.md` |
| 3 | Phase 2: image library per dish (`studio_dishes` + dish-scoped gallery) | `studio/chunk-03-dish-library` | Built — merged to `main` — see `docs/pivot/BUILD_PLAN_CHUNK_03.md` |
