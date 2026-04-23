# V2 Layout Engine: Current Architecture And Behaviour

This document describes how the V2 layout engine works today, based on the current implementation in `src/lib/templates/v2/`, the original feature-tile exploration plan, and the follow-up replan that corrected the first implementation's missed requirements.

Use this as the primary reference when defining future requirements for V2 layout behaviour. It is intentionally focused on the engine as implemented, not just the original intended design.

## Why this doc exists

There is already useful V2 documentation in:

- `src/lib/templates/v2/README.md`
- `src/lib/templates/v2/TEMPLATE_AUTHORING_GUIDE.md`
- `src/docs/v2-layout-engine-features-guide.md`

Those documents are still useful, but they mix stable architecture with behaviour that predates the feature-tile rework. In particular, the current engine no longer behaves as "global special rows before section items". It now uses section-aware lead-row planning for logo/header/flagship placement.

## The V2 engine in one sentence

V2 is a template-driven, region-based layout engine that:

1. normalises menu data into `EngineMenuV2`,
2. loads a YAML template,
3. streams section content through a planner-aware paginator,
4. inserts fillers after content placement,
5. validates invariants,
6. then renders the resulting `LayoutDocumentV2` to web preview or PDF.

## Main pipeline

The main entry point is `generateLayoutV2()` in `src/lib/templates/v2/layout-engine-v2.ts`.

At a high level, it does this:

1. Load and validate the template via `loadTemplateV2()`.
2. Build `PageSpecV2` from the template or caller override.
3. Optionally derive an effective `gapX` from `selection.targetCellWidthPt`.
4. Call `streamingPaginate()` to build the page/region/tile document.
5. Call `insertInterspersedFillers()` if fillers are enabled.
6. Run `validateInvariants()` in dev/debug mode.
7. Return a `LayoutDocumentV2`.

That means the paginator owns content ordering and pagination, while the filler manager only fills empty body cells after the layout is already known.

## Core building blocks

### 1. Template-driven layout

Templates live in `src/lib/templates/v2/templates/` and define:

- page size and margins,
- fixed regions (`header`, `title`, `body`, `footer`, plus optional `banner`),
- body grid settings (`cols`, `rowHeight`, `gapX`, `gapY`),
- tile variants like `ITEM_CARD`, `ITEM_TEXT_ROW`, `SECTION_HEADER`, `LOGO`, `LOGO_BODY`, and `FLAGSHIP_CARD`,
- policies such as header repetition and keep-with-next,
- optional divider and filler settings.

The template is the source of truth for tile footprint defaults and visual budgets. Behavioural decisions still happen in code.

### 2. Selection config

`SelectionConfigV2` in `src/lib/templates/v2/engine-types-v2.ts` carries runtime switches such as:

- `textOnly`
- `fillersEnabled`
- `showCategoryTitles`
- `showLogoTile`
- `showCategoryHeaderTiles`
- `showFlagshipTile`
- `showBanner`
- `centreAlignment`
- palette, texture, image, and typography options

These flags are threaded through the main menu template UI in `src/app/menus/[menuId]/template/template-client.tsx`, the main layout API route in `src/app/api/menus/[menuId]/layout/route.ts`, admin preview, and Layout Lab.

### 3. Layout document

The engine output is `LayoutDocumentV2`:

- document -> pages
- page -> regions + tiles
- tile -> type, region, footprint, grid position, style, and typed content

Renderers consume this document rather than re-running layout logic.

## Region model

V2 is region-based, not freeform.

- Static content such as header logo, title, banner, banner strip, and footer lives in fixed regions.
- Flowing menu content lives in the `body` region.
- Body content uses a logical grid with column spans and row spans.

The body grid is where almost all interesting pagination behaviour happens.

## Footprint vs content budget

This distinction is critical:

- Placement uses footprint.
- Rendering uses content budget.

For body tiles, height is derived from:

`rowSpan * rowHeight + (rowSpan - 1) * gapY`

That footprint governs:

- page fit checks,
- occupancy,
- continuation behaviour,
- fillers,
- balancing,
- invariant checks.

The template `contentBudget.totalHeight` should match the footprint, but it is not what drives placement.

## Current content ordering model

The biggest change from the first feature-tile implementation is that V2 no longer treats the logo/header/flagship as globally injected special rows before normal section content.

Instead, the engine now plans each section start as a small pool of candidate body tiles and decides how the section opens based on template width rules.

The main modules are:

- `src/lib/templates/v2/lead-row-planner.ts`
- `src/lib/templates/v2/streaming-paginator.ts`
- `src/lib/templates/v2/tile-placer.ts`

## Section-aware lead-row planning

`buildSectionPlans()` in `lead-row-planner.ts` is the section-aware planning step.

For each non-empty section it creates:

- the section itself,
- whether there should be a divider before it,
- a `leadRow` plan describing how that section should start.

Each lead-row plan includes:

- `startKind`: `section-start` or `continuation`
- `widthRule`: template-width-specific composition rules
- `candidates`: possible opening tiles
- `chosenTiles`: the opening composition that should be attempted first
- `queuedTiles`: remaining flagship/items after the lead row

### Candidate kinds

The planner currently models four opening tile kinds:

- `logo`
- `header`
- `flagship`
- `item`

This is important because it makes feature tiles peers of normal body tiles instead of one-off exceptions.

## Current feature-tile rules

These rules come from the corrected implementation, not the original exploration assumptions.

### Embedded logo tile

When `showLogoTile === true`:

- the header-region logo is suppressed,
- when no banner is present, the header region collapses to a small print-safe buffer instead of keeping the full template header height,
- a body-grid logo tile is eligible only for the globally first non-empty section,
- when placed in the body, its `colSpan` stays compact but its `rowSpan` now matches the effective item footprint for that section, so image sections keep image-card height while per-section no-image sections collapse to text-row height,
- it does not repeat on later sections,
- it does not repeat on continuation pages,
- if there are no non-empty sections, no body logo is emitted,
- the body logo carries `sectionId` ownership in its content when placed in the body.

That `sectionId` is important because fillers and section-scoped occupancy logic depend on it.

### Category header tiles

When `showCategoryHeaderTiles === true`:

- section headers use `colSpan: 1` via `resolveSectionHeaderPlacement()`,
- their `rowSpan` matches the effective item footprint for that section instead of always staying at the base YAML compact height,
- they are eligible to share the section's opening row with logo, flagship, and/or early items,
- continuation pages repeat only the header tile, not the full opening composition.

This is the main correction from the first feature-tile build. The earlier approach still effectively detached the header from the intended opening row.

### Flagship tile

When `showFlagshipTile === true` and the template defines `FLAGSHIP_CARD`:

- the first item marked `isFlagship` across the menu is promoted,
- it is emitted as `FLAGSHIP_CARD`,
- the normal item tile for that item is suppressed,
- it never repeats on continuation pages,
- it stays semantically distinct from "featured" styling,
- it falls back according to width rules instead of being demoted to a normal item.

If `textOnly` is active, the planner currently skips flagship promotion.

### Featured vs flagship

The engine still treats these as separate concepts:

- featured = normal footprint, stronger styling on standard item tiles
- flagship = alternate tile type with its own footprint and renderer path

That distinction should be preserved in future requirements.

## Width-specific lead-row behaviour

`resolveLeadRowWidthRule()` in `lead-row-planner.ts` defines the current behaviour by template width/profile.

### `1-column-tall`

- shared lead rows are impossible,
- the first lead tile is chosen in priority order,
- opening content becomes a sequential flow rather than a mixed row.

### `2-column-portrait`

- logo and header can share the lead row when `showCategoryHeaderTiles === true` (compact header, colSpan=1),
- when `showCategoryHeaderTiles === false` the header is full-width (colSpan=2) and cannot fit alongside the logo — only the logo stays in the lead row; header and flagship are both deferred to the queue with the header first,
- flagship falls to the next row as the first queued promoted tile after the header.

### `3-column-portrait`

- preferred opening is `logo + header + first item` when `showCategoryHeaderTiles === true`,
- when `showCategoryHeaderTiles === false` the full-width header (colSpan=3) cannot fit alongside the logo; only the logo stays in the lead row and all other tiles queue after the header.

### `4-column-portrait`

- preferred opening is `logo + header + flagship` when `showCategoryHeaderTiles === true` (compact header, colSpan=1) — all three fit within the four columns,
- when `showCategoryHeaderTiles === false` the full-width header (colSpan=4) cannot fit alongside the logo; the flagship (colSpan=2) technically fits in the remaining columns but **must not** be placed before the header — only the logo stays in the lead row and flagship, header, and items all queue with the header first,
- because the flagship is taller, the opening footprint spans multiple rows,
- open cells inside that footprint are offered to queued regular items before later filler logic.

### `5-column-landscape`

- preferred opening is `logo + header + flagship + first item`.

### `6-column-portrait-a3`

- preferred opening is `logo + header + flagship + first two items`.

These width rules are explicit and tested. Future changes should continue to make width-specific behaviour obvious rather than implicit.

### Header-first invariant (critical)

The section header must always precede every item-type tile — including the flagship — in the grid, regardless of the combination of colSpans involved.

The planner enforces this in `selectLeadRowTiles`: if the header was a candidate but was not chosen for the lead row (because the full-width header did not fit alongside the logo), the function strips `chosenTiles` back to logo-only. Any tile that had already been added to `chosenTiles` in the main `preferredLeadRowKinds` loop — including a flagship that fit in the remaining columns — is moved back into `queuedTiles` after the header. This guarantees the order `[logo] → [header, flagship?, items…]` in the candidate stream passed to the paginator.

Without this eviction step, a flagship with colSpan < cols can slip into the lead row ahead of the full-width header, producing section items before their heading in the rendered output.

## How pagination now works

The main paginator is `streamingPaginate()` in `src/lib/templates/v2/streaming-paginator.ts`.

The rough sequence is:

1. Initialise a `StreamingContext`.
2. Place static tiles for the first page.
3. Build section plans.
4. For each section:
   - advance to a new row if needed,
   - place a divider first if the section requires one,
   - place the section plan through `placeSectionPlan()`,
   - optionally apply per-section last-row centering.
5. Finalise the last page.
6. Assign final page types.

### Static tiles

Static placement still handles:

- header logo when body logo mode is not active,
- title region when banner is not taking that identity role,
- banner / banner strip,
- footer info.

So the body-logo feature did not remove static placement; it suppresses the header logo when the body-grid logo mode is active and, when no banner is present, leaves only a small print-safe header buffer above the body/title stack.

When a banner or continuation strip is present on grid templates, the paginator also leaves a small buffer below it before the first body row so opening content does not sit flush against the banner edge. The `1-column-tall` template remains exempt from that rule.

### `searchRowFloor` — preventing item backfill above the header

`placeCandidateTilesOnPage()` in `streaming-paginator.ts` maintains a `searchRowFloor` cursor alongside the placement grid. After a full-width section header is placed, `searchRowFloor` advances to the row immediately below the header. All subsequent `findNextGridPosition` calls start from that floor, so no tile can backfill into the empty grid cells that sit above the header (e.g. the empty columns in the logo row).

Without this mechanism, the grid search would find those empty cells first and place items above the section heading, even if the planner had correctly queued them after it.

## Keep-with-next is now lead-row aware

The first implementation inherited a simpler "header row plus N followers" mental model.

The current implementation instead simulates occupancy for:

- chosen lead-row tiles,
- queued flagship/item followers,
- mixed row spans,
- partially occupied opening rows.

`canPlaceLeadRowWithFollowers()` builds a temporary occupancy grid and checks whether the opening footprint plus the required number of follower items fit on the current page.

That is a core reason the engine can now handle mixed opening rows without reintroducing widowed headers as a default behaviour.

## Continuation behaviour

Continuation behaviour is intentionally constrained:

- only the section header repeats on continuation pages,
- the logo does not repeat,
- the flagship does not repeat,
- if a completely new section starts on a later page, it still gets its normal section-start plan,
- but only the globally first non-empty section is ever eligible for the embedded logo.

`buildContinuationLeadRowPlan()` models continuation as a header-only opening.

## Divider behaviour

Dividers are still section separators, but they now sit cleanly in front of section plans.

Current behaviour:

- dividers are full-width body tiles,
- a divider belongs to the following section,
- it is placed before the next section's lead row,
- if it does not fit, the paginator starts a new page before continuing.

This is simpler and more robust than trying to treat dividers as part of the previous section's row logic.

## Fillers and spacers

After pagination, `generateLayoutV2()` calls `insertInterspersedFillers()`.

Important current facts:

- fillers are section-scoped,
- fillers are added per page after content placement,
- fillers use occupancy scanning, not a second content-order pass,
- section IDs are discovered from body tiles on the page,
- section rows are inferred from tiles carrying `sectionId`,
- empty cells are only filled within that section's rows and safe zones.

This is why section ownership on mixed body tiles matters so much. Without `sectionId` on tiles like the embedded logo, the filler manager cannot correctly reason about which empty cells belong to which section.

### Text-only and per-section text-only filler sizing

Fillers also account for:

- global text-only mode,
- sections that have `hasImages === false` even when the rest of the menu is image-based.

That means filler `rowSpan` can be reduced for text-only sections so filler height still matches the effective item footprint for that section.

## Tile creation responsibilities

`tile-placer.ts` is responsible for creating tile instances and resolving placement-related footprint choices.

Key responsibilities include:

- `resolveLogoTilePlacement()`
- `resolveSectionHeaderPlacement()`
- `resolveFlagshipTilePlacement()`
- `createLogoTile()`
- `createSectionHeaderTile()`
- `createItemTile()`
- `createFlagshipTile()`

This module is where:

- body-vs-header logo region is decided,
- section header `colSpan` changes when header tiles are enabled,
- flagship width degrades for one-column templates,
- section ownership is attached to body logo content.

## Rendering responsibilities

The renderers do not decide ordering or pagination. They consume the document produced by the layout engine.

The main rendering modules are:

- `src/lib/templates/v2/renderer-v2.ts` for PDF generation
- `src/lib/templates/v2/renderer-web-v2.tsx` for web preview

The current uncommitted changes include explicit renderer support for:

- `FLAGSHIP_CARD`
- body logo tiles
- shared-row header/logo/flagship contexts
- associated styling and image-mode handling

Future requirements should keep that separation clear: the paginator decides where a tile goes; the renderer decides how that tile looks.

## Where configuration enters the engine

The practical flow from UI to engine is:

1. `src/app/menus/[menuId]/template/template-client.tsx`
2. `src/app/api/menus/[menuId]/layout/route.ts`
3. `generateLayoutWithVersion(..., 'v2')`
4. `generateLayoutV2()`

The same config surface is also mirrored through:

- `src/app/dev/layout-lab/layout-lab-client.tsx`
- `src/app/dev/layout-lab/layout-lab-controls.tsx`
- `src/app/api/dev/layout-lab/generate/route.ts`
- `src/app/api/dev/layout-lab/export-pdf/route.ts`
- `src/app/admin/users/[userId]/menus/[slug]/AdminMenuPreviewClient.tsx`

So future requirements must usually touch both engine behaviour and the UI/API plumbing that exposes `SelectionConfigV2`.

## Current tests that define behaviour

The most important behaviour-setting tests now include:

- `src/lib/templates/v2/__tests__/lead-row-planner.test.ts`
- `src/lib/templates/v2/__tests__/body-tile-mode.test.ts`
- `src/lib/templates/v2/__tests__/streaming-pagination.test.ts`
- `src/lib/templates/v2/__tests__/tile-placer.test.ts`
- `src/lib/templates/v2/__tests__/layout-engine-v2.test.ts`
- filler-focused suites such as `interspersed-fillers.test.ts`

If a future requirement changes opening-row behaviour, continuation logic, or section ownership, these are the suites that should usually change first.

## Practical rules to preserve in future work

When extending V2, preserve these assumptions unless there is an explicit product decision to replace them:

### 1. Keep planning section-aware

Do not revert to "global special tile prefix" logic. Logo, header, flagship, items, dividers, and fillers now depend on section context.

### 2. Keep section ownership on body tiles

Any tile that participates in section-scoped occupancy or fillers should carry `sectionId` in its content.

### 3. Keep continuation simple

Continuation pages should stay header-only for repeated section context unless product requirements explicitly change that rule.

### 4. Preserve explicit width rules

The engine currently uses concrete width profiles rather than one generic heuristic. That makes behaviour predictable and easier to discuss with product/design.

### 5. Preserve footprint-driven placement

Do not let renderer concerns or `contentBudget` values leak into placement math.

### 6. Keep fillers post-placement

Fillers should remain an occupancy-based completion step, not a driver of content ordering.

### 7. Preserve featured vs flagship separation

Featured styling and flagship footprint are not the same feature.

### 8. Never let a flagship appear before its section header

When `showCategoryHeaderTiles === false`, the flagship's narrower colSpan means it can technically fit in the lead row alongside the logo even though the full-width header cannot. The planner must always evict such a flagship back into the queue (behind the header) rather than allow it to sit before the heading in the rendered output. See the "Header-first invariant" section above.

## Good questions to ask before adding new requirements

When new V2 requirements arrive, it helps to answer these first:

- Is this a section-start rule, a continuation rule, or a general body-stream rule?
- Does it change candidate selection, chosen composition, or only rendering?
- Does it need section ownership for fillers and invariants?
- Is the rule global, per-section, or per-template-width?
- Does it affect keep-with-next simulation?
- Does it affect continuation repetition?
- Does it affect divider-before-section behaviour?
- Does it affect text-only or per-section no-image handling?

If those questions are answered early, implementation tends to stay local and predictable.

## Recommended reading order for contributors

If you need to understand the engine before making a change, read in this order:

1. `src/lib/templates/v2/layout-engine-v2.ts`
2. `src/lib/templates/v2/lead-row-planner.ts`
3. `src/lib/templates/v2/streaming-paginator.ts`
4. `src/lib/templates/v2/tile-placer.ts`
5. `src/lib/templates/v2/filler-manager-v2.ts`
6. `src/lib/templates/v2/renderer-v2.ts`
7. `src/lib/templates/v2/renderer-web-v2.tsx`
8. the behaviour tests listed above

## Status of older docs

Treat this document as the current reference for engine behaviour.

`src/lib/templates/v2/README.md` is still the best high-level architectural starting point.

`src/lib/templates/v2/TEMPLATE_AUTHORING_GUIDE.md` is still the best template-authoring reference.

`src/docs/v2-layout-engine-features-guide.md` remains useful for capability overview, but parts of its feature-tile narrative still reflect the pre-replan behaviour and should be reconciled against this document before being treated as canonical.
