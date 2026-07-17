# Build Plan — Chunk 1: Phase 0 Safety & Setup

**Requirements refs:** §9.3 (feature flags), §10 Phase 0, §7.1 acceptance criterion "legacy menu
navigation hidden behind feature flag".

**Goal:** make the pivot reversible and prepare the ground so Chunk 2 (the customer-facing
`/studio` shell) is purely additive. No customer-visible Photo Studio features ship in this chunk;
the only visible change is that legacy menu-builder navigation disappears when the flag is set.

---

## Scope

### 1. Pivot documentation in-repo (done)

- `docs/pivot/GridMenu_Photo_Studio_Pivot_Requirements_2026-07-16.md` — source requirements.
- `docs/pivot/PIVOT_TRACKER.md` — living traceability/decisions document.
- This build plan.

### 2. Feature flag module

Create a small typed module, e.g. `src/lib/product-mode.ts`, following the existing env-var flag
pattern (cf. `src/lib/background-removal/feature-flag.ts`):

```ts
// Conceptual shape — final API to be agreed at implementation time
export type ProductMode = 'menu-builder' | 'photo-studio';
export function getProductMode(): ProductMode;      // NEXT_PUBLIC_PRODUCT_MODE, default 'menu-builder'
export function isPhotoStudioEnabled(): boolean;    // NEXT_PUBLIC_ENABLE_PHOTO_STUDIO
export function isLegacyMenusEnabled(): boolean;    // NEXT_PUBLIC_ENABLE_LEGACY_MENUS, default true
```

Notes:

- Env-var flags (not the DB `feature_flags` table) because these are deploy-time product-mode
  switches, not per-user runtime toggles; they must also be readable in client components
  (`NEXT_PUBLIC_`). DB flags can still be used later for per-user beta gating.
- Defaults must preserve current behaviour when the vars are absent, so `main` is unaffected
  until we opt in per environment.
- Add the new vars to `env.example` (and `.env.production.example`) with comments.
- Deviation from doc: skip `NEXT_PUBLIC_ENABLE_EXPERIMENTAL_CAMERA` and
  `NEXT_PUBLIC_ENABLE_PLATING_SWAP` for now — nothing consumes them yet; add when the features
  arrive (avoids dead config).

### 3. Hide legacy menu-builder navigation behind the flag

- `src/components/ux/UXHeader.tsx`: when product mode is `photo-studio` and legacy menus are
  disabled, hide menu-builder navigation items (Dashboard/menus links as applicable); keep
  Admin, Settings, Support, auth controls.
- Audit other prominent entry points (marketing homepage CTAs can wait until the landing-page
  decision in the tracker is made; record as a follow-up).
- Menu routes themselves stay accessible by URL — Phase 0 only hides navigation, it does not
  remove the product.

### 4. Verify and document the current generation pipeline (§10 Phase 0, tasks 4–5)

- Manually verify `/admin/photo-control` works end-to-end in dev (upload → stage changes →
  generate) and note any breakage.
- Write `docs/pivot/IMAGE_PIPELINE_NOTES.md` covering, for reuse in Chunk 2:
  - endpoints: `/api/admin/photo-control/extract` and `/mutate`; enqueue path
    `/api/generate-image` + `image_generation_jobs` worker (`src/lib/image-generation/job-executor.ts`);
  - prompt construction: `src/lib/photo-control/` (state, delta, directive, composer, mutation engine);
  - storage: `ai-generated-images` bucket conventions vs Photo Control's current
    non-persisted data-URL outputs (a gap Chunk 2 must close);
  - models and per-generation cost assumptions (NB2 vs NB Pro) to seed later credit pricing;
  - kill-switches: `AI_IMAGE_GENERATION_DISABLED` etc.

### 5. Tests

- Unit tests for the flag module (defaults, parsing, each mode).
- Header test: menu-builder nav hidden/shown per flag state.

## Out of scope for this chunk

- Any `/studio` route or FOH UI (Chunk 2).
- Data model changes / migrations (Chunk 2–3).
- Landing page changes (pending ICP/SEO feedback — see tracker decisions log).
- Credits (Phase 5).

## Acceptance criteria

- [ ] Requirements doc, tracker, and pipeline notes exist in `docs/pivot/`.
- [ ] Flag module exists with tests; new vars documented in `env.example`.
- [ ] With flags unset, the app behaves exactly as today.
- [ ] With `NEXT_PUBLIC_PRODUCT_MODE=photo-studio` and `NEXT_PUBLIC_ENABLE_LEGACY_MENUS=false`,
      legacy menu navigation is hidden; admin area unaffected.
- [ ] Photo Control sandbox confirmed working; pipeline documented.
- [ ] Existing test suite still passes.

## Estimated shape

Roughly: 1 new lib file + tests, 1 nav component edit + test, 2 env example file edits,
2–3 docs. No migrations, no API changes.
