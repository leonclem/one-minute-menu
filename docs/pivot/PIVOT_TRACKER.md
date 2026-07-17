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
| 2026-07-17 | Git workflow (§9.2) | Deviation from doc: instead of one long-lived pivot branch, use short-lived chunk branches off `main`, merged quickly behind feature flags (trunk-based). Rationale: no production users to protect, and long-lived branches are harder to merge and riskier for a developer newer to branching. |

---

## 2. Requirements traceability

### Core principles (§5)

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | User controls, not prompt boxes | Not started | Sandbox already control-based; FOH surface pending. |
| 5.2 | Preserve the dish (identity lock defaults) | Not started | Partially exists in photo-control prompt composer; needs review against §5.2 list. |
| 5.3 | Stage changes before generation (max 3, summary, reset) | Not started | Pending-changes concept exists in sandbox. |
| 5.4 | MVP prioritises reliable transformations | Not started | Governs control selection in Chunks 2+. |

### MVP features (§7)

| Ref | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 7.1 | Customer-facing `/studio` route | 1 | Not started | Chunk 2 (planned). |
| 7.2 | Project/dish/image data model | 2 | Not started | Minimal `image_assets`-style persistence may land early in Chunk 2 to satisfy §14 "saved against the user". |
| 7.3 | Image library per dish | 2 | Not started | |
| 7.4 | Lighting manipulation (6 styles + reference library) | 1/3 | Not started | Sandbox has Bright & Airy + Low-Key only. |
| 7.5 | Background/surface swapping + library | 3 | Not started | |
| 7.6 | Plating/vessel style library | 7 | Deferred | Admin-only/experimental per doc. |
| 7.7 | Dish element manipulation (garnish/sides/clutter) | 1 | Not started | Garnish/sides exist in sandbox; clutter removal new. |
| 7.8 | Rotation & composition controls (replace camera pitch) | 1 | Not started | Eye-Level to be removed from FOH / kept admin-only. |
| 7.9 | Output packs | Post-MVP | Deferred | One output at a time first. |
| 7.10 | Model selection (admin-visible only) | 1 | Not started | Friendly quality names for customers if exposed at all. |

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
| 9.2 | Pivot branch workflow | Deviation | See decisions log 2026-07-17: chunk branches off `main` instead of one long-lived branch. |
| 9.3 | Feature flags (product mode, legacy menus, etc.) | Not started | Chunk 1. Env-var based, matching existing `NEXT_PUBLIC_*` pattern. |
| 9.4 | Route group structure | Not started | Existing app is not route-grouped as in doc; adopt incrementally rather than restructure up front (likely deviation — record when decided). |
| 9.5 | Migrate admin sandbox to FOH | Not started | Chunk 2. |

### Development phases (§10)

| Phase | Goal | Status | Chunk |
|---|---|---|---|
| 0 | Safety & setup (branch, flags, hide legacy nav, verify pipeline, document it) | In progress | Chunk 1 |
| 1 | Customer-facing Photo Studio shell | Not started | Chunk 2 (planned) |
| 2 | Image library per dish | Not started | |
| 3 | Background & lighting reference libraries | Not started | |
| 4 | Controlled prompt/state layer | Not started | Partially exists in `src/lib/photo-control/` (JSON state, delta, composer). |
| 5 | Credits & usage control | Not started | |
| 6 | MVP market test | Not started | |
| 7 | Plating/vessel experimentation | Deferred | |

---

## 3. Chunk log

| Chunk | Scope | Branch | Status |
|---|---|---|---|
| 1 | Phase 0: pivot docs, feature flags, hide legacy nav, verify + document generation pipeline | `pivot/photo-studio-mvp` | In progress — see `docs/pivot/BUILD_PLAN_CHUNK_01.md` |
| 2 | Phase 1: customer-facing `/studio` shell with persistence | TBD | Planned |
