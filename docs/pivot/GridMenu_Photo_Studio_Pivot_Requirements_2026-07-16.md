# GridMenu Pivot Requirements — AI Food Photo Studio Sandbox

**Date:** 16 July 2026  
**Working product direction:** GridMenu Photo Studio / Photo Control  
**Purpose:** General requirements and development sequencing document for continuing the sandbox build in a new chat and/or IDE workflow.

---

## 1. Executive Summary

GridMenu should pivot from being primarily positioned as a menu builder for busy restaurateurs into a **prompt-free AI food photography control tool** for people responsible for creating commercial food imagery.

The current menu-builder application already contains valuable infrastructure: authentication, subscriptions, Supabase storage, image generation, image management, admin tooling, usage tracking, menu export, and deployment pipelines. The pivot should therefore **reuse the existing codebase and platform**, while introducing a new customer-facing Photo Studio workflow that becomes the primary product surface.

The recommended MVP is:

> Upload a real food photo → apply controlled edits → generate commercial-ready variants → manage image library per dish → download/export.

The strongest product promise is not generic AI image generation. It is:

> **Controlled food-photo transformation that preserves what the dish actually is.**

The immediate priority is to make the product intuitive for non-prompting users, while using structured prompts, JSON state, reference libraries, and validation internally.

---

## 2. Strategic Pivot

### 2.1 Previous positioning

GridMenu has been positioned as an AI-assisted menu builder for independent F&B operators, with workflows including:

- login and account/session management;
- restaurant/menu creation;
- menu item management;
- OCR/manual item entry;
- AI image generation;
- menu layout configuration;
- PDF/HTML export;
- subscription management;
- admin tooling.

This has resulted in a comparatively rich application, but the early ICP appears to drop off when the workflow requires anything that feels technical, structured, or effortful.

### 2.2 New positioning

The recommended new positioning is:

> **An AI food photo studio for menu designers, F&B marketers, agencies, delivery-first brands, and restaurant teams that need polished commercial food visuals without prompt engineering.**

Possible external-facing phrasing:

- **Prompt-free AI food photography editing for menus, delivery apps, and restaurant marketing.**
- **Turn real dish photos into polished, menu-ready campaign assets.**
- **Create consistent food-photo variants while keeping the dish itself accurate.**

### 2.3 New target ICP

Primary target ICP should move away from the time-poor independent restaurateur as the first buyer/user.

Recommended early ICPs:

| Segment | Why it is attractive | Notes |
|---|---|---|
| Menu designers | Already understand food visuals and menu production | Likely to value control and repeatability |
| F&B marketing freelancers | Need fast campaign/social assets | May be price-sensitive, but useful for feedback |
| Restaurant marketing agencies | Multi-client use case and repeat image workflows | Longer sales cycle but stronger expansion path |
| Ghost kitchens / delivery-first brands | Need accurate menu and delivery imagery at scale | High sensitivity to dish fidelity |
| Small restaurant groups | More professional needs than single outlets | Potentially better willingness to pay |

Secondary future ICPs can include packaged food, beverage brands, cosmetics, candles, and small ecommerce products. However, the initial go-to-market should stay food-specific to avoid becoming a generic product photography tool too early.

---

## 3. Product Strategy

### 3.1 Build horizontally, sell vertically

The internal architecture should be general enough to support future controlled image editing verticals, but the external product should remain food-focused at MVP.

Core transferable engine concepts:

- subject identity lock;
- reference image libraries;
- background/surface control;
- lighting control;
- prop and element control;
- plating/vessel control;
- composition and crop control;
- output-channel presets;
- JSON-based image state;
- validation/equality scoring;
- credit/usage accounting.

### 3.2 Menu builder becomes secondary

The existing menu builder should not be deleted immediately. It should be hidden or de-emphasised while the Photo Studio workflow is validated.

Recommended product hierarchy:

1. **Photo Studio** — primary product surface.
2. **Image library / asset management** — supporting product surface.
3. **Menu export / layout generation** — optional downstream export path.
4. **Legacy menu builder** — hidden, retained, or migrated after validation.

---

## 4. Current Sandbox State

The current sandbox page is named **Photo Control** and is currently located in an admin/testing area.

Observed/current controls include:

- photo upload / replace photo;
- source image preview;
- pending changes counter, currently capped at 3;
- apply changes to photo action;
- camera angle controls: Top-Down, 45°, Eye-Level, Macro Close-Up;
- lighting controls: Low-Key and Bright & Airy;
- garnish controls with add/remove;
- sides controls with add/remove;
- model selection, currently including Gemini 3.1 Flash Image / Nano Banana 2;
- admin session prompt count.

This is directionally aligned with the new product. The main change is that it should move from an admin-only sandbox to a customer-facing, intuitive workflow.

---

## 5. Core Product Principles

### 5.1 User controls, not prompt boxes

The user should not need to know JSON, camera terminology, model names, or prompt engineering techniques.

User-facing controls should be simple:

- change background;
- change lighting;
- remove clutter;
- add garnish;
- remove garnish;
- add side;
- create cut-out;
- create delivery app image;
- create social image;
- create menu image;
- rotate dish;
- make brighter;
- make premium/dark;
- keep dish accurate.

Internally, these controls should generate structured prompts and hidden JSON state.

### 5.2 Preserve the dish

The main differentiator should be controlled transformation rather than fantasy generation.

Default behaviour should be:

- preserve the original dish identity;
- preserve ingredient/component count where visible;
- preserve vessel/plate/bowl unless the user explicitly changes it;
- preserve colours and textures unless explicitly changed;
- avoid adding new food, props, hands, text, labels, logos, napkins, or cutlery unless selected.

### 5.3 Stage changes before generation

The existing pending-changes concept is good and should be retained.

Recommended behaviour:

- allow users to stage up to 3 compatible changes;
- warn against stacking unrelated changes;
- show a human-readable summary before generation;
- allow easy reset/remove before applying;
- use separate jobs for materially different transformations.

### 5.4 MVP should prioritise reliable transformations

The MVP should favour transformations that are likely to work consistently:

- lighting changes;
- background/surface changes;
- dish clean-up;
- garnish add/remove;
- side add/remove;
- crop and composition variants;
- cut-out/transparent background;
- same-plane rotation;
- overhead view only where technically feasible.

Avoid leading with high-risk transformations such as true eye-level side-view conversion.

---

## 6. Best Practices Updates Required

The existing best-practices document should be updated to reflect the new product direction and the lessons from camera-angle testing.

### 6.1 Camera angle manipulation should be downgraded

Current assumptions around “eye-level” shots should be revised.

Issue:

- “Eye-level” is ambiguous and often interpreted by image models as a normal 30–45° food photography view.
- True 0° side-view camera changes are not simple edits; they require reconstructing hidden 3D surfaces and background geometry.
- This introduces unavoidable hallucination risk.
- In food images, the model may snap back to 45° because that angle preserves recognisable food layout and common commercial food-photo priors.

Updated principle:

> Treat camera pitch changes as constrained novel-view synthesis, not normal image editing.

### 6.2 Pivot from camera pitch changes to safe composition controls

Recommended replacement controls:

- keep current angle;
- same-plane subject rotation;
- top-down/overhead variant where feasible;
- crop/zoom/macro close-up;
- centre dish;
- add negative space;
- channel-specific aspect ratios.

The current “Eye-Level” control should be removed from customer-facing MVP, renamed as experimental, or made admin-only.

Possible replacement camera/composition controls:

| Current control | Recommended MVP treatment |
|---|---|
| Top-Down | Keep, but mark as experimental if source is not already close to overhead |
| 45° | Use as “standard menu angle” only where generation/reconstruction is acceptable |
| Eye-Level | Remove from FOH MVP or keep admin-only |
| Macro Close-Up | Keep as crop/composition rather than physical camera reconstruction |
| New: Rotate Dish | Add as a safer same-plane control |
| New: Output Crop | Add square, 4:5, 16:9, PDF/menu tile presets |

### 6.3 Structured prompts remain important

The best-practices document should retain and expand:

- JSON state anchors;
- source image analysis;
- target state definition;
- preservation/identity locks;
- compact prompt design;
- validation/equality checks;
- reference image roles.

### 6.4 Reference image libraries become a core feature

The guide should evolve from prompt-only best practices into a product architecture for reference-guided editing.

Required reference libraries:

1. Background/surface library.
2. Lighting style library.
3. Plating/vessel style library.
4. Optional future prop/style library.
5. Optional future brand preset library.

---

## 7. MVP Feature Requirements

## 7.1 Customer-facing Photo Studio

### Requirement

Create a customer-facing Photo Studio route outside the admin area.

Suggested route:

```text
/studio
```

or:

```text
/app/studio
```

### Acceptance criteria

- User can access Photo Studio after login.
- Photo Studio is visible in main navigation when feature flag is enabled.
- Admin-only language is removed from FOH.
- Existing menu builder navigation is hidden or moved behind a legacy link/feature flag.
- User can upload a source food image and see it in the workspace.

---

## 7.2 Dish/Image Project Model

### Requirement

Create a lightweight project/image model that supports image workflows without depending on menu/menu-item records.

Suggested conceptual model:

```text
photo_projects
  id
  user_id
  name
  type
  created_at
  updated_at

photo_dishes
  id
  project_id
  user_id
  name
  description
  created_at
  updated_at

image_assets
  id
  user_id
  project_id
  dish_id
  source_asset_id
  role: source | generated | cutout | export | reference
  storage_path
  thumbnail_path
  mime_type
  width
  height
  analysis_json
  generation_prompt
  generation_model
  created_at

image_edits
  id
  user_id
  project_id
  dish_id
  source_asset_id
  output_asset_id
  edit_type
  controls_json
  prompt_json
  validation_json
  status
  cost_credits
  created_at
```

### Acceptance criteria

- User can upload and store source images.
- Generated images are linked back to source images.
- Multiple generated variants can exist per dish.
- Image history can be displayed and reused.
- Existing menu/image structures are not forced to carry the new workflow unless they genuinely fit.

---

## 7.3 Image Library Per Dish

### Requirement

Each dish should have an image library containing source images, generated variants, cut-outs, exports, and possibly rejected outputs.

### User-facing features

- View all images for a dish.
- Mark one image as favourite/default.
- Compare before/after.
- Download individual image.
- Reuse an existing generated image as the new source.
- Delete/archive unwanted variants.
- See which transformation created each image.

### MVP acceptance criteria

- User can see source image and generated outputs in a simple gallery.
- User can download generated outputs.
- User can select an image as the current working image.
- Image variants persist across sessions.

---

## 7.4 Lighting Manipulation

### Requirement

Keep and strengthen lighting manipulation as a core MVP feature.

### Initial lighting styles

- Bright & Airy.
- Low-Key / dramatic.
- Soft Natural Window Light.
- Clean Delivery App Lighting.
- Warm Restaurant Ambient.
- Premium Editorial.

### Reference library requirement

Lighting styles should be backed by a curated reference library or structured internal examples.

Each lighting style should include:

```text
name
short_description
reference_image_path or reference_prompt
prompt_fragment
negative_constraints
preview_thumbnail
is_active
sort_order
```

### Acceptance criteria

- User can select one lighting style at a time.
- The selected style generates a clear staged change.
- The prompt preserves dish identity while changing only lighting/mood.
- Output does not randomly add props or ingredients.

---

## 7.5 Background and Surface Swapping

### Requirement

Add a background/surface replacement feature using a reference library.

### Initial background/surface styles

- Clean white studio.
- Warm beige ceramic/tabletop.
- Dark slate.
- Rustic wood.
- Marble counter.
- Neutral delivery-app background.
- Premium dark restaurant surface.
- Bright café table.

### Reference library requirement

Each background should be treated as a style/reference target, not as a random free-text prompt.

Suggested metadata:

```text
id
name
category: surface | environment | backdrop
thumbnail_path
reference_image_path
prompt_fragment
constraints
allowed_with_food_types
is_premium
is_active
sort_order
```

### Prompting rule

The background/surface may change, but the dish, vessel, food count, and core food appearance should remain locked unless the user explicitly changes them.

### Acceptance criteria

- User can choose a background/surface from a visual library.
- Generated output replaces or restyles the background without changing the dish.
- Background does not introduce unwanted props by default.
- Background library can be managed by admin initially.

---

## 7.6 Plating and Vessel Style Library

### Requirement

Add a means to change or standardise plating style using a reference library.

Examples:

- white round plate;
- warm beige ceramic plate;
- shallow bowl;
- deep bowl;
- wooden board;
- slate board;
- takeaway/delivery container;
- premium restaurant plate;
- casual café plate.

### Important risk

Changing the plate/bowl is more intrusive than changing lighting or background. It can alter food geometry and cause reconstruction issues.

### MVP recommendation

For MVP, plating/vessel changes should be:

- admin-only or experimental; or
- limited to simple vessel clean-up/standardisation;
- offered after lighting/background workflows are stable.

### Acceptance criteria for first release

- Admin can create plating style references.
- User-facing plating swap can be hidden initially.
- System can preserve food while changing vessel only in simple cases.
- Validation checks should flag major food structure changes.

---

## 7.7 Dish Element Manipulation

### Requirement

Keep and expand the existing add/remove controls for dish elements.

Initial categories:

- garnishes;
- sides;
- sauces;
- cutlery;
- napkins/props;
- clutter removal.

### MVP default behaviour

Default should be conservative:

- remove selected item;
- add selected garnish/side only;
- do not add unrelated items;
- do not change plate or background unless explicitly selected.

### Acceptance criteria

- User can add a garnish from text input or predefined suggestions.
- User can remove detected/listed garnishes.
- User can add a side item.
- User can remove side items or clutter.
- Changes appear in pending changes before generation.

---

## 7.8 Subject Rotation and Composition (DEFERRED / PARKED)

### Requirement

[DEFERRED BEYOND CURRENT PHASE] Replace risky camera-angle manipulation with safer subject/composition controls.

Recommended controls (Deferred to future roadmap):

- rotate dish left/right within same visual plane;
- centre dish;
- create more negative space;
- crop to square;
- crop to portrait 4:5;
- crop to landscape 16:9;
- create menu tile crop;
- create delivery-app crop;
- create social post crop;
- create close-up crop.

### Camera-angle caveat

[DEFERRED BEYOND CURRENT PHASE] True pitch changes should be hidden from MVP or kept experimental.

Allowed MVP camera/composition options:

- keep current perspective;
- top-down/overhead where feasible;
- same-plane rotation;
- macro/crop close-up;
- standard crop presets.

### Acceptance criteria

- [PARKED] Customer-facing UI does not promise reliable eye-level/0° conversion.
- [PARKED] Any “overhead” feature is clearly treated as a transformation that may be best-effort.
- [PARKED] Same-plane rotation avoids major background hallucination.
- [PARKED] Output still preserves dish identity and vessel unless otherwise requested.

---

## 7.9 Output Packs

### Requirement

Create useful commercial output packs from one source image.

Suggested MVP pack:

- Clean menu image.
- Delivery app square image.
- Instagram/social 4:5 image.
- Transparent cut-out.
- Premium dark-background version.
- Bright natural-light version.

### Acceptance criteria

- User can generate one output at a time initially.
- Later, user can generate a pack in batch.
- Each output is saved to the image library.
- User can download all outputs or individual images.

---

## 7.10 Model Selection

### Requirement

Keep model selection admin-visible, not necessarily user-facing in MVP.

Recommended default:

- Gemini 3.1 Flash Image / Nano Banana 2 as default production model.
- Nano Banana Pro / Gemini 3 Pro Image as admin or escalation option.

### User-facing recommendation

Do not expose model names to normal users initially. Use quality/speed language only if needed:

- Standard.
- High Quality.
- Experimental.

### Acceptance criteria

- Admin can choose/test model.
- Customer sees a simple generation experience.
- Model used is stored against each generated image.
- Credit cost can vary by model internally.

---

## 8. Pricing and Packaging

## 8.1 Pricing direction

A credits-based model is likely better aligned to image generation because cost is usage-driven and users understand paying for generations/outputs.

However, subscriptions may still be useful for predictable recurring revenue and entitlement management.

Recommended structure:

> Hybrid model: subscription plans include monthly credits, with optional top-up packs.

### Example conceptual structure

| Plan type | Description |
|---|---|
| Free trial | Small number of watermarked or low-res generations |
| Starter | Monthly credits for light users/freelancers |
| Pro | Higher monthly credits, HD downloads, batch tools |
| Agency | Multi-client workspaces, team seats, higher credit pool |
| Credit top-up | One-off additional credits |

### Credit accounting considerations

Credit cost should vary by:

- model used;
- image resolution;
- number of candidates;
- batch generation;
- cut-out/background removal;
- Pro/high-quality mode;
- failed/refunded jobs if appropriate.

### MVP recommendation

For first market test:

- implement usage ledger early;
- keep Stripe subscription foundations if already built;
- add simple credit deduction around generation jobs;
- delay complex plan packaging until user behaviour is clearer.

---

## 9. Application Architecture Recommendations

## 9.1 Existing repo vs new repo

Recommended approach:

> Use the existing repo. Build the new product surface in a pivot branch and merge behind feature flags.

Avoid starting a new repo unless the existing codebase actively blocks progress.

### Rationale

Existing app already has:

- auth;
- session management;
- Supabase integration;
- image generation clients;
- storage;
- subscriptions/billing foundations;
- deployment config;
- admin tooling;
- analytics.

A new repo would duplicate overhead and slow down validation.

## 9.2 Branching approach

Suggested branch:

```bash
git checkout main
git pull
git checkout -b pivot/photo-studio-mvp
```

Merge back into `main` behind feature flags once stable.

## 9.3 Feature flags

Suggested environment variables:

```env
NEXT_PUBLIC_PRODUCT_MODE=photo-studio
NEXT_PUBLIC_ENABLE_LEGACY_MENUS=false
NEXT_PUBLIC_ENABLE_PHOTO_STUDIO=true
NEXT_PUBLIC_ENABLE_EXPERIMENTAL_CAMERA=false
NEXT_PUBLIC_ENABLE_PLATING_SWAP=false
```

## 9.4 Route structure

Suggested route groups:

```text
/app
  /(marketing)
  /(auth)
  /(photo-studio)
    studio/
    studio/projects/
    studio/projects/[projectId]/
    studio/dishes/[dishId]/
  /(account)
    billing/
    settings/
  /(legacy-menu-builder)
    menus/
  /(admin)
    admin/
```

## 9.5 Migration from admin sandbox to FOH

The existing Photo Control admin sandbox should become the prototype basis for the customer-facing Photo Studio.

Required changes:

- remove “Back to Admin” from customer flow;
- remove admin-only prompt counters from normal users;
- replace model names with friendly quality modes;
- add customer navigation;
- add project/image persistence;
- add usage/credit checks;
- add empty states and onboarding copy;
- hide legacy menu features from primary navigation.

---

## 10. Suggested Development Running Order

## Phase 0 — Safety and setup

**Goal:** make the pivot reversible.

Tasks:

1. Create `pivot/photo-studio-mvp` branch.
2. Add feature flags for product mode and legacy menu visibility.
3. Keep legacy menu builder intact but hidden from primary nav.
4. Confirm current image generation pipeline works from the sandbox.
5. Document current image generation endpoints, workers, storage paths, and cost assumptions.

Outcome:

- Safe branch exists.
- Legacy product not destroyed.
- Photo Studio can be built without blocking production app.

---

## Phase 1 — Customer-facing Photo Studio shell

**Goal:** move from admin experiment to usable FOH surface.

Tasks:

1. Create `/studio` route.
2. Add upload/replace image.
3. Add source image preview.
4. Add pending changes panel.
5. Add apply/generate action.
6. Add output preview area.
7. Save generated image to user account.
8. Add download button.

Recommended MVP controls:

- Bright & Airy.
- Low-Key.
- Remove clutter.
- Add/remove garnish.
- Add/remove side.
- Crop square.
- Crop 4:5.
- Transparent cut-out if already reliable.

Defer:

- plating swap;
- true eye-level camera conversion;
- complex pack generation;
- agency workspaces.

---

## Phase 2 — Image library per dish

**Goal:** make the tool useful beyond one-off generation.

Tasks:

1. Create project/dish/image asset records.
2. Display generated variants as a gallery.
3. Allow selecting an image as current working source.
4. Allow deleting/archive variants.
5. Add favourite/default image.
6. Add image metadata display for admin/dev use.

Outcome:

- Users can manage a dish’s visual history.
- Outputs are persistent and reusable.

---

## Phase 3 — Background and lighting reference libraries

**Goal:** replace free-text prompting with visual style selection.

Tasks:

1. Create admin-managed reference library model.
2. Add background/surface library.
3. Add lighting style library.
4. Add thumbnails/previews.
5. Map each selection to prompt fragments and constraints.
6. Add compatibility rules if needed.

MVP library order:

1. Lighting styles.
2. Background/surfaces.
3. Output/crop presets.
4. Plating/vessel styles later.

Outcome:

- Users select visual styles rather than writing prompts.
- Generation becomes more consistent.

---

## Phase 4 — Controlled prompt/state layer

**Goal:** make the product defensible and reliable.

Tasks:

1. Analyse source image into hidden JSON.
2. Store source image analysis.
3. Generate prompt JSON from staged controls.
4. Add preservation constraints.
5. Analyse generated output into comparable JSON.
6. Store validation results.
7. Flag obvious failures.

Initial validation dimensions:

- dish identity;
- item count;
- vessel consistency;
- background/prop additions;
- crop/framing;
- lighting/style compliance;
- forbidden object presence.

Outcome:

- Product starts to behave like a controlled image editor rather than a prompt wrapper.

---

## Phase 5 — Credits and usage control

**Goal:** support paid testing without overbuilding pricing.

Tasks:

1. Add usage ledger for generations.
2. Define credit costs by operation/model/resolution.
3. Gate generation if user has no credits.
4. Add admin credit grants.
5. Add initial Stripe credit pack or subscription mapping.
6. Show remaining credits in UI.

MVP pricing implementation:

- keep current subscription management if usable;
- add credits internally;
- allow manual/admin credit grants during private beta;
- add top-up packs once pricing is clearer.

---

## Phase 6 — MVP market test

**Goal:** get real feedback quickly.

Tasks:

1. Create short landing page for AI Food Photo Studio.
2. Create simple onboarding flow.
3. Add feedback capture after generation.
4. Add PostHog events for each stage.
5. Recruit test users from target ICP.
6. Track drop-off and repeat generation behaviour.

Key metrics:

- upload completion rate;
- first generation completion rate;
- download rate;
- repeat generation rate;
- credits consumed per active user;
- percentage of outputs manually rejected;
- user-reported quality score;
- user willingness to pay.

---

## Phase 7 — Plating/vessel style experimentation

**Goal:** test higher-risk but potentially valuable transformations.

Tasks:

1. Build plating style library in admin.
2. Test simple vessel replacement on controlled examples.
3. Add validation around food structure preservation.
4. Keep customer-facing access disabled until success rate is acceptable.

Outcome:

- Plating swap can become a premium feature if reliable.

---

## 11. MVP Scope Recommendation

## Include in MVP

- Customer-facing Photo Studio route.
- Upload source food image.
- Apply staged controlled edits.
- Lighting changes.
- Background/surface changes from curated library.
- Garnish/sides add-remove.
- Clutter removal.
- Crop/output presets.
- Transparent cut-out if already reliable.
- Image library per dish.
- Download generated outputs.
- Basic credit usage tracking.
- Hidden/admin model selection.
- Legacy menu builder hidden from primary navigation.

## Defer until after MVP

- True eye-level camera conversion.
- Advanced camera pitch manipulation.
- Plating/vessel swap in FOH.
- Batch asset packs.
- Agency/team workspaces.
- Brand kits.
- Full menu export integration.
- Public API.
- Multi-vertical expansion.

## Keep admin-only initially

- model selector;
- prompt JSON viewer;
- source/output analysis JSON;
- validation scores;
- Pro model escalation;
- experimental camera controls;
- plating swap;
- reference library management.

---

## 12. Suggested UI Changes from Current Sandbox

### Keep

- upload/replace photo;
- source image preview;
- pending changes counter;
- apply changes button;
- lighting controls;
- garnish controls;
- sides controls;
- model selector for admin/dev;
- simple card-based layout.

### Change

- Move from admin route to `/studio`.
- Replace “Photo Control” with clearer customer wording, e.g. “Food Photo Studio”.
- Hide “AI prompts this session” from customers or turn it into “Credits remaining”.
- Replace “Apply changes to photo” with “Generate image” or “Create version”.
- Replace camera-angle section with “Composition”.
- Remove or hide “Eye-Level”.
- Add background/surface style selection.
- Add image library/gallery below preview.
- Add output preview beside source preview.
- Add download/export options per generated image.

### Proposed revised control groups

1. **Style**
   - Bright & Airy
   - Low-Key
   - Natural Daylight
   - Premium Editorial

2. **Background**
   - Clean White
   - Dark Slate
   - Rustic Wood
   - Marble
   - Warm Neutral

3. **Food Elements**
   - Add garnish
   - Remove garnish
   - Add side
   - Remove side
   - Remove clutter

4. **Composition**
   - Keep current
   - Centre dish
   - More space around dish
   - Square crop
   - 4:5 social crop
   - Menu tile crop
   - Same-plane rotate left/right
   - Overhead experimental/admin-only

5. **Output**
   - Download
   - Save to library
   - Make transparent cut-out
   - Use as new source

---

## 13. Open Questions

These do not block MVP development, but should be resolved progressively.

1. Should the public brand remain **GridMenu**, or should the new product be positioned as a sub-product such as **GridMenu Photo Studio**?
2. Should the existing landing page be replaced immediately, or should Photo Studio launch as a hidden/private beta route first?
3. What is the first target buyer: menu designers, freelancers, agencies, or small restaurant groups?
4. Should early users be manually invited and given admin-granted credits?
5. Should generated images include a disclaimer when the source photo is heavily transformed?
6. Which output format matters most first: menu image, delivery app image, social image, or transparent cut-out?
7. What level of failed generation should consume credits, if any?
8. Should Pro/high-quality generations cost visibly more credits?
9. Should existing subscribed GridMenu users get access automatically?
10. Should menu export remain visible as a secondary feature after image creation?

---

## 14. Immediate Next Build Brief

Recommended next build for the IDE:

> Convert the current admin Photo Control sandbox into a customer-facing `/studio` MVP while preserving existing admin functionality and hiding legacy menu-builder navigation behind feature flags.

Specific first build ticket:

```text
Create a customer-facing Photo Studio route that allows an authenticated user to upload a food image, stage one or more simple edits, generate a transformed output using the existing image-generation pipeline, save the output to the user’s image library, and download it. Hide legacy menu-builder navigation when NEXT_PUBLIC_PRODUCT_MODE=photo-studio.
```

Acceptance criteria:

- `/studio` route exists and is accessible after login.
- User can upload/replace a source image.
- User can stage at least one lighting change.
- User can generate an output.
- Output is displayed beside or below the source image.
- Output is saved against the user.
- Output can be downloaded.
- Old menu builder is hidden from primary navigation via feature flag.
- Admin/dev controls remain available in admin area.

---

## 15. Working Product North Star

The MVP should be judged against one core question:

> Can a non-technical food marketing user upload a real dish photo and create a better commercial image in under two minutes without writing a prompt?

If yes, GridMenu has a stronger and simpler product wedge than the original menu-builder-first proposition.

---

## 16. Addendum — 17 July 2026 (in-repo additions)

Requirements added after the original document was produced. Tracked in `PIVOT_TRACKER.md` like
all other sections.

### 16.1 Supplementary page review

All supplementary/ancillary pages must be reviewed for relevancy, accuracy, and tone against the
new Photo Studio positioning, and updated or retired accordingly:

- Settings
- Support
- Pricing
- Privacy Policy
- Terms of Service
- Contact Us

Considerations:

- Copy referring to menus, restaurateurs, or menu-builder plans may need rewording or removal.
- Pricing page depends on the credits/packaging decisions in §8 and should be revisited alongside
  Phase 5.
- Legal pages (Privacy, Terms) must reflect AI image generation, upload of user photographs, and
  watermarking behaviour.
- Timing: after the Photo Studio surface exists (Phase 1+), before any public/beta launch
  (Phase 6 at the latest).

