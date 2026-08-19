# Photo Studio Pivot — Requirements Tracker

> **Closed / historical as of 2026-08-18.** Production is current with `main` and the self-serve
> launch is live. Do not treat pending rows below as live work.

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
| 2026-07-18 | Deploy backlog | Living checklist `docs/pivot/PRODUCTION_DEPLOY_BACKLOG.md` accumulates migrations/env vars across chunks until a deliberate production deploy. Prefer this over reconstructing from git branch history. |
| 2026-07-18 | Studio data model (§7.2) | Chunk 3: `studio_dishes` + evolve `studio_images` (`dish_id`, `is_favourite`, `archived_at`). Defer `photo_projects` and `image_edits`; do not rename to `image_assets`. |
| 2026-07-18 | Studio routes (§9.4) | Chunk 3 stays on `/studio` with in-page dish picker; `/studio/projects/*` deferred. |
| 2026-07-18 | Library delete policy | Soft-archive hides variants; hard-delete removes DB + storage. Block hard-delete of a source while non-archived children reference it. Dish delete requires no active images. |
| 2026-07-19 | Studio FOH UX shell | Control panel (left) + Preview/Variants (right); one accordion section open at a time (menu-builder pattern). Dish title + Upload/New; Download/Delete on Current only. |
| 2026-07-19 | FOH add garnish/side | Disabled in customer Studio (remove-only). Add remains in admin Photo Control. Revisit after lighting/background quality is stable. |
| 2026-07-19 | FOH rotation labels | Left 45° → `45-degree`, Overhead → `top-down`, Right 45° → `eye-level` (interim; true left/right yaw deferred). |
| 2026-07-19 | FOH lighting labels | Natural → `bright-and-airy`, Moody → `low-key`, Studio → new `studio` enum value. Preview assets under `public/studio/controls/`. |
| 2026-07-19 | Variant change audit | Per-generation `metadata.changeSummary` chips (vs previous working image). Cumulative vs OG deferred. Favourite/Archive FOH actions removed; click variant to load as Current. |
| 2026-07-19 | Dish current + editor JSON | `studio_dishes.current_image_id` persists Current across sessions; `metadata.editorState` stores extract/target JSON per variant. Re-clicking an already-selected rotation/lighting tile restages Generate. |
| 2026-07-19 | Reference libraries storage (§7.4/§7.5) | Chunk 4 ships DB-backed `studio_lighting_styles` + `studio_background_styles` with admin CRUD (not typed code-only config). |
| 2026-07-19 | Lighting schema (§7.4) | `scene_setup.lighting` becomes a style-key string (no longer fixed enum) so admins can add styles without a schema deploy. |
| 2026-07-19 | Background schema (§7.5) | Add editable `canvas.background_style` (library key). Free-text `canvas.background` remains extract-only / non-editable. |
| 2026-07-19 | Prompt & Reference Image resolution | Resolved server-side in `/api/studio/mutate`. Resolves style keys, loads corresponding PNGs from `public/studio/controls/`, and passes them as base64 reference images (`role: 'style'` for lighting, `role: 'scene'` for background) alongside the prompt. Customer styles API returns display fields only (never fragments/constraints). |
| 2026-07-19 | Admin Photo Control vs FOH styles | FOH uses DB libraries + reference images; admin sandbox keeps hardcoded lighting enum/directives for now (consolidation deferred). Thumbnails under `public/studio/controls/` double as the reference images; admin upload deferred. |
| 2026-07-20 | Camera height & spin separation (§7.8) | Decoupled vertical camera height (Angled/Overhead) and horizontal dish rotation (Spin Left 45°/Spin Right 45°) into separate controls. Removed 'eye-level' camera height entirely from customer-facing options to prevent low-quality generations. |
| 2026-07-20 | Subject Rotation and Composition (§7.8) | Deferred / Parked entirely. Perspective and rotation controls are unreliable with current AI models and have been removed from the `/studio` control panel for now to ensure a stable, high-quality core product experience. |
| 2026-07-23 | Independent Background & Surface controls | Split the single background style field into `canvas.background_style` (for vertical backdrops/walls) and `canvas.surface_style` (for horizontal tabletop surfaces) to allow users to select and apply both independently at the same time. |
| 2026-07-23 | Image delete policy | Refined deleteStudioImage to only block deletion of source images (role = 'source') when active children exist. Generated images (role = 'generated') can be deleted freely, with children's source_image_id set to null. |
| 2026-07-24 | Prompt length limit removal | Removed the hardcoded 2000-character limit from NanoBananaClient and PromptComposer entirely. Rationale: Gemini 3.1 Flash Image (Nano Banana 2) and Gemini 3 Pro Image (Nano Banana Pro) models support 131k and 64k input tokens respectively (equivalent to 260k-520k characters), making the 2000-character limit an unnecessary local bottleneck that caused composition failures on detailed prompts. |
| 2026-07-24 | Post-gen validation storage (§10 Phase 4) | No `image_edits` table yet. Persist soft validation on `studio_images.metadata.validation` (same pattern as `editorState` / `changeSummary`). |
| 2026-07-24 | Output validation behaviour | Sync re-extract after Studio mutate; gate with `STUDIO_OUTPUT_VALIDATION_ENABLED` (default on). Soft-flag only — never block save/download/edit. Heuristic MinimalSchema compare (no second judge model). |
| 2026-07-24 | Identity locks (§5.2) | Expanded always-on identity-preservation directive to cover component counts, vessel unless changed, colours/textures, and forbid unsolicited props/hands/text/cutlery. |
| 2026-07-24 | FOH Studio admin-only | Customer `/studio` + `/api/studio/*` restricted to admins by default via `NEXT_PUBLIC_STUDIO_ADMIN_ONLY` (default on). Set `false` to open to all authenticated users once ready. Admin Photo Control sandbox unchanged. |
| 2026-07-27 | Studio direct upload | Deviation from base64-through-Vercel pattern: FOH uploads source images directly to Supabase Storage (`ai-generated-images` bucket), then passes `imageId` through `/source`, `/extract`, and `/mutate`. Avoids Vercel 4.5 MB body limit. Product upload cap raised to 9 MiB (bucket hard limit 10 MiB). Admin Photo Control unchanged. Independent patch — see patches log. |
| 2026-07-24 | Production deploy (Chunks 1–5) | First deliberate Studio pivot deploy to production: commit `42f35d5` on `main` (Chunk 5 validation, admin-only gate, style library refresh). Cumulative deploy of Chunks 1–5 backlog (migrations 070–073, Studio env vars, smoke tests). Direct-upload patch not included — discovered during prod testing after this deploy. See `docs/pivot/PRODUCTION_DEPLOY_BACKLOG.md` deploy history. |
| 2026-07-27 | Git workflow | Supersedes 2026-07-17 chunk-branch workflow: commit directly to `main` / `origin/main` (no `studio/chunk-NN-*` branches for new work). Chunk branches retained in chunk log for Chunks 1–5 history only. Updated `docs/pivot/GIT_WORKFLOW.md`. |
| 2026-07-27 | Phase 5 sequencing | Override: start Chunk 6 (Phase 5 Credits) planning/build before production deploy of the direct-upload patch. Patch remains Built / not deployed; deploy independently when ready. |
| 2026-07-27 | Studio credits ledger | New `studio_credit_balances` + `studio_credit_ledger`; do not reuse menu `generation_quotas` / `user_packs`. Users start at 0 until admin grant (Q4). |
| 2026-07-27 | Studio credit costs | Private beta defaults: NB2/Flash = 1 credit, NB Pro = 3 credits (`STUDIO_CREDIT_COST_NB2` / `STUDIO_CREDIT_COST_NB_PRO`). Bill successful mutate only; extract/upload free. Insufficient credits → HTTP 402 `STUDIO_INSUFFICIENT_CREDITS`. |
| 2026-07-28 | Production deploy (Chunk 6 + direct-upload patch) | Confirmed by LC: commit `e9c856c` is live in production, including migration `074`, the Chunk 6 credit env vars, and the direct-to-Supabase upload patch. Supersedes the 2026-07-27 "Phase 5 sequencing" row, which anticipated deploying the patch separately. Exact deploy date was not recorded; backlog and chunk/patch rows were stale and corrected retrospectively on 2026-07-28. Nothing committed to `main` is currently awaiting production. |
| 2026-07-27 | Failed gens + dish circuit breaker (Q7) | No credit debit if mutate fails before persist. Billable provider failures (post-API Gemini/NanoBanana errors that likely incurred cost) increment per-dish consecutive failure count; after N (default 5, `STUDIO_DISH_FAILURE_LIMIT`) block further mutates on that dish until admin clears (`STUDIO_DISH_GENERATION_BLOCKED`). Success resets the counter. |
| 2026-07-28 | Group A reference cap | Retire the hardcoded `maxRefs = 3` hedge: it was chosen under the removed 2,000-character prompt cap. The reference count is now an env-configurable dial, clamped to each model's documented limit, so multi-change predictability can be tuned without a deploy rather than frozen at that retired figure. |
| 2026-07-24 | Prompt compression rationale | Superseded by the Group B scene-descriptor redesign: the removed 2,000-character cap no longer justifies compressed single-letter or truncated JSON; use full semantic descriptor fields instead. |
| 2026-07-19 | Reference-image approach / steering references | Superseded by clause 2.3a: static steering references are off by default on the customer FOH path and attach only on explicit opt-in, such as the admin sandbox. |
| 2026-07-28 | References for style | Superseded by clause 2.3b: references carry identity and JSON carries style. `gemini-3.1-flash-image` has no style-reference slot, so lighting, backdrop, and surface style belong in descriptor attributes rather than style swatches. |
| 2026-07-28 | Interactions API iteration | Follow-up, out of scope for this patch: evaluate the Interactions API instead of `generateContent`, using `previous_interaction_id` for iterative image edits. No transport migration is included here. |
| 2026-07-29 | Chunk 7 market-test scope | Phase 6 starts as controlled-beta readiness: preserve nav-only Studio prominence, keep the homepage/marketing CTA unchanged, and use manually managed beta access plus admin-granted credits. Public positioning and landing-page work remain deferred pending the branding/ICP decision. |
| 2026-07-29 | Studio beta entitlement storage | Use a dedicated `studio_beta_access` table keyed by user, with admin-only writes and retained grant/revoke audit fields. Access is an entitlement independent of the Studio credit balance, so invited users can reach the no-credit state. |
| 2026-07-29 | Studio access-mode switch | Add `NEXT_PUBLIC_STUDIO_ACCESS_MODE` with `admin-only`, `beta`, and `open` values. It is fallback-preserving: unset, empty, or invalid values retain the existing `NEXT_PUBLIC_STUDIO_ADMIN_ONLY` semantics, including the admin-only default. |
| 2026-07-29 | Studio generation feedback storage | Use a dedicated `studio_image_feedback` table with one editable, user-owned row per Studio image. Feedback is product data; analytics receives only non-sensitive submission metadata. |
| 2026-07-29 | Deployment reconciliation | The production backlog remains the source of truth: Group A/B/D style-descriptor work and migration `075` are still Pending. The earlier statement that nothing on `main` awaited production was stale and is superseded by the backlog. |
| 2026-08-13 | Production = `main` | LC confirmed production has all commits on `main` and that migrations `075`–`081` were applied manually in prod Supabase. Stale `Pending` backlog rows through those migrations are not unfinished deploys. |
| 2026-08-13 | Branding (Q1) | Keep **GridMenu**. Do not rename the public brand to “GridMenu Photo Studio.” SEO copy may say “AI food photo studio.” |
| 2026-08-13 | Landing page (Q2) | Replace the public menu-maker homepage. New visitors should not learn the menu system exists. Studio-first marketing; waitlist/invite, not “sign up and generate.” Supersedes 2026-07-29 nav-only / unchanged-CTA row. |
| 2026-08-13 | Post-login destination | Default authenticated landing is `/studio`. Restaurant/menu onboarding is not required for Studio. `/dashboard` remains for possible later reuse. |
| 2026-08-13 | Public pricing | Hide menu plan cards. Public `/pricing` is private beta + contact (`support@gridmenu.ai`). Stripe menu SKUs stay in code, parked. |
| 2026-08-13 | Studio Generate worker queue | Parked. Plan remains in `docs/STUDIO_GENERATION_WORKER_QUEUE_PLAN.md`; not Chunk 8. |
| 2026-08-14 | Chunk 8 public cutover | Code complete. Visitor-facing studio-first surface is gated by `isStudioPublicSurface()`. Production still needs the env cutover in `PRODUCTION_DEPLOY_BACKLOG.md`. Legal ownership / Gemini-as-processor / Studio-beta Terms remain in `STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md`. |
| 2026-08-14 | Privacy and Terms | Applied owner answers from `STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md`: user owns Studio outputs; name Google Gemini plus other subprocessors; remove Grid+/Creator Pack terms; private-beta Studio terms; 12-month credit packs when offered; contact `support@gridmenu.ai` only. |
| 2026-08-14 | Restaurant onboarding in studio-first | Do not require `/onboarding` (restaurant name/type/cuisine) or auto-create a menu when legacy menu nav is off. Settings and `/dashboard` must not dump new Studio users into `/menus/...`. |
| 2026-08-14 | First target buyer (Q3) | Any of the original ICP options, primarily menu designers and food photographers. |
| 2026-08-14 | First output format (Q6) | Keep the current Studio behaviour: generate at the source image’s framing; the user then picks export variants (delivery, social, cut-out, etc.) as needed. Do not add a staged “make cut-out then generate” control for this close-out. |
| 2026-08-14 | Failed generation credits (Q7) | Keep debit-on-successful-persist. Failures must be loggable so support can investigate; recode via the existing admin credit grant if warranted. No automatic refund UX required. |
| 2026-08-14 | Close original pivot requirements | `GridMenu_Photo_Studio_Pivot_Requirements_2026-07-16.md` is closed as the requirements set. Unshipped include-list items (clutter, garnish add, plating, worker queue, Stripe credit packs, etc.) move to `PIVOT_REMAINING_WORK.md` as a post-MVP to-do list, not open requirements. |
| 2026-08-14 | Studio first-upload auth lock | First source upload on `/studio` was failing with a 15s `getSession()` timeout. Cause: GoTrue auth lock deadlock from an async `onAuthStateChange` profile fetch, plus the upload client waiting on that same lock. Fix: fire-and-forget analytics identify; signed Storage upload URL issued by `/api/studio/source/upload-url`. See patches log. |
| 2026-08-14 | Name dish before first upload | Do not auto-create a placeholder dish named "My dishes". Empty Studio asks for a dish name before the file picker. See patches log. |
| 2026-08-15 | Pro model credit cost (Q8) | Lower NB Pro mutate cost from 3 credits to **2** (`STUDIO_CREDIT_COST_NB_PRO` default). Gemini 2K list prices: NB2 $0.101 vs Pro $0.134 (~33% more). 2 credits still prices Pro above cost-parity while reducing the 1-vs-3 deterrent. Exports unchanged: AI expand/cut-out stay 1 credit and still use Flash. If Vercel has `STUDIO_CREDIT_COST_NB_PRO=3` set, update or unset it or the new default will not apply. |
| 2026-08-15 | Export tile actions | Export Generate/Retry show credit cost on the button when the format is paid. Ready tiles: yellow download icon + teal Redo with credit on the button; tap preview uses the Workbench EXPAND overlay and `StudioImageLightbox`. Header info control explains AI vs included resize. |
| 2026-08-15 | Workbench parent variant | Change pills under the Workbench preview include `From OG` / `From Vn` for the image the generation was based on. Visual tree deferred. |
| 2026-08-16 | Studio homepage H1 | Public H1 is `Turn your photos into studio-quality images without prompts.` (was Chunk 8 `Turn real dish photos into menu-ready images`). Source of truth: `STUDIO_SEO.h1`. |
| 2026-08-17 | Workbench full-frame viewport | Workbench shows the entire image (fit, letterboxed) with zoom/pan/reset. Do not crop the editor preview to a landscape hero. Source uploads may be any common photo ratio; reject only when the longer side exceeds 3× the shorter (panoramas). Generation still uses source framing (Q6 2026-08-14). See patches log. |
| 2026-08-18 | Public Studio CTAs (Q2) | Homepage sells self-serve signup and credits, not waitlist/invite. Hero secondary CTA is `See pricing`. Workflow H2 is `How AI food photos work`. Drop public FAQ about menu subscriptions. Public metadata (layout, home, pricing title `Photo credits \| GridMenu`, register, sign-in, Support, manifest) is studio-only. Privacy collection copy is dish photos, not menu content. Menu Pack stays the 100-credit offering. Supersedes 2026-08-13 waitlist/invite landing-page promise for visitor-facing copy. |

---

## 2. Requirements traceability

### Core principles (§5)

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 5.1 | User controls, not prompt boxes | Built | `/studio` uses lighting + garnish/sides controls; no prompt box. |
| 5.2 | Preserve the dish (identity lock defaults) | Built | Identity clause expanded in Chunk 5; post-gen soft validation flags mismatches. |
| 5.3 | Stage changes before generation (max 3, summary, reset) | Built | Pending-changes panel + max 3 in `/studio` (same engine as sandbox). |
| 5.4 | MVP prioritises reliable transformations | Built | Lighting + background/surface shipped. Remaining include-list items (clutter, garnish add, plating, staged cut-out) moved to post-MVP to-do on 2026-08-14. |

### MVP features (§7)

| Ref | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 7.1 | Customer-facing `/studio` route | 1 | Built | Flag-gated; nav link via `shouldShowStudioNav`. |
| 7.2 | Project/dish/image data model | 2 | Deviation | `studio_dishes` + evolved `studio_images`; projects/`image_assets`/`image_edits` deferred (see decisions 2026-07-18). |
| 7.3 | Image library per dish | 2 | Built | Dish picker + per-dish gallery with favourite, use-as-working, archive, delete, download. |
| 7.4 | Lighting manipulation (6 styles + reference library) | 1/3 | Built | DB `studio_lighting_styles` (6 seeded); FOH tiles from API; fragments resolved in mutate. |
| 7.5 | Background/surface swapping + library | 3 | Built | DB `studio_background_styles` (8 seeded); FOH Background section; `canvas.background_style` editable. |
| 7.6 | Plating/vessel style library | 7 | Deferred | Admin-only/experimental per doc. |
| 7.7 | Dish element manipulation (garnish/sides/clutter) | 1 | Built | FOH remove-only for garnish/sides. Garnish **add** and clutter removal moved to post-MVP to-do on 2026-08-14. |
| 7.8 | Rotation & composition controls (replace camera pitch) | 1 | Deferred | Parked. Removed perspective and horizontal rotation controls entirely from FOH for now due to AI model perspective inconsistency. |
| 7.9 | Output packs | Post-MVP | Deviation | One generate at a time. Q6 2026-08-14: user picks export variants after generate (delivery/Instagram/PDF/cutout). Batch packs remain deferred. |
| 7.10 | Model selection (admin-visible only) | 1 | Built | FOH fixed to NB2/Flash; admin sandbox retains model selector. |

### Pricing & credits (§8)

| Ref | Requirement | Phase | Status | Notes |
|---|---|---|---|---|
| 8.1 | Usage ledger for generations | 5 | Built | Chunk 6: `studio_credit_balances` + `studio_credit_ledger` (not menu `generation_quotas`). |
| 8.1 | Credit deduction around generation jobs | 5 | Built | Chunk 6: debit on successful Studio mutate only. |
| 8.1 | Admin credit grants (private beta) | 5 | Built | Chunk 6: admin API + User Management “Studio credits” panel. |
| 8.1 | Stripe credit packs / plan packaging | 5+ | Deferred | Delay until user behaviour clearer. Out of Chunk 6 scope. |
| 8.1 | Controlled beta gate | 6 | Built | Chunk 7 adds admin-only, beta, and open access modes with the existing admin-only fallback; beta access is a separate user entitlement. |
| 8.1 | Admin beta controls and credit visibility | 6 | Built | Chunk 7 adds grant/revoke controls, audit state, and the existing Studio credit balance in the admin panel; the Chunk 6 credit path remains unchanged. |
| 8.1 | First-run Studio onboarding | 6 | Built | Chunk 7 adds the upload-to-generation workflow, private-beta credit explanation, support path, and access to upload without legacy menu onboarding. |
| 8.1 | Generation feedback loop | 6 | Built | Chunk 7 adds optional rating/tags/comment feedback, user-owned persistence, ownership validation, and the admin read path without blocking download or reuse. |
| 8.1 | Funnel instrumentation | 6 | Built | Chunk 7 registers the Studio funnel events and emits consent-aware, non-PII payloads through the existing analytics wrappers. |

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
| 16.1 | Review supplementary pages (Settings, Support, Pricing, Privacy, Terms, Contact Us) for new positioning | 1–6 | Built | Chunk 8 studio-first public copy. Privacy/Terms updated 2026-08-14 from `STUDIO_PUBLIC_COPY_AND_LEGAL_REVIEW.md`. |

### §16.1 deferred follow-ups from the Chunk 7 supplementary-page audit

| Ref | Page / finding | Status | Follow-up |
|---|---|---|---|
| 16.1 | Support — “What is GridMenu?” / “It focuses purely on menu creation.” | Built | Chunk 8: studio-public Support uses Studio waitlist FAQs. Menu FAQs remain when flags are off. |
| 16.1 | Support — AI-generated images FAQ does not distinguish legacy menu images from the invited Photo Studio workflow. | Built | Chunk 8: studio-public FAQs describe the Studio workflow; menu FAQs stay behind flags. |
| 16.1 | Support — Cutout “Beta” and plan-allowance wording could be confused with the controlled Studio beta. | Built | Chunk 8: cutout/plan FAQs are not shown on the studio-public Support page. |
| 16.1 | Support — first-menu workflow describes the legacy menu builder, not Studio dish-photo onboarding. | Built | Chunk 8: studio-public Support CTA is waitlist, not “create your menu.” |
| 16.1 | Support — rate-limit FAQ describes legacy plan limits, not Studio credit balances. | Built | Chunk 8: studio-public Support omits menu rate-limit FAQs; credits are admin-granted. |
| 16.1 | Support — exported-files FAQ states 30/90/180-day menu-export retention. | Built | Chunk 8: export-retention FAQ is parked with the menu Support set. |
| 16.1 | Pricing — plan cards list legacy menu-generation allowances that could be confused with Studio credits. | Built | Chunk 8: studio-public `/pricing` hides plan cards; waitlist + `support@gridmenu.ai` only. |
| 16.1 | Pricing — Creator Pack/export-storage FAQ describes legacy packaging and retention. | Built | Chunk 8: menu pricing FAQs are not shown on the studio-public pricing page. |
| 16.1 | Pricing — upgrade FAQ refers generically to preserved “credits.” | Built | Chunk 8: studio-public pricing has no upgrade/credits FAQ; credits are admin-granted. |
| 16.1 | Pricing — premium/public CTA copy (“Unlimited everything”, “photo-perfect menus”, and related positioning). | Built | Chunk 8: studio-public pricing is private-beta / waitlist copy. |
| 16.1 | Privacy — aggregated/derivative-data ownership wording does not distinguish uploaded originals, generated Studio outputs, and analytics-derived data. | Built | Chunk 8 follow-up: user owns source photos and generated variants; Gorrrf may ask to use outputs; aggregated data remains Gorrrf-owned. |
| 16.1 | Privacy — information-sharing wording does not name AI image-generation processing as a provider activity. | Built | Names Google Gemini and allows other subprocessors for the same functions. |
| 16.1 | Terms — subscription, Creator Pack, image-regeneration, and fair-use clauses remain scoped to legacy menu plans. | Built | Grid+ / Creator Pack commercial terms removed. Forward-looking 12-month credit packs noted without a live SKU. |
| 16.1 | Terms — no dedicated statement covers Photo Studio access, dish-photo uploads, Studio retention, credits, or the controlled beta. | Built | Private-beta Terms: invite-only, admin-granted credits, no generation SLA, provider watermarks. |
| 10 | Requirement 10 coverage carried manually | Manual / deferred | Studio component surfaces (10.8), the admin feedback read path, `/api/studio/access`, and hands-on Chunk 6 regression checks remain covered by task 19 and the documented private-beta smoke path; parsing/decision and beta-route coverage remain partial as recorded in the task notes. |

### Development phases (§10)

| Phase | Goal | Status | Chunk |
|---|---|---|---|
| 0 | Safety & setup (branch, flags, hide legacy nav, verify pipeline, document it) | Built | Chunk 1 — live Photo Control smoke check still manual (see `IMAGE_PIPELINE_NOTES.md`) |
| 1 | Customer-facing Photo Studio shell | Built | Chunk 2 — `/studio` + `studio_images` persistence |
| 2 | Image library per dish | Built | Chunk 3 — `studio_dishes` + dish library on `/studio` |
| 3 | Background & lighting reference libraries | Built | Chunk 4 — `studio_*_styles` + admin CRUD + FOH tiles |
| 4 | Controlled prompt/state layer | Built | Chunk 5 — extract/delta/compose + §5.2 identity locks + post-gen re-extract soft validation on `metadata.validation`. |
| 5 | Credits & usage control | Built | Chunk 6 — deployed to production in `e9c856c` (confirmed 2026-07-28); see `BUILD_PLAN_CHUNK_06.md` and deploy backlog. |
| 6 | MVP market test | Built | Chunks 7–8. Original requirements closed 2026-08-14. Production env cutover and remaining product items are in `PIVOT_REMAINING_WORK.md`. |
| 7 | Plating/vessel experimentation | Deferred | |

### Phase 6 delivered scope — Chunk 7

| Phase | Delivered scope | Status | Evidence |
|---|---|---|---|
| 6 | Controlled beta gate and admin cohort controls | Built | `studio_beta_access`, three-mode access resolution, grant/revoke route and admin panel. |
| 6 | First-run onboarding and non-sensitive Studio states | Built | Workflow panel, access/no-credit/blocked-dish states, and accessible loading/error/empty handling. |
| 6 | Feedback loop and admin review path | Built | `studio_image_feedback`, owner validation, optional feedback UI, and recent-feedback admin read path. |
| 6 | Consent-aware funnel instrumentation | Built | Registered Studio events, allow-listed non-PII payloads, and existing analytics wrappers. |
| 6 | Supplementary-page readiness audit | Built | Pricing/Privacy corrections landed; unresolved findings and manual Requirement 10 coverage are recorded above. |

### Phase 6 delivered scope — Chunk 8

| Phase | Delivered scope | Status | Evidence |
|---|---|---|---|
| 6 | Studio-first public homepage, SEO, sitemap | Built | `isStudioPublicSurface()`; `STUDIO_SEO`; parked menu URLs `noindex` and omitted from sitemap. |
| 6 | Waitlist/invite public promise | Deviation | Chunk 8 shipped waitlist CTAs. 2026-08-18: public homepage/support copy is self-serve credits; `/studio` can still show account-approval waitlist when the admin toggle is on. |
| 6 | Post-login `/studio` | Built | Auth callback and magic-link default `next`; onboarding skipped for this path. |
| 6 | Supplementary pages for studio-first | Built | Pricing waitlist page; Support Studio FAQs; Settings waitlist-gated; restaurant/menu-currency hidden when legacy nav is off. |

---

## 3. Chunk log

| Chunk | Scope | Branch | Status |
|---|---|---|---|
| 1 | Phase 0: pivot docs, feature flags, hide legacy nav, verify + document generation pipeline | `studio/chunk-01-foundations` | Deployed prod 2026-07-24 — see `docs/pivot/BUILD_PLAN_CHUNK_01.md` |
| 2 | Phase 1: customer-facing `/studio` shell with persistence | `studio/chunk-02-studio-shell` | Deployed prod 2026-07-24 — see `docs/pivot/BUILD_PLAN_CHUNK_02.md` |
| 3 | Phase 2: image library per dish (`studio_dishes` + dish-scoped gallery) | `studio/chunk-03-dish-library` | Deployed prod 2026-07-24 — see `docs/pivot/BUILD_PLAN_CHUNK_03.md` |
| 4 | Phase 3: background & lighting reference libraries (DB-backed, admin-managed) | `studio/chunk-04-reference-libraries` | Deployed prod 2026-07-24 — see `docs/pivot/BUILD_PLAN_CHUNK_04.md` |
| 5 | Phase 4: controlled prompt/state layer (identity locks + post-gen validation) | `studio/chunk-05-prompt-state-layer` | Deployed prod 2026-07-24 — see `docs/pivot/BUILD_PLAN_CHUNK_05.md` |
| 6 | Phase 5: credits & usage control (Studio ledger, mutate gate, admin grants, FOH balance, dish failure breaker) | `main` | Deployed prod (`e9c856c`; confirmed by LC 2026-07-28) — see `docs/pivot/BUILD_PLAN_CHUNK_06.md` |
| 7 | Phase 6: controlled beta market-test readiness (beta access, onboarding, feedback, funnel instrumentation, supplementary-page review) | `main` | Built — see `docs/pivot/BUILD_PLAN_CHUNK_07.md` |
| 8 | Studio-first public cutover (park menus; waitlist homepage/pricing/support; post-login `/studio`) | `main` | Built — see `docs/pivot/BUILD_PLAN_CHUNK_08.md`. Production env cutover still pending. |

---

## 4. Patches log

Work outside the requirements phase/chunk sequence (bug fixes, infra patches, etc.).
Record in `docs/pivot/PATCH_<slug>_<date>.md` rather than as a new chunk.

| Date | Scope | Branch | Status |
|---|---|---|---|
| 2026-07-27 | Direct-to-Supabase upload (413 fix, 9 MiB cap) | `main` | Deployed prod (`e9c856c`; confirmed by LC 2026-07-28) — see `docs/pivot/PATCH_DIRECT_SUPABASE_UPLOAD_2026-07-27.md` |
| 2026-07-28 | Studio JSON metadata defects — Group A model-call configuration, Group B scene-descriptor payload redesign, and Group D documentation rewrite | `main` | Independent patch (no chunk number); built — not deployed. Manual production deploy is pending, and migration `075` must be applied before Group B app code. |
| 2026-08-14 | Studio first-upload sign-in timeout (GoTrue auth lock + signed upload URL) | `main` | Built — see `docs/pivot/PATCH_STUDIO_UPLOAD_AUTH_LOCK_2026-08-14.md`. No migration or env var. |
| 2026-08-14 | Name dish before first Studio upload (stop auto-creating "My dishes") | `main` | Built — see `docs/pivot/PATCH_STUDIO_NAME_DISH_BEFORE_UPLOAD_2026-08-14.md`. No migration or env var. |
| 2026-08-15 | Studio NB Pro credit cost 3 → 2 | `main` | Built — see `docs/pivot/PATCH_STUDIO_NB_PRO_CREDIT_COST_2026-08-15.md`. Confirm/set `STUDIO_CREDIT_COST_NB_PRO=2` in Vercel if the old `3` is still set. |
| 2026-08-15 | Studio export tile actions (credits on Generate; tap preview; regenerate icon) | `main` | Built — see `docs/pivot/PATCH_STUDIO_EXPORT_TILE_ACTIONS_2026-08-15.md`. No migration or env var. |
| 2026-08-15 | Workbench parent-variant chip (`From OG` / `From Vn`) | `main` | Built — see `docs/pivot/PATCH_STUDIO_PARENT_VARIANT_CHIP_2026-08-15.md`. No migration or env var. |
| 2026-08-17 | Workbench full-frame viewport (fit/zoom/pan; 3:1 upload rail) | `main` | Built — see `docs/pivot/PATCH_STUDIO_WORKBENCH_VIEWPORT_2026-08-17.md`. No migration or env var. |
| 2026-08-18 | Studio public homepage copy (self-serve CTAs; drop menu-subscription FAQ) | `main` | Built — see `docs/pivot/PATCH_STUDIO_PUBLIC_HOMEPAGE_COPY_2026-08-18.md`. No migration or env var. |
