# GridMenu V2 Layout Engine — Features Guide

This guide covers all features introduced in the V2 Layout Engine Enhancements. Everything described here is live in the codebase and can be tested via the Layout Lab at `/dev/layout-lab`.

---

## Table of Contents

1. [Color Palettes](#1-color-palettes)
2. [Background Textures](#2-background-textures)
3. [Page Sizes](#3-page-sizes)
4. [Template Families](#4-template-families)
5. [Featured Items, Flagship Tiles & Body Tile Mode](#5-featured-items-flagship-tiles--body-tile-mode)
6. [Section Dividers](#6-section-dividers)
7. [Themed Menus](#7-themed-menus)
8. [Configuration Reference](#8-configuration-reference)

---

## 1. Color Palettes

Eight palettes are available in `PALETTES_V2` (defined in `renderer-v2.ts`). Select one via `SelectionConfigV2.colourPaletteId` or the Layout Lab's "Color Palette" panel.

| Palette ID | Name | Background | Accent | Best For |
|---|---|---|---|---|
| `clean-modern` | Clean Modern | `#FFFFFF` | `#111827` | Minimal, contemporary |
| `elegant-cream` | Elegant Cream | `#FDFCF0` | `#8B6B23` | Upscale, warm, classic |
| `midnight-gold` | Midnight Gold | `#1A1A1A` | `#D4AF37` | Dark mode, luxury, fine dining |
| `warm-earth` | Warm Earth | `#F5F0E8` | `#8B6914` | Earthy, rustic, café |
| `ocean-breeze` | Ocean Breeze | `#F0F5F8` | `#2E6B8A` | Cool, coastal, seafood |
| `forest-green` | Forest Green | `#F2F5F0` | `#2D5A27` | Natural, organic, farm-to-table |
| `valentines-rose` | Blush Rose | `#FFF0F3` | `#C2185B` | Romantic / love theme |
| `lunar-red-gold` | Lunar Red & Gold | `#2B0A0A` | `#D4A017` | Lunar New Year theme |

Every palette defines all required `ColorPaletteV2` fields: `background`, `menuTitle`, `sectionHeader`, `itemTitle`, `itemPrice`, `itemDescription`, `itemIndicators.background`, `border.light`, `border.medium`, and `textMuted`.

If an unknown palette ID is provided, the engine falls back to `midnight-gold`.

### Programmatic usage

```typescript
import { PALETTES_V2 } from '@/lib/templates/v2/renderer-v2'

// Find a palette by ID
const palette = PALETTES_V2.find(p => p.id === 'ocean-breeze')

// Pass via selection config
const selection: SelectionConfigV2 = {
  colourPaletteId: 'midnight-gold'
}
```

---

## 2. Background Textures

Textures add a paper-like or premium feel to the page background. They're controlled by two conditions:

1. `SelectionConfigV2.texturesEnabled` must be `true`
2. The selected palette must have an entry in `TEXTURE_REGISTRY`

### Palettes with texture support

| Palette ID | Texture File | Description |
|---|---|---|
| `midnight-gold` | `dark-paper-2.png` | Dark paper with subtle gold gradient overlay |
| `elegant-dark` | `dark-paper.png` | Dark paper texture |
| `lunar-red-gold` | `dark-paper-2.png` | Dark paper with gold gradient overlay |
| `elegant-cream` | Inline SVG data URI | Light cream paper texture |
| `warm-earth` | Inline SVG data URI | Light earthy paper texture |
| `ocean-breeze` | Inline SVG data URI | Light coastal paper texture |
| `forest-green` | Inline SVG data URI | Light natural paper texture |
| `valentines-rose` | Inline SVG data URI | Light romantic paper texture |
| `clean-modern` | Inline SVG data URI | Light modern paper texture |

Light palette textures use inline SVG data URIs for efficient rendering without external image files.

### How it works

- In the Layout Lab, toggle the "Textured backgrounds" checkbox.
- Palettes without a texture entry simply render their plain background color — no error.
- When `texturesEnabled` is `false`, only the palette background color is used regardless of texture availability.
- Web preview uses CSS gradients + background images. PDF export uses base64-embedded images.

### Programmatic usage

```typescript
const selection: SelectionConfigV2 = {
  colourPaletteId: 'midnight-gold',
  texturesEnabled: true
}
```

---

## 3. Page Sizes

Five page sizes are available in `PAGE_DIMENSIONS` (defined in `engine-types-v2.ts`):

| Page Size ID | Width (pt) | Height (pt) | Dimensions | Use Case |
|---|---|---|---|---|
| `A4_PORTRAIT` | 595.28 | 841.89 | 210mm × 297mm | Standard menu (default) |
| `A4_LANDSCAPE` | 841.89 | 595.28 | 297mm × 210mm | Bi-fold, placemat-style |
| `A3_PORTRAIT` | 841.89 | 1190.55 | 297mm × 420mm | Large display boards |
| `A3_LANDSCAPE` | 1190.55 | 841.89 | 420mm × 297mm | Wide display boards |
| `HALF_A4_TALL` | 297.64 | 841.89 | ~105mm × 297mm | Table tent cards, slim holders |

Page size is set per template in the YAML `page.size` field. The template loader's region height validation is page-size-aware, so A3 templates can use taller regions than A4.

### Programmatic usage

```typescript
import { PAGE_DIMENSIONS, buildPageSpec } from '@/lib/templates/v2/engine-types-v2'

const spec = buildPageSpec('A3_PORTRAIT', {
  top: 22.68, right: 25.51, bottom: 22.68, left: 25.51
})
// → { id: 'A3_PORTRAIT', width: 841.89, height: 1190.55, margins: {...} }
```

---

## 4. Template Families

Six production templates are available, named by column layout and orientation to match the template page dropdown:

### 4 column (portrait) (`4-column-portrait`)
- Page: A4 Portrait, 4 columns
- The default template. Photo-forward grid with image cards.
- Supports body tile mode (`LOGO_BODY`, compact `SECTION_HEADER`, and `FLAGSHIP_CARD`) plus `DECORATIVE_DIVIDER`.

### 5 column (landscape) (`5-column-landscape`)
- Page: A4 Landscape, 4 columns
- Wide-format version. Good for bi-fold or placemat menus.
- `rowHeight: 65`, `gapX: 10`, `gapY: 8`
- Supports body tile mode (`LOGO_BODY`, compact `SECTION_HEADER`, and `FLAGSHIP_CARD`).

### 3 column (portrait) (`3-column-portrait`)
- Page: A4 Portrait, 3 columns
- Balanced layout fitting more items per page than 2-column.
- `rowHeight: 70`, `gapX: 10`, `gapY: 8`
- Section headers span full width (`colSpan: 3`).
- Supports body tile mode (`LOGO_BODY`, compact `SECTION_HEADER`, and `FLAGSHIP_CARD`).

### 2 column (portrait) (`2-column-portrait`)
- Page: A4 Portrait, 2 columns
- Text-focused layout. Auto-enables stretch image mode in the Layout Lab.
- Section headers span full width (`colSpan: 2`).
- Supports body tile mode (`LOGO_BODY`, compact `SECTION_HEADER`, and `FLAGSHIP_CARD`).

### 1 column (tall) (`1-column-tall`)
- Page: HALF_A4_TALL, 1 column
- Narrow single-column format for table tent cards or slim menu holders.
- `rowHeight: 60`, `gapY: 6`
- Favours `ITEM_TEXT_ROW` (text-only) for the narrow format.
- Supports body tile mode, with `FLAGSHIP_CARD` degrading to `colSpan: 1`.

### 6 column (portrait A3) (`6-column-portrait-a3`)
- Page: A3 Portrait, 6 columns
- Large-format board layout for higher item density and wider flagship tiles.
- Supports body tile mode (`LOGO_BODY`, compact `SECTION_HEADER`, and `FLAGSHIP_CARD`).

### Choosing a template

In the template page and Layout Lab, templates appear under "Grid Layout". Programmatically, pass the template ID when calling the generate API:

```typescript
const response = await fetch('/api/dev/layout-lab/generate', {
  method: 'POST',
  body: JSON.stringify({
    templateId: '4-column-portrait',
    // ...
  })
})
```

### Writing a custom template

Templates are YAML files in `src/lib/templates/v2/templates/`. The minimum structure:

```yaml
id: my-custom-template
version: "2.0.0"
name: My Custom Template

page:
  size: A4_PORTRAIT          # or A4_LANDSCAPE, A3_PORTRAIT, A3_LANDSCAPE, HALF_A4_TALL
  margins:
    top: 22.68
    right: 25.51
    bottom: 22.68
    left: 25.51

regions:
  header:
    height: 60
  title:
    height: 32
  footer:
    height: 45

body:
  container:
    type: GRID
    cols: 4                   # 1-6 columns
    rowHeight: 70
    gapX: 8
    gapY: 8

tiles:
  LOGO:
    region: header
    contentBudget: { nameLines: 0, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 50, paddingTop: 5, paddingBottom: 5, totalHeight: 60 }

  TITLE:
    region: title
    contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 4, paddingBottom: 4, totalHeight: 32 }

  SECTION_HEADER:
    region: body
    colSpan: 4                # Match your cols count for full-width headers
    contentBudget: { nameLines: 1, descLines: 0, indicatorAreaHeight: 0, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 4, totalHeight: 24 }

  ITEM_CARD:
    region: body
    rowSpan: 2
    contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 70, paddingTop: 8, paddingBottom: 8, totalHeight: 148 }

  ITEM_TEXT_ROW:
    region: body
    rowSpan: 1
    contentBudget: { nameLines: 2, descLines: 2, indicatorAreaHeight: 16, imageBoxHeight: 0, paddingTop: 8, paddingBottom: 8, totalHeight: 70 }

  # Optional — add these only if you want body tile mode:
  # LOGO_BODY:
  #   region: body
  #   colSpan: 1
  #   rowSpan: 1
  #   contentBudget: { ... }
  #
  # FLAGSHIP_CARD:
  #   region: body
  #   colSpan: 2              # Use 1 for single-column templates
  #   rowSpan: 2
  #   contentBudget: { ... }

  # DECORATIVE_DIVIDER:
  #   region: body
  #   colSpan: 4
  #   rowSpan: 1
  #   contentBudget: { ... }

# Optional — only needed if DECORATIVE_DIVIDER is defined:
# dividers:
#   enabled: true
#   style: ornament            # line | pattern | icon | ornament
#   height: 24

policies:
  lastRowBalancing: CENTER
  showLogoOnPages: [FIRST, CONTINUATION, FINAL, SINGLE]
  repeatSectionHeaderOnContinuation: true
  sectionHeaderKeepWithNextItems: 1

filler:
  enabled: false
  safeZones: []
  tiles: []
  policy: SEQUENTIAL

# Optional:
# capabilities:
#   supportsBodyTileMode: true

itemIndicators:
  mode: INLINE
  maxCount: 3
  style: { badgeSize: 14, iconSet: emoji }
  spiceScale: { 1: "🌶", 2: "🌶🌶", 3: "🌶🌶🌶" }
  letterFallback: { vegetarian: "V", vegan: "VG", halal: "H", kosher: "K", gluten-free: "GF" }
```

---

## 5. Featured Items, Flagship Tiles & Body Tile Mode

V2 now treats "featured" and "flagship" as separate concepts:

- `isFeatured` keeps the normal item footprint and adds stronger chrome to a standard `ITEM_CARD` or `ITEM_TEXT_ROW`.
- `isFlagship` can optionally promote one item per menu into a dedicated `FLAGSHIP_CARD` body tile when `SelectionConfigV2.showFlagshipTile` is enabled.
- The body tile mode also enables a compact single-column body-logo tile (`showLogoTile`) and compact single-column category-header tiles (`showCategoryHeaderTiles`), with their height matching the effective item footprint for the section they open.

### Data model

Menu items can carry both optional flags:

```typescript
interface EngineItemV2 {
  id: string
  name: string
  // ...
  isFeatured?: boolean  // Highlight with featured chrome on a standard tile
  isFlagship?: boolean  // Eligible for the single flagship tile when enabled in selection config
}
```

In the database, these map to `menu_items.is_featured` and `menu_items.is_flagship`. The extracted-page workflow is the source of truth for choosing the single flagship item.

### Featured items

1. Featured items still render as standard body items.
2. In image layouts they use `ITEM_CARD` with `isFeatured: true`; in text-only layouts they use `ITEM_TEXT_ROW` with the same flag.
3. The renderer gives featured items stronger chrome, but the footprint does not change.
4. Existing `FEATURE_CARD` renderer support remains in the type system for compatibility, but the placement engine does not emit `FEATURE_CARD` in the current flow.

### Flagship tiles

1. When `showFlagshipTile` is `true` and the template supports body tile mode, the single item marked `isFlagship` renders as `FLAGSHIP_CARD`.
2. `FLAGSHIP_CARD` uses a wider footprint (`colSpan: 2` in multi-column templates, `colSpan: 1` in `1-column-tall`).
3. The flagship tile is emitted once, at the start of its section, and the regular item tile for that same item is suppressed.
4. If an item is both featured and flagship, flagship wins. The engine emits `FLAGSHIP_CARD`, not a featured standard card.
5. If `showFlagshipTile` is off, or the template does not support body tile mode, the item falls back to the normal item flow.

### Body tile mode toggles

- `showLogoTile`: moves the venue logo into the body grid as a compact single-column `LOGO_BODY` tile on page 1 only, suppresses the header-region logo, and when no banner is present collapses the header area to a small print-safe buffer instead of keeping the full header band. Its height matches the section's effective item mode, so image sections use image-card height while no-image/text-only sections use text-row height.
- `showCategoryHeaderTiles`: switches section headers from full-width rows to compact single-column body tiles while still forcing a new row before items. Like the body logo tile, their height matches the section's effective item mode.
- `showFlagshipTile`: emits `FLAGSHIP_CARD` for the single flagship item and suppresses its regular body tile.

When `showBanner` is enabled on the grid templates, the engine also leaves a small buffer between the banner/strip and the first body row so content does not sit flush against the banner edge. The narrow `1-column-tall` template remains the exception.

### Template requirements

- Templates opt into these capabilities with `capabilities.supportsBodyTileMode: true`.
- Body tile mode templates must define `LOGO_BODY` and `FLAGSHIP_CARD`.
- Production templates `1-column-tall`, `2-column-portrait`, `3-column-portrait`, `4-column-portrait`, `5-column-landscape`, and `6-column-portrait-a3` all ship with body tile mode support.

---

## 6. Section Dividers

Decorative dividers are inserted between menu sections for visual separation.

### How it works

1. The template must define both a `dividers` config section and a `DECORATIVE_DIVIDER` tile variant.
2. When `dividers.enabled` is `true`, the streaming paginator inserts a divider tile between each pair of sections (not before the first section).
3. If a divider would cause a page overflow, the divider and the next section move together to a new page.
4. Dividers span the full grid width (`colSpan` defaults to the template's column count).

### Divider styles

Four visual styles are available, set via `dividers.style`:

| Style | Visual |
|---|---|
| `line` | Simple horizontal line (80% width, centered) |
| `pattern` | Dashed/faded pattern line (90% width) |
| `icon` | Center diamond (◆) with lines on each side |
| `ornament` | Decorative triple-star (✦ ✦ ✦) with lines on each side |

### Templates with dividers enabled

Production templates ship with dividers disabled. For testing or custom templates, enable `dividers.enabled` and add a `DECORATIVE_DIVIDER` tile (e.g. ornament style).

### Adding dividers to a custom template

```yaml
dividers:
  enabled: true
  style: ornament       # line | pattern | icon | ornament
  height: 24

tiles:
  DECORATIVE_DIVIDER:
    region: body
    colSpan: 4           # Match your cols count for full-width
    rowSpan: 1
    contentBudget:
      nameLines: 0
      descLines: 0
      indicatorAreaHeight: 0
      imageBoxHeight: 0
      paddingTop: 4
      paddingBottom: 4
      totalHeight: 70    # rowSpan * rowHeight + (rowSpan - 1) * gapY
```

---

## 7. Palettes and textures

You can achieve a themed look by combining any of the five templates with a palette and optional texture from the Layout Lab. Palettes such as `valentines-rose` and `lunar-red-gold` remain available in the Color Palette dropdown; textures (e.g. romantic paper, gold overlay) can be enabled and selected independently.

### Palette nudging

Any template can use any palette. The template's layout and typography are preserved while colors come from the selected palette.

```typescript
const selection: SelectionConfigV2 = {
  colourPaletteId: 'midnight-gold'
}
```

In the Layout Lab, select a template under "Grid Layout", then choose a palette from "Color Palette" and optionally a "Background texture".

### Creating a custom template

Templates are YAML files in `src/lib/templates/v2/templates/`. Add a palette to `PALETTES_V2` in `renderer-v2.ts` and optionally an entry in `TEXTURE_REGISTRY` to support a custom look. There is no separate "theme" schema — it's standard template + palette configuration.

---

## 8. Configuration Reference

### SelectionConfigV2

The main configuration object passed to the layout engine:

```typescript
interface SelectionConfigV2 {
  textOnly?: boolean           // Force ITEM_TEXT_ROW for all items
  fillersEnabled?: boolean     // Enable filler tiles in empty grid cells
  texturesEnabled?: boolean    // Enable background textures (if palette supports it)
  showMenuTitle?: boolean      // Show/hide the title region
  showLogoTile?: boolean       // Move logo into the body grid on first page only
  showCategoryHeaderTiles?: boolean // Use compact single-column section headers in the body grid
  showFlagshipTile?: boolean   // Promote the single flagship item to FLAGSHIP_CARD
  showVignette?: boolean       // Adds a subtle darkened edge effect to page borders
  colourPaletteId?: string     // Palette ID (falls back to midnight-gold)
}
```

**New Feature: Per-Sub-Element Typography** — Typography blocks now support per-sub-element font control (name, description, price, label, contact). Each sub-element can specify `fontSet`, `fontSize`, `fontWeight`, and `lineHeight` independently. Templates without sub-element typography continue to work — the renderer falls back to sensible defaults for all sub-elements.

### Layout Lab controls → SelectionConfigV2 mapping

| Layout Lab Control | Config Field |
|---|---|
| Color Palette radio buttons | `colourPaletteId` |
| "Textured backgrounds" checkbox | `texturesEnabled` |
| "Text only (no images)" checkbox | `textOnly` |
| "Fillers on/off" checkbox | `fillersEnabled` |
| "Show menu title" checkbox | `showMenuTitle` |
| "Show logo tile" checkbox | `showLogoTile` |
| "Show category header tiles" checkbox | `showCategoryHeaderTiles` |
| "Show flagship tile" checkbox | `showFlagshipTile` |
| "Show vignette" checkbox | `showVignette` |

### Template ID → YAML file mapping

| Template ID | YAML File |
|---|---|
| `4-column-portrait` | `templates/4-column-portrait.yaml` |
| `5-column-landscape` | `templates/5-column-landscape.yaml` |
| `3-column-portrait` | `templates/3-column-portrait.yaml` |
| `2-column-portrait` | `templates/2-column-portrait.yaml` |
| `1-column-tall` | `templates/1-column-tall.yaml` |
| `6-column-portrait-a3` | `templates/6-column-portrait-a3.yaml` |

### Key source files

| File | What it contains |
|---|---|
| `engine-types-v2.ts` | PAGE_DIMENSIONS, TileTypeV2, EngineItemV2, SelectionConfigV2, TemplateV2 |
| `renderer-v2.ts` | PALETTES_V2, TEXTURE_REGISTRY, and PDF rendering for standard, featured, flagship, logo, and filler tiles |
| `template-schema-v2.ts` | Zod validation schema for template YAML files |
| `tile-placer.ts` | Tile factories and placement helpers for body tile mode, flagship tiles, dividers, and standard items |
| `streaming-paginator.ts` | Pagination algorithm, body tile stream construction, flagship suppression, and continuation handling |
| `template-loader-v2.ts` | YAML loading and page-size-aware validation |
| `invariant-validator.ts` | Layout correctness checks (INV-1 through INV-4) |
