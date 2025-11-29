# Template Styling Fixes - Build Plan

## Context

Following the initial Template Styling MVP implementation, testing revealed several gaps that need addressing to achieve the professional menu designs shown in the design inspiration images.

## Reference Materials

- **Design Inspiration**: `.kiro/specs/grid-menu-templates-part-2/design-inspiration-7.png` (Ravada - Elegant Dark)
- **Design Inspiration**: `.kiro/specs/grid-menu-templates-part-2/italian.png` (Porta-Porta - Classic Italian)
- **Previous Plan**: `template-styling-mvp.plan.md`

## Issues Identified

1. **Classic Italian and Simple Rows templates not available** for selection despite being defined
2. **Menu item images not rendering** in templates or exports
3. **Demo flow not receiving styled output** (templates/exports)
4. **Export format inconsistencies**: PDF has white background, PNG unstyled, HTML has overspill issues
5. **No fallback for items without images** causing visual inconsistency

---

## Phase 1: Fix Core Rendering Issues (Critical)

### 1.1 Fix Image Data Flow in Layout Engine

**Problem**: `imageUrl` from menu items may not be flowing through to `MenuItemTileInstance`

**Files to modify**:
- `src/lib/templates/layout-engine.ts`
- `src/lib/templates/menu-transformer.ts`

**Tasks**:
- [ ] Verify `toEngineMenu()` preserves `imageUrl` on `EngineItem`
- [ ] Verify `generateLayout()` copies `imageUrl` to `MenuItemTileInstance`
- [ ] Verify `showImage` flag is set based on tile options and image availability
- [ ] Debug: Add console.log to trace image data through pipeline
- [ ] Verify AI image URLs are resolving correctly (should be `/api/images/{id}`)

**Test**: Log `layoutInstance` in template-client.tsx to verify `imageUrl` is present on item tiles

### 1.2 Fix PNG/Image Export Endpoint

**Problem**: Image export endpoint may not be applying template styles correctly

**File to modify**:
- `src/app/api/templates/export/image/route.ts`

**Tasks**:
- [ ] Verify `handleNewTemplateEngine` is being called (not legacy path)
- [ ] Verify `template` is passed to `ServerLayoutRenderer`
- [ ] Verify HTML/CSS is correct before puppeteer screenshot
- [ ] Test with hardcoded menu data to isolate issue

### 1.3 Fix PDF/HTML Background & Font Loading

**Problem**: CSS not applying correctly - white backgrounds, fonts not loading

**File to modify**:
- `src/lib/templates/export/layout-renderer.tsx`

**Tasks**:
- [ ] Verify Google Fonts `@import` is at very top of CSS string
- [ ] Verify `html, body` CSS rules set background color
- [ ] Verify `-webkit-print-color-adjust: exact` is present
- [ ] Test: Output raw HTML to file and open in browser to verify CSS
- [ ] Debug: Check if puppeteer is waiting for fonts to load

---

## Phase 2: Fix Template Availability

### 2.1 Review Compatibility Constraints

**Problem**: Classic Italian and Simple Rows templates showing as unavailable

**Files to investigate**:
- `src/lib/templates/template-definitions.ts`
- `src/lib/templates/compatibility-checker.ts`

**Tasks**:
- [ ] Check `TWO_COLUMN_TEXT.constraints` - ensure `requiresImages` is NOT true
- [ ] Check `SIMPLE_ROWS.constraints` - ensure `requiresImages` is NOT true
- [ ] Add console.log to `checkCompatibility()` to see exact rejection reason
- [ ] Test API endpoint `/api/templates/available?menuId=...` directly in browser
- [ ] Verify demo menu has at least 1 section and 1 item (minimum constraints)

### 2.2 Debug Compatibility Response

**Tasks**:
- [ ] Add logging to see full compatibility result for each template
- [ ] Fix any constraint values that are too restrictive
- [ ] Ensure all three templates return `status: OK` or `status: WARNING` (not `INCOMPATIBLE`)

---

## Phase 3: Demo Flow Verification

### 3.1 Trace Demo Template Selection Flow

**Files to investigate**:
- `src/app/ux/menus/[menuId]/template/template-client.tsx`
- `src/app/ux/menus/[menuId]/export/export-client.tsx`

**Tasks**:
- [ ] Add console.log when template is saved to sessionStorage
- [ ] Add console.log when template selection is loaded in export page
- [ ] Verify `TEMPLATE_REGISTRY[templateId]` returns valid template (not undefined)
- [ ] Verify sessionStorage key names match between save and load

### 3.2 Verify Demo Menu Data Structure

**Tasks**:
- [ ] Inspect sessionStorage `demoMenu` in browser DevTools
- [ ] Check if menu items have `imageUrl` field populated
- [ ] Check if items have `aiImageId` that needs URL resolution
- [ ] If no images exist, add sample image URLs to demo data for testing

### 3.3 Fix Demo HTML Export Function

**File**: `src/app/ux/menus/[menuId]/export/export-client.tsx`

**Tasks**:
- [ ] Add console.log at start of `handleDemoHtmlExport`
- [ ] Verify it's being called (not the old placeholder path)
- [ ] Verify `generateStyledHtml` receives template with style
- [ ] Open downloaded HTML file and inspect contents

---

## Phase 4: Item Fallback System

### 4.1 Verify Fallback Component Works

**Files**:
- `src/components/templates/ItemImageFallback.tsx` (exists)
- `src/components/templates/TemplateLayoutRenderer.tsx`

**Tasks**:
- [ ] Verify `ItemImageFallback` is imported and used when `!tile.imageUrl`
- [ ] Test by temporarily removing imageUrl from a tile and verify fallback renders
- [ ] Verify fallback respects shape (circle for Elegant Dark, square for others)
- [ ] Verify accent color is passed correctly from palette

### 4.2 Verify Server Fallback Works

**File**: `src/lib/templates/export/layout-renderer.tsx`

**Tasks**:
- [ ] Verify `ItemImagePlaceholder` renders when `templateSupportsImage && !hasImage`
- [ ] Verify fallback uses template accent color (currently hardcoded to `#c9a227`)
- [ ] Test by generating export with item missing imageUrl

### 4.3 Handle Missing Descriptions

**Tasks**:
- [ ] Verify cards don't collapse when description is missing
- [ ] Set minimum card height in CSS
- [ ] Test with items that have no description

---

## Phase 5: Visual Polish (Match Design Inspiration)

### 5.1 Elegant Dark Template Enhancements

**Reference**: design-inspiration-7.png (Ravada)

**Tasks**:
- [ ] Verify circular image border is rendering (3px solid gold)
- [ ] Verify gradient background (not flat color)
- [ ] Price should be gold color (#c9a227)
- [ ] Section headers should have decorative styling

### 5.2 Classic Italian Template Enhancements

**Reference**: italian.png (Porta-Porta)

**Tasks**:
- [ ] Verify cream background renders
- [ ] Verify leader dots appear between name and price
- [ ] Verify serif fonts load (Cormorant Garamond)
- [ ] Two-column layout should be visible

### 5.3 Simple Rows Template Polish

**Tasks**:
- [ ] Verify left-aligned thumbnail renders
- [ ] Verify card shadows appear
- [ ] Test responsive behavior

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/lib/templates/layout-engine.ts` | Generates `LayoutInstance` from menu + template |
| `src/lib/templates/menu-transformer.ts` | Converts database `Menu` to `EngineMenu` |
| `src/lib/templates/compatibility-checker.ts` | Determines which templates work with a menu |
| `src/lib/templates/template-definitions.ts` | Template definitions with styles |
| `src/components/templates/TemplateLayoutRenderer.tsx` | Client-side styled renderer |
| `src/lib/templates/export/layout-renderer.tsx` | Server-side renderer for exports |
| `src/app/api/templates/export/pdf/route.ts` | PDF export endpoint |
| `src/app/api/templates/export/html/route.ts` | HTML export endpoint |
| `src/app/api/templates/export/image/route.ts` | PNG image export endpoint |
| `src/app/ux/menus/[menuId]/template/template-client.tsx` | Template selection UI |
| `src/app/ux/menus/[menuId]/export/export-client.tsx` | Export UI + demo export logic |

---

## Success Criteria

1. [ ] All three templates (Elegant Dark, Classic Italian, Simple Rows) available for selection
2. [ ] Menu item images render in preview and all export formats
3. [ ] Demo flow produces styled HTML exports (not placeholder)
4. [ ] PDF, PNG, and HTML exports all have consistent styling matching preview
5. [ ] Items without images show tasteful fallback
6. [ ] Elegant Dark template visually resembles Ravada design inspiration
7. [ ] Classic Italian template visually resembles Porta-Porta design inspiration
8. [ ] Export backgrounds render correctly (not white)
9. [ ] Fonts load correctly in all export formats

---

## Recommended Execution Order

1. **Phase 2 first** — Unblock template selection (quick win)
2. **Phase 3** — Fix demo flow so you can test
3. **Phase 1** — Fix image rendering
4. **Phase 4** — Ensure fallbacks work
5. **Phase 5** — Visual polish

Start with Phase 2 because it may be a simple constraint fix that unblocks testing the other templates.
