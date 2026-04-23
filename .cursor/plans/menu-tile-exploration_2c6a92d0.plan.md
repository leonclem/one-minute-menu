---
name: menu-tile-exploration
overview: Explore and scope a V2-only enhancement that adds independent toggles for logo tiles, 1x1 category header tiles, and flagship tiles while preserving the current layout mode. The plan focuses on the existing placement engine, selection/config surface, template schema, and preview/export paths needed to support alternative tile-based body layouts.
todos:
  - id: map-config-surface
    content: Map the V2 selection/config/UI entry points for adding independent toggles for logo tile, category-header tile, and flagship tile, including the flagship selection UI surface.
    status: pending
  - id: design-placement-mode
    content: Define a second V2 body placement mode that can emit mixed body tiles, suppress duplicate standard rendering for flagship items via pre-pass filtering, and preserve the current default layout path.
    status: pending
  - id: template-renderer-support
    content: Scope the template YAML and renderer changes (PDF and web separately) needed to support 1x1 logo/category tiles and 2x1 FLAGSHIP_CARD tiles with palette-relative styling and a side-by-side image/text composition.
    status: pending
  - id: test-risk-review
    content: Identify the pagination, filler, continuation-header, and one-column fallback tests that must change or be added.
    status: pending
isProject: false
---

# Menu Tile Layout Exploration

## Current State
- The active V2 engine is region-based: banner/header/title above the body grid, then footer. The body grid placement is driven by [`src/lib/templates/v2/streaming-paginator.ts`](src/lib/templates/v2/streaming-paginator.ts), [`src/lib/templates/v2/tile-placer.ts`](src/lib/templates/v2/tile-placer.ts), and template YAMLs in [`src/lib/templates/v2/templates/`](src/lib/templates/v2/templates/).
- Two of the three concepts already partially exist in V2 type space: `LOGO` and `SECTION_HEADER` are defined in [`src/lib/templates/v2/engine-types-v2.ts`](src/lib/templates/v2/engine-types-v2.ts), but the placer does not currently use them as body-grid tiles. `FEATURE_CARD` also exists but is semantically distinct from the flagship concept (see below).
- Important verified constraints:
  - `selectItemVariant()` currently returns `ITEM_CARD` for all non-text-only items, so featured items never become larger body tiles today. Featured items use `ITEM_CARD` with `isFeatured: true` for chrome-only styling at the same footprint. See [`src/lib/templates/v2/tile-placer.ts`](src/lib/templates/v2/tile-placer.ts).
  - Category headers currently consume full-width row space (`colSpan: cols`) and force a row break before items. See [`src/lib/templates/v2/streaming-paginator.ts`](src/lib/templates/v2/streaming-paginator.ts).
  - When the banner is off, the logo is placed as a full-width header-region tile, not as a body-grid tile. See [`src/lib/templates/v2/streaming-paginator.ts`](src/lib/templates/v2/streaming-paginator.ts).
  - The single-column tall template already exists in [`src/lib/templates/v2/templates/1-column-tall.yaml`](src/lib/templates/v2/templates/1-column-tall.yaml), so `2x1` flagship behavior needs an explicit fallback for `cols === 1`.
  - A flagship body tile cannot coexist with the same item's standard body tile; the placement pass will need to suppress that item's normal tile once the flagship variant is emitted.
  - `getItemSlotPositions()` in [`src/lib/templates/v2/filler-manager-v2.ts`](src/lib/templates/v2/filler-manager-v2.ts) computes `totalCells = totalRows * cols` and distributes fillers assuming uniform 1×1 items. Mixed-width tiles break this assumption.
- Some markdown docs are useful but not fully current. In particular, [`src/docs/v2-layout-engine-features-guide.md`](src/docs/v2-layout-engine-features-guide.md) still describes `FEATURE_CARD` as live placement behavior, which does not match the current placer/tests.

## Key Decisions (Agreed)

### FLAGSHIP_CARD is a new type, not a reuse of FEATURE_CARD
- `FEATURE_CARD` exists in the type union and has a `FeatureCardContentV2` interface, but `selectItemVariant()` never emits it. Featured items use `ITEM_CARD` with `isFeatured: true` for chrome-only styling at the same footprint.
- The flagship concept is fundamentally different: it is a **footprint change** (2×1), not a styling change. Conflating the two would confuse the renderer, break existing tests, and make it impossible to have a featured item that is not a flagship (or vice versa).
- **Decision:** Introduce a dedicated `FLAGSHIP_CARD` type. Add it to `TileTypeV2`, create a `FlagshipCardContentV2` interface, add it to `TileContentV2`, `TemplateTileVariantsV2`, and the YAML template schema. Leave `FEATURE_CARD` untouched.

### Flagship vs Featured: independent but composable
- Flagship and featured are independent concepts. A menu item can be both flagship and featured, but flagship styling takes precedence when both apply.
- Only **one flagship item per menu** is allowed. Only **one featured item per category** is allowed. It is valid to have no flagship and no featured items.
- The user selects flagship/featured status via the `/extracted` page. This selection is already established in the data model.

### Flagship suppression uses a pre-pass, not spacer placeholders
- Before `streamingPaginate()` enters the section loop, scan sections for the flagship-eligible item (the single item marked as flagship on the menu). Build a `Set<itemId>` containing that item.
- During streaming, skip the flagship item in the normal item flow and emit it as a `FLAGSHIP_CARD` tile at the appropriate point (beginning of its section, or beginning of the body grid — to be decided during implementation).
- **The spacer-placeholder fallback is removed from the plan.** It couples flagship behavior to the spacer system and makes layout non-deterministic.

### 1×1 category headers still force a new row
- When 1×1 category header tiles are enabled, they still start a new row (same as full-width headers). This preserves the visual grouping guarantee so headers do not detach from the first item in their category.
- `canPlaceHeaderWithItems()` will be updated to account for the smaller footprint (1 cell instead of full width) but the "force new row" invariant is preserved.

### Logo tile replaces the header-region logo
- When `showLogoTile` is enabled, the header-region logo is **suppressed** and a 1×1 logo tile is emitted as the first body-grid tile on page 1 only. This avoids duplication.
- The template YAML will need a body-grid logo variant definition (separate from the existing header-region `LOGO` variant).

### Filler slot math: fall back to occupancy-based placement
- When flagship tiles (or any mixed-width tiles) are present, skip slot-based filler placement in `getItemSlotPositions()` and fall back to post-placement occupancy scanning (find empty cells after all content is placed). This is already how `insertFillers()` works at the page level.
- This avoids complex slot math that doesn't generalize to variable footprints.

### Migration / defaults
- All new `SelectionConfigV2` fields default to `undefined` / `false`, preserving existing behavior for all saved menus. No data migration is needed.

## Recommended Direction
- Treat this as a new **tile-based body layout mode** inside V2, but expose the three capabilities as **independent toggles** in `SelectionConfigV2` and the template UI.
- Keep the existing behavior as the default path. Add a second placement path that can opt into:
  - a `1x1` body `LOGO` tile when enabled (suppresses header-region logo, first page only),
  - `1x1` category header tiles instead of full-row section headers (still force new row),
  - a `FLAGSHIP_CARD` tile that prefers `2x1` when `cols >= 2`, but degrades to `1x1` for single-column templates.
- Treat the flagship tile as the canonical rendering for that item in the body grid whenever enabled, not as an additional promotional duplicate.
- Reuse the existing palette system in [`src/lib/templates/v2/renderer-v2.ts`](src/lib/templates/v2/renderer-v2.ts) / [`src/lib/templates/v2/renderer-web-v2.tsx`](src/lib/templates/v2/renderer-web-v2.tsx) so each special tile gets a distinct surface treatment without introducing a separate color system.
- For `2x1` flagship tiles, use a different internal composition from the current vertical card stack: image on the left and text content on the right for non-background image modes, with background mode remaining full-bleed behind the content.

## Workstreams

### 1. Define the option surface and flagship selection UI
- Add to `SelectionConfigV2` in [`src/lib/templates/v2/engine-types-v2.ts`](src/lib/templates/v2/engine-types-v2.ts):
  ```typescript
  showLogoTile?: boolean       // 1×1 logo in body grid (suppresses header-region logo)
  showCategoryHeaderTiles?: boolean  // 1×1 headers instead of full-width
  showFlagshipTile?: boolean   // 2×1 flagship instead of standard item
  ```
  All default to `undefined`/`false` — existing behavior is preserved.
- Thread those flags through the existing UI/config flow in [`src/app/menus/[menuId]/template/template-client.tsx`](src/app/menus/[menuId]/template/template-client.tsx), the admin preview client, and Layout Lab.
- Add a **flagship selection UI surface** to the config flow. The user must be able to nominate which single menu item is the flagship. This selection already exists via the `/extracted` page, so the config surface needs to read and display it, and optionally allow toggling the flagship tile on/off independently of the item's flagship status.
- Clarify the interaction: an item can be both flagship and featured. When both apply, flagship styling (larger footprint, side-by-side layout) takes precedence. The `isFeatured` chrome is not rendered on a flagship tile.

### 2. Introduce FLAGSHIP_CARD type and pre-pass suppression
- Add `'FLAGSHIP_CARD'` to `TileTypeV2` in [`src/lib/templates/v2/engine-types-v2.ts`](src/lib/templates/v2/engine-types-v2.ts).
- Create `FlagshipCardContentV2` interface (mirrors `FeatureCardContentV2` but is semantically distinct):
  ```typescript
  interface FlagshipCardContentV2 {
    type: 'FLAGSHIP_CARD'
    itemId: string
    sectionId: string
    name: string
    description?: string
    price: number
    imageUrl?: string
    showImage: boolean
    currency: string
    indicators: ItemIndicatorsV2
    imageTransform?: import('@/types').ImageTransformRecord
  }
  ```
- Add `FlagshipCardContentV2` to the `TileContentV2` union.
- Add `FLAGSHIP_CARD?: TileVariantDefV2` to `TemplateTileVariantsV2`.
- **Pre-pass suppression:** Before `streamingPaginate()` enters the section loop, scan sections for the flagship item. Build a `Set<itemId>` of flagship items (at most one). During streaming, skip that item in the normal item flow and emit it as a `FLAGSHIP_CARD` tile at the beginning of its section (after the section header, before regular items).

### 3. Refactor body placement around tile candidates
- Extract the current section/item streaming logic in [`src/lib/templates/v2/streaming-paginator.ts`](src/lib/templates/v2/streaming-paginator.ts) into a `buildBodyTileStream()` function that yields tiles in order (logo, section headers, flagship, items, dividers) and can skip the flagship item's standard tile.
- Introduce a body-level placement decision layer in [`src/lib/templates/v2/tile-placer.ts`](src/lib/templates/v2/tile-placer.ts) that can choose per entity:
  - `LOGO` as `1x1` body tile (first page only, suppresses header-region logo),
  - section header as `1x1` tile (still forces new row start),
  - `FLAGSHIP_CARD` as `2x1` tile when `cols >= 2`, degrading to `1x1` when `cols === 1`,
  - fallback to existing tile footprints otherwise.
- Update `canPlaceHeaderWithItems()` to account for 1×1 header footprint while preserving the "force new row" invariant.
- When flagship tiles are present, disable slot-based filler placement in `getItemSlotPositions()` and fall back to post-placement occupancy scanning in [`src/lib/templates/v2/filler-manager-v2.ts`](src/lib/templates/v2/filler-manager-v2.ts).

### 4. Template schema support
- Add `FLAGSHIP_CARD` variant definitions to the YAML templates under [`src/lib/templates/v2/templates/`](src/lib/templates/v2/templates/) with explicit `colSpan: 2`, `rowSpan` (TBD, likely 2), spacing, and content budgets.
- Add a body-grid `LOGO` variant (separate from the existing header-region LOGO) with `region: body`, `colSpan: 1`, `rowSpan: 1`.
- Add a 1×1 `SECTION_HEADER` variant (or a flag on the existing variant) for the category-header-tile mode.
- For single-column templates (e.g., `1-column-tall.yaml`), define `FLAGSHIP_CARD` with `colSpan: 1` as the fallback.
- Update schema validation to require `FLAGSHIP_CARD` when the template supports the tile-based mode.

### 5. Rendering support (PDF and web — separate sub-tasks)
- **PDF renderer** ([`src/lib/templates/v2/renderer-v2.ts`](src/lib/templates/v2/renderer-v2.ts)):
  - Create a dedicated `renderFlagshipCardContent()` function (do not reuse `renderFeatureCardContent()`).
  - Implement side-by-side layout for non-background image modes (image left, text right) using absolute positioning.
  - Implement full-bleed background mode with overlaid text.
  - Handle `none` image mode with a graceful text-first fallback.
  - Add palette-relative visual distinction for logo tiles and 1×1 category header tiles.
- **Web renderer** ([`src/lib/templates/v2/renderer-web-v2.tsx`](src/lib/templates/v2/renderer-web-v2.tsx)):
  - Create a dedicated `FlagshipCard` React component.
  - Implement side-by-side layout using flexbox/grid CSS (different composition model from the PDF renderer).
  - Handle all image modes (`background`, `stretch`, `compact-rect`, `compact-circle`, `cutout`, `none`).
  - Ensure correct reading order and accessibility: the side-by-side composition changes tab order and screen reader flow. Use semantic markup and appropriate `aria` attributes.
- Both renderers must handle the flagship tile's `colSpan` and `rowSpan` to compute layout dimensions.

### 6. Guardrails and tests
- Update stale docs after behavior is agreed, especially [`src/docs/v2-layout-engine-features-guide.md`](src/docs/v2-layout-engine-features-guide.md).
- Existing `FEATURE_CARD` tests in [`src/lib/templates/v2/__tests__/feature-card.test.ts`](src/lib/templates/v2/__tests__/feature-card.test.ts) and `featured-variant-selection` tests remain unchanged (featured items still use `ITEM_CARD` with `isFeatured: true`).
- Add new focused tests for:
  - **Flagship placement:** `FLAGSHIP_CARD` emitted once per menu, at the correct position in the body stream.
  - **Flagship suppression:** the flagship item does not appear as a standard `ITEM_CARD` in the body grid.
  - **Flagship + featured interaction:** an item that is both flagship and featured renders as `FLAGSHIP_CARD` (flagship takes precedence).
  - **Flagship span fallback:** `FLAGSHIP_CARD` degrades to `colSpan: 1` on single-column templates.
  - **Flagship content completeness:** image, name, description, price, and indicators render correctly across all image modes.
  - **1×1 category header:** still forces new row, pagination and continuation-header behavior preserved.
  - **Logo tile:** suppresses header-region logo, appears on first page only, 1×1 in body grid.
  - **Banner-off + logo-tile interaction:** no duplication, correct region assignment.
  - **Filler behavior:** occupancy-based fallback when flagship tiles are present; no slot-math errors.
  - **Multi-page flagship:** flagship tile appears on the page where its section starts; does not repeat on continuation pages.

## Suggested Sequence
1. **Option surface + flagship selection UI** — add `SelectionConfigV2` flags, thread through config flow, confirm flagship item selection reads from existing `/extracted` data.
2. **Introduce `FLAGSHIP_CARD` type** — add to type union, content types, template variants. No placement yet.
3. **Template schema** — add `FLAGSHIP_CARD`, body-grid `LOGO`, and 1×1 `SECTION_HEADER` variants to YAML templates.
4. **Prototype flagship `2x1` placement** — implement pre-pass suppression, `buildBodyTileStream()`, and the placement decision layer. This is the biggest constraint on slotting and pagination.
5. **Fold in logo tile and 1×1 category header tile** once mixed-width placement rules are stable.
6. **Reconcile filler logic** — disable slot-based placement when flagship tiles are present, fall back to occupancy-based.
7. **Implement flagship renderer** — PDF and web as separate sub-tasks. Side-by-side layout, all image modes.
8. **Tests and docs** — add new test suites, update stale documentation.

## Design Cautions
- **1×1 category headers still force a new row.** This preserves the visual grouping guarantee. It wastes at most `cols - 1` cells per section, which is acceptable for visual clarity.
- **Flagship tiles and filler interspersion will interact.** The existing filler logic assumes uniform item footprints. When flagship tiles are present, fall back to occupancy-based filler placement.
- **The spacer-placeholder fallback is explicitly rejected.** It couples flagship behavior to the spacer system and makes layout non-deterministic. Flagship suppression is handled entirely by pre-pass filtering.
- **`FEATURE_CARD` remains untouched.** "Featured" means stronger chrome on a normal-sized card. "Flagship" means alternate footprint. These are semantically distinct and must stay that way.
- **The `2x1` flagship tile needs its own layout routine.** The current item renderer is optimized for vertical top-to-bottom cards. A side-by-side composition for the flagship tile requires a dedicated render function in both the PDF and web renderers, not a lightly modified `ITEM_CARD` renderer.
- **Accessibility:** The side-by-side flagship composition changes reading order. Both renderers must ensure correct semantic structure and screen reader flow.
- **Admin preview / Layout Lab:** Confirm whether Layout Lab uses the same renderer pipeline or a simplified one. If it has its own rendering path, the new tile types need to be supported there too.
