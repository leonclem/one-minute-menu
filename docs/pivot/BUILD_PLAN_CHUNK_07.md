# Build Plan — Chunk 7: Controlled Beta Market-Test Readiness

**Requirements refs:** §5.1, §5.2, §8.1, §10 Phase 6, §13 Q4, §15, §16.1.

**Branch:** `main` (direct commits; no chunk branch).

## Goal

Prepare Photo Studio for a small, manually invited beta cohort and collect enough
behaviour and quality evidence to decide whether the product wedge is working. A
signed-in test user should understand the workflow, receive an admin-granted
credit allocation, complete a first generation, download or reject the result,
and leave structured feedback without needing prompt knowledge.

This chunk is market-test readiness, not a public launch or a pricing rebuild. The
existing admin-only safety gate remains the default until the operator explicitly
opens the beta cohort.

## Important product constraints

- Preserve the **nav-only Studio prominence** decision. Do not replace the homepage,
  change marketing CTAs, or make a public Photo Studio landing page in this chunk.
  Landing-page/SEO positioning remains a follow-up to the unresolved Q2 decision.
- Keep the minimal `studio_images`/`studio_dishes` model. Do not introduce projects,
  full asset graphs, Stripe credit packs, or agency workspaces.
- Keep Studio credits and the daily generation limit as the existing product gates.
  Upload and extraction remain free; successful mutates remain billable.
- Do not deploy to production as part of implementation. Any migration or env var
  is recorded as `Pending` in `PRODUCTION_DEPLOY_BACKLOG.md`.
- Do not change the admin Photo Control sandbox except where shared analytics or
  access helpers require regression-safe changes.

## Decisions for this chunk

1. **Controlled beta access rather than an all-authenticated opening.** Add a small
   user-level Studio beta entitlement managed by admins. Admins always retain
   access; non-admin access requires the entitlement when beta-only mode is enabled.
   Keep `NEXT_PUBLIC_STUDIO_ADMIN_ONLY=true` as the default. Do not infer access
   from credit balance alone, because a depleted invited account must remain able
   to see support and feedback states.
2. **No public marketing rewrite yet.** The first market test is an invited-product
   test reached through the existing Studio navigation. Homepage and SEO changes
   wait for the branding/ICP decision and are not hidden inside this chunk.
3. **Feedback is product data, not an analytics payload.** Persist a compact,
   user-owned feedback record for each optional response; send only non-sensitive
   funnel metadata to analytics. Free text must not be required to generate or
   download an image.
4. **Use existing consent-aware instrumentation.** Extend the established PostHog
   and conversion tracking wrappers rather than adding a second analytics client.
   Analytics failures must never affect Studio UX.
5. **Manual cohort operations are sufficient.** Admins can grant credits and beta
   access one user at a time. No invitation email campaign, self-serve signup,
   Stripe packaging, or team workspace is included.

## Scope

### 1. Beta access and operator controls

- Add an additive `studio_beta_access` record keyed by user, with enabled state,
  granting admin, optional note, and timestamps; protect writes with admin auth
  and allow a user to read only their own access state.
- Extend the Studio server gate to support admin-only, beta-only, and explicitly
  open modes without weakening the current default. The exact env switch should
  be named consistently with the existing `NEXT_PUBLIC_STUDIO_ADMIN_ONLY` flag
  and documented in both env examples if a new variable is needed.
- Add minimal admin user-management controls to grant/revoke beta access and show
  the user’s current Studio credit balance. Reuse the Chunk 6 credit grant path.
- Return clear, non-sensitive states for disabled, pending-access, no-credit, and
  blocked-dish cases. Do not expose internal prompts or model configuration.

### 2. First-run Studio onboarding

- Add a concise empty/first-run state to `/studio` explaining: upload a real dish
  photo, choose controlled changes, generate a version, and download or give
  feedback.
- Keep onboarding specific to Studio and do not require the legacy restaurant
  setup fields merely to preview the Studio workflow.
- Explain the private-beta credit model and the current support path when the user
  has no credits or lacks beta access.
- Add accessible loading, error, retry, and empty states for upload, extraction,
  generation, gallery, and feedback without changing the core editor layout.

### 3. Generation feedback loop

- Add an optional post-generation feedback affordance that supports a simple quality
  rating, reason tags (for example identity changed, style missed, unwanted prop,
  useful result), and optional free text.
- Persist feedback against the user, dish, and Studio image where available; enforce
  ownership and reasonable input length limits. Allow one response to be edited or
  superseded without deleting the generated image.
- Keep feedback non-blocking: dismissing it must leave download, reuse, and further
  editing available.
- Provide a minimal admin read path or documented admin query for reviewing feedback;
  a full analytics dashboard is out of scope.

### 4. Funnel instrumentation

Add consent-aware events using the existing analytics wrappers. The event registry
should cover the funnel at minimum:

- Studio viewed / access denied;
- onboarding viewed;
- upload started / completed / rejected;
- extraction completed / failed;
- generation started / completed / failed / blocked by credits or dish breaker;
- image downloaded / reused as working image;
- feedback submitted / dismissed.

Events should carry only useful, non-PII properties such as coarse outcome, model
class, credit cost, validation status, and elapsed stage timing. Do not send image
bytes, prompts, free-text feedback, raw storage paths, or full extracted JSON.

### 5. Supplementary-page readiness review

Review Settings, Support, Pricing, Privacy, Terms, and Contact Us for statements
that conflict with Photo Studio, AI image uploads, credits, or the current private
beta. Make only the minimum copy/legal corrections needed for invited testing;
leave public pricing and the broader landing-page decision deferred. Record any
legal/product follow-up that cannot be resolved in this chunk.

### 6. Tests and verification

- Unit and property tests for beta-access decisions, default-safe flag parsing,
  ownership, feedback validation, and analytics payload sanitisation.
- Route tests for access grant/revoke, feedback create/update, and unauthorized or
  overlong requests.
- Component tests for first-run, no-credit, blocked, feedback, and happy-path states.
- Regression tests confirming admin Photo Control and existing Studio credit paths
  remain usable.
- Manual private-beta smoke path: grant access and credits → open Studio → upload
  → extract → generate → verify debit → download → submit feedback; also verify
  denied access, zero credits, and blocked dish behaviour.

## Out of scope

- Homepage replacement, public Photo Studio landing page, SEO campaign, or CTA
  changes (blocked on tracker Q2/branding/ICP decisions).
- Stripe credit packs, plan packaging, automatic trial credits, or refunds.
- Projects, agency/team workspaces, batch output packs, plating/vessel swaps,
  crop/output presets, and new generation controls.
- A full admin analytics dashboard, email invitation system, or CRM integration.
- Production deployment, migration application, or Vercel configuration changes.

## Acceptance criteria

- [ ] A non-admin user cannot access Studio while the default admin-only gate is on.
- [ ] An admin can grant/revoke beta access and the grant is ownership- and
      audit-protected; an invited user can access Studio without making Studio public.
- [ ] A first-run user sees a clear Studio workflow and can reach upload without
      being forced through unrelated menu-builder onboarding.
- [ ] A generated image can be rated or dismissed without blocking download or reuse.
- [ ] Feedback is persisted safely and does not contain image bytes, prompts, or
      unrestricted payloads.
- [ ] The defined Studio funnel events are emitted through existing consent-aware
      wrappers and analytics failure never breaks the product flow.
- [ ] Supplementary pages no longer make materially false claims for the invited
      beta, with unresolved public-positioning work recorded for later.
- [ ] Tests and the documented manual smoke path pass; existing admin generation
      and Studio credit behaviour do not regress.
- [ ] Tracker and production backlog updates land in the same commits as any
      implementation migration, env var, or production action.

## Expected implementation shape

Likely: one additive access/feedback migration if existing tables cannot be reused,
small Studio auth/API helpers, minimal admin controls, first-run and feedback UI,
analytics event additions, page-copy edits, and focused tests. No production deploy
is included. The final migration/env-var decision must be confirmed during design
before implementation begins.


### 7. Task 18.1 — Supplementary-page audit findings

Audit basis: source review of `/dashboard/settings` (including its child settings components), `/support`, `/pricing` and `PricingPageContent`, `/privacy`, `/terms`, and the Contact Us destination exposed by `UXFooter`. There is no standalone `/contact` route; Contact Us links to `/support`. Ground truth used for classification: Studio source and generated images are user-owned `studio_images` rows plus objects in the `ai-generated-images` Supabase bucket; there is no time-based Studio retention job; users can archive or delete images; successful Studio generation debits the separate Studio credit ledger; upload and extraction do not debit Studio credits; beta access and Studio credits are admin-granted.

| Page / location | Statement recorded | Classification | Action for this chunk |
|---|---|---|---|
| Settings (`/dashboard/settings`) | The page and its child components describe account, restaurant/menu defaults, billing subscriptions/currency, and Stripe invoices. No statement mentions Photo Studio, AI image upload, Studio image retention, Studio credits, or beta status. | No relevant conflicting statement | No edit. Keep legacy menu/billing settings unchanged. |
| Support — “What is GridMenu?” | “GridMenu is a simple tool for creating professional restaurant menus quickly” and “It focuses purely on menu creation.” | Public positioning | Leave unchanged; the public positioning/landing-page decision is deferred. |
| Support — “Are the images on GridMenu AI-generated?” | “AI-generated images are supported, but they’re optional. You can also upload and use your own photos, or provide reference images…” | Imprecise but not false for the legacy menu surface; it does not distinguish menu images from the invited Photo Studio workflow. | Leave in 18.2; avoid a broad public rewrite. |
| Support — “What is the Cutout image option, and why does it say Beta?” | Cutout removes the background from AI-generated food photos; results vary; it is labelled “Beta”; regenerating the original creates a new cutout; “image generation counts towards your plan allowance.” | Public positioning (legacy cutout beta and plan allowance, not the controlled Studio access beta) | Leave unchanged; record the distinction so “Beta” is not treated as the Studio cohort claim. |
| Support — “How do I create my first menu?” | A user can upload a photo of an existing menu or start from scratch, then generate a finished menu. | Public positioning | Leave unchanged. This describes the menu-builder workflow, not Studio dish-photo upload. |
| Support — “What are the rate limits?” | Limits vary by plan and cover image generation, exports, and batch operations. | Public positioning | Leave unchanged; these are legacy plan limits, not Studio credit balances. |
| Support — exported-files FAQ | Exported files are stored for 30/90/180 days by plan and automatically removed after that period, with re-export available. | Imprecise but not false; it is scoped to menu exports and does not state Studio-image retention. | Leave unchanged in 18.2; Privacy must separately state Studio retention behavior. |
| Support — contact card | “Get help with your account or technical issues” at `support@gridmenu.ai`. | Public positioning / support path | Keep. This is the current support path for denied access, no credits, and beta questions. |
| Pricing metadata and page introduction | The metadata says “monthly subscriptions for unlimited power” and “All plans include photo-perfect AI menu generation”; the page presents the plans as the route to AI image generation. | **Materially false for an invited Studio tester by scope/omission**: a menu plan does not grant Photo Studio access or Studio credits, and Studio credits are not self-serve purchases in this beta. | 18.2: add the minimum scope note that Studio is a separate private beta and its credits are admin-granted; do not remove or rewrite public menu pricing. |
| Pricing cards / rate-limit-linked plan features | Creator Pack, Grid+, and Grid+Premium list 50/200/300/1,000 AI image generations and plan-specific fair-use limits. | Imprecise but not false; these are legacy menu-generation allowances, not the separate Studio credit ledger. | Leave public pricing positioning unchanged; do not present these as Studio-credit packs. |
| Pricing FAQ — Creator Pack and export storage | Creator Packs last 24 months; exported files are stored for 30 days, or 90/180 days for subscribers. | Public positioning (legacy menu/export packaging) | Leave unchanged; this does not define Studio image retention. |
| Pricing FAQ — upgrade | “Your existing menus and credits are preserved and added to your new plan.” | Imprecise but not false; “credits” is legacy plan language and could be confused with admin-granted Studio credits. | Leave in 18.2; add the Studio private-beta scope note rather than rewriting the public FAQ. |
| Pricing — premium/public CTA copy | “Early access to new templates,” “Unlimited everything for the professional restaurateur,” and “photo-perfect menus.” | Public positioning | Leave unchanged; no public Studio launch or pricing rewrite is in scope. |
| Privacy — Information We Collect | The policy says GridMenu collects uploaded menu content and that this may include “images” and other information provided by the user. | **Materially false by omission for an invited Studio tester**: it does not explicitly cover user-uploaded dish photos, AI-generated Studio variants, or the associated Studio records/storage. | 18.2: add a concise Studio-specific description of source-photo upload, generated outputs, metadata, and processing. |
| Privacy — How We Use Your Information | Uses include operating the service, managing accounts, improving products, security, abuse prevention, and legal compliance, but no Studio/AI image-processing description is given. | Imprecise but materially incomplete for Studio | 18.2: clarify the Studio image-processing purpose while keeping the existing general purposes. |
| Privacy — aggregated/derivative data | “Customers retain ownership of their original content. GridMenu retains ownership of aggregated, anonymised, or derivative data generated through the operation of the platform.” | Imprecise; the policy does not clearly distinguish original uploaded photos, generated Studio outputs, and analytics/derived data. | Defer for legal/product review under §16.1; do not expand ownership language in 18.2 without approval. |
| Privacy — information sharing | Service providers are described as hosting, authentication, or analytics providers, but AI image-generation processing is not named. | Imprecise but not an express contradiction (the examples are non-exhaustive). | Defer provider/legal wording under §16.1 unless the 18.2 legal review confirms exact processor language. |
| Privacy — rights/deletion | Users may request deletion of personal data; the page does not state the operational archive/delete behavior for Studio images. | Imprecise but materially incomplete for Studio | 18.2: state that Studio images remain available without a plan-based TTL and can be archived/deleted by the user, subject to dependent-variant constraints. |
| Terms — subscription/refund and fair-use clauses | Terms refer to subscription/Creator Pack plan benefits, “50 image regenerations,” and “unlimited” edits/regenerations subject to fair use. | Public positioning (legacy menu plans and generation policy) | Leave unchanged; no Studio-credit purchase or beta-access term is stated here. |
| Terms — remaining sections | No statement specifically promises Photo Studio access, AI dish-photo upload, Studio image retention, Studio credits, or the controlled beta. | No relevant conflicting statement | No edit in 18.2; legal terms for Studio beta usage remain a deferred follow-up if needed. |
| Contact Us (`UXFooter` → `/support`) | “Contact Us” routes to `/support`; Support offers `support@gridmenu.ai` for account/technical help. Legal pages separately expose `privacy@gridmenu.ai` and `legal@gridmenu.ai`. | Public positioning / valid support path | No edit. Use `support@gridmenu.ai` as the beta support path; no standalone Contact Us page exists. |

Audit outcome: only the Pricing scope claim and the Privacy omissions are candidates for the minimal materially-false/incomplete correction in task 18.2. Legacy menu pricing, export-retention, cutout-beta, and menu-builder wording are intentionally classified as public positioning or imprecise-but-true and remain unchanged. No page copy was edited by task 18.1.


### 8. Task 21.2 — Verification record

#### Supplementary-page findings handoff

The complete supplementary-page findings list from task 18.1 is retained in section 7 above and remains the authoritative record for Settings, Support, Pricing, Privacy, Terms, and Contact Us (`UXFooter` → `/support`). It records each reviewed statement, its classification, and the action for this chunk. The resolved items are the minimum Pricing private-beta scope note and Privacy Studio upload/retention clarifications from task 18.2. The remaining legacy menu positioning, export-retention, cutout-beta, and plan-language findings remain unchanged; unresolved ownership/provider/legal wording and broader public positioning remain deferred under §16.1. There is no standalone Contact Us route; `support@gridmenu.ai` remains the beta support path.

#### Documented admin feedback SQL query

When the admin feedback read route is being reviewed through a privileged Supabase SQL session, the following query is the documented equivalent of `GET /api/admin/studio/feedback` with its default limit. It returns only the fields exposed by the route, newest submissions first; change `50` only for a bounded review query (the route clamps limits to 1–100).

```sql
SELECT
    rating,
    reason_tags,
    comment,
    dish_id,
    studio_image_id,
    user_id,
    created_at,
    updated_at
FROM public.studio_image_feedback
ORDER BY created_at DESC
LIMIT 50;
```

This query is for admin review only. It does not expose image bytes, prompts, extracted JSON, or storage paths. The corresponding application read path is admin-only at `GET /api/admin/studio/feedback?limit=<1..100>`.

#### Manual private-beta smoke path

Run this path with a non-production admin account and an invited non-admin test account in the intended private-beta environment. Record the invited user's starting Studio credit balance and the expected generation cost before starting. Do not deploy, apply migrations, or alter production data as part of this check.

1. **Grant access and credits.** In the admin user-management flow, open the combined Studio beta-access/credits action for the test user. Grant Studio beta access, optionally record the cohort note, grant the required Studio credits through the existing Chunk 6 credit path, and confirm the refreshed access state is enabled and the displayed balance matches the grant.
2. **Open Studio.** Sign in as the invited test user and open `/studio` from the existing Studio navigation (or the direct route). Confirm the first-run workflow is shown without completing unrelated restaurant or menu-builder onboarding, and that the support path and private-beta credit model are visible.
3. **Upload.** Start the upload control and select a real dish photo. Confirm upload completes and the image is available to the Studio editor; confirm no Studio credit is debited.
4. **Extract.** Run extraction and confirm the extracted dish information reaches the editor, with an accessible loading/completion or retry state as applicable. Confirm extraction does not debit Studio credits.
5. **Generate.** Choose the available controlled changes and generate a version. Confirm generation completes, the generated image appears in the gallery/editor, and the success path remains usable without exposing prompts, model configuration, provider errors, or storage paths.
6. **Verify debit.** Confirm the displayed Studio balance decreases by exactly the expected generation cost and that the corresponding Studio credit-ledger entry exists. Confirm upload and extraction were not charged.
7. **Download.** Download the generated image and confirm the download succeeds. Confirm download remains available independently of feedback.
8. **Submit feedback.** Submit optional feedback using a rating, reason tag(s), and/or comment. Confirm the submission succeeds, the feedback remains associated with the generated image, and download, reuse, and further editing remain available. Confirm the admin feedback query or admin read route can return the new row without image bytes or prompt content.
9. **Denied access.** In beta mode, sign in as a non-admin test user with no enabled beta-access row. Confirm `/studio` shows the pending private-beta/support state, generation is unavailable, and `GET /api/studio/access` returns `success: true`, `granted: false`, and `reason: denied_beta_access_required`. Also confirm an unauthenticated request to that route receives 401. In the default admin-only mode, confirm a non-admin remains denied and an admin remains able to use Studio.
10. **Zero credits.** Use an invited user whose Studio balance is zero. Confirm the user can still open Studio, upload, and extract, while generation is blocked with the no-credit/support state and no debit or ledger charge is created.
11. **Blocked dish.** Select a dish with the existing generation breaker active (use an approved local/test fixture or supported test data). Confirm the blocked-dish state explains that generation is paused and an admin must clear it, no generation debit occurs, and no internal prompt, provider, or stack-trace detail is shown.

This manual smoke path together with task 19 is the **only coverage** for the Studio UI surfaces, the admin feedback read route, and `/api/studio/access`. The automated suite does not replace these checks; task 19 additionally covers the hands-on admin Photo Control and credited-generation regression checks. No deployment or migration application is included in this verification record.
