# GridMenu V2 Layout Engine — Features Guide

This guide covers all features introduced in the V2 Layout Engine Enhancements. Everything described here is live in the codebase and can be tested via the Layout Lab at `/dev/layout-lab`.

---

## Table of Contents

1. [Color Palettes](#1-color-palettes)
2. [Background Textures](#2-background-textures)
3. [Page Sizes](#3-page-sizes)
4. [Template Families](#4-template-families)
5. [Featured Items & Feature Cards](#5-featured-items--feature-cards)
6. [Section Dividers](#6-section-dividers)
7. [Themed Menus](#7-themed-menus)
8. [Configuration Reference](#8-configuration-reference)

---

## 1. Color Palettes

Eight palettes are available in `PALETTES_V2` (defined in `renderer-v2.ts`). Select one via `SelectionConfigV2.colourPaletteId` or the Layout Lab's "Color Palette" panel.

| Palette ID | Name | Background | Accent | Best For |
|---|---|---|---|---|
| `clean-modern` | Clean Modern | `#FFFFFF` | `#111827` | Default, minimal, contemporary |
| `elegant-cream` | Elegant Cream | `#FDFCF0` | `#8B6B23` | Upscale, warm, classic |
| `midnight-gold` | Midnight Gold | `#1A1A1A` | `#D4AF37` | Dark mode, luxury, fine dining |
| `warm-earth` | Warm Earth | `#F5F0E8` | `#8B6914` | Earthy, rustic, café |
| `ocean-breeze` | Ocean Breeze | `#F0F5F8` | `#2E6B8A` | Cool, coastal, seafood |
| `forest-green` | Forest Green | `#F2F5F0` | `#2D5A27` | Natural, organic, farm-to-table |
| `valentines-rose` | Valentine's Rose | `#FFF0F3` | `#C2185B` | Valentine's Day theme |
| `lunar-red-gold` | Lunar Red & Gold | `#2B0A0A` | `#D4A017` | Lunar New Year theme |

Every palette defines all required `ColorPaletteV2` fields: `background`, `menuTitle`, `sectionHeader`, `itemTitle`, `itemPrice`, `itemDescription`, `itemIndicators.background`, `border.light`, `border.medium`, and `textMuted`.

If an unknown palette ID is provided, the engine falls back to `clean-modern`.

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

Six production templates are available, each targeting a specific page size and column layout:

### Classic Cards V2 (`classic-cards-v2`)
- Page: A4 Portrait, 4 columns
- The default template. Photo-forward grid with image cards.
- Supports FEATURE_CARD and DECORATIVE_DIVIDER.

### Classic Cards V2 Landscape (`classic-cards-v2-landscape`)
- Page: A4 Landscape, 4 columns
- Wide-format version of Classic Cards. Good for bi-fold or placemat menus.
- `rowHeight: 65`, `gapX: 10`, `gapY: 8`

### Two Column Classic (`two-column-classic-v2`)
- Page: A4 Portrait, 2 columns
- Wider columns with more space for descriptions and images.
- `rowHeight: 80`, `gapX: 12`, `gapY: 10`
- Section headers span full width (`colSpan: 2`).

### Three Column Modern (`three-column-modern-v2`)
- Page: A4 Portrait, 3 columns
- Balanced layout fitting more items per page than 2-column.
- `rowHeight: 70`, `gapX: 10`, `gapY: 8`
- Section headers span full width (`colSpan: 3`).

### Half A4 Tall (`half-a4-tall-v2`)
- Page: HALF_A4_TALL, 1 column
- Narrow single-column format for table tent cards or slim menu holders.
- `rowHeight: 60`, `gapY: 6`
- Favours `ITEM_TEXT_ROW` (text-only) for the narrow format.

### Italian Classic V2 (`italian-v2`)
- Page: A4 Portrait, 2 columns
- Text-focused layout. Auto-enables `textOnly` mode in the Layout Lab.

### Choosing a template

In the Layout Lab, templates appear as radio buttons under "Template". Programmatically, pass the template ID when calling the generate API:

```typescript
const response = await fetch('/api/dev/layout-lab/generate', {
  method: 'POST',
  body: JSON.stringify({
    templateId: 'two-column-classic-v2',
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

  # Optional — add these only if you want the features:
  # FEATURE_CARD:
  #   region: body
  #   colSpan: 2
  #   rowSpan: 3
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

itemIndicators:
  mode: INLINE
  maxCount: 3
  style: { badgeSize: 14, iconSet: emoji }
  spiceScale: { 1: "🌶", 2: "🌶🌶", 3: "🌶🌶🌶" }
  letterFallback: { vegetarian: "V", vegan: "VG", halal: "H", kosher: "K", gluten-free: "GF" }
```

---

## 5. Featured Items & Feature Cards

Featured items let restaurant owners highlight signature dishes with larger, visually distinct tiles.

### Data model

Menu items have an optional `isFeatured` boolean field:

```typescript
interface EngineItemV2 {
  id: string
  name: string
  // ...
  isFeatured?: boolean  // Set to true to feature this item
}
```

In the database, this maps to `menu_items.is_featured` (added by migration `053_add_is_featured_to_menu_items.sql`).

### How it works

1. When `item.isFeatured === true` and the template defines a `FEATURE_CARD` tile variant, the engine uses the `FEATURE_CARD` type instead of `ITEM_CARD`.
2. Feature cards are typically `colSpan: 2, rowSpan: 3` — occupying a 2×3 grid footprint for visual prominence.
3. They render with larger typography, more padding, and a bigger image area than standard cards.
4. Feature cards participate in the standard grid — they don't float or overlap other tiles.
5. If a feature card can't fit in the remaining row space, the engine advances to the next row or page.

### Graceful degradation

- If the template doesn't define `FEATURE_CARD`, featured items fall back to standard `ITEM_CARD`.
- If `textOnly` mode is enabled, all items (including featured) use `ITEM_TEXT_ROW`.

### Templates with FEATURE_CARD support

- `classic-cards-v2` — colSpan: 2, rowSpan: 3
- `valentines-v2` — colSpan: 2, rowSpan: 3
- `lunar-new-year-v2` — colSpan: 2, rowSpan: 3

### Adding FEATURE_CARD to a custom template

```yaml
tiles:
  FEATURE_CARD:
    region: body
    colSpan: 2
    rowSpan: 3
    contentBudget:
      nameLines: 2
      descLines: 3
      indicatorAreaHeight: 20
      imageBoxHeight: 100
      paddingTop: 10
      paddingBottom: 10
      totalHeight: 226    # rowSpan * rowHeight + (rowSpan - 1) * gapY
```

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

- `classic-cards-v2` — ornament style
- `valentines-v2` — ornament style
- `lunar-new-year-v2` — ornament style

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

## 7. Themed Menus

Themed menus are standard templates that bundle a specific palette, divider style, and visual treatment into a cohesive seasonal design. They don't introduce new engine primitives — they're just curated combinations of existing features.

### Available themes

#### Valentine's Day (`valentines-v2`)
- Default palette: `valentines-rose` (soft pink background, deep rose accents)
- Dividers: ornament style enabled
- Section headers: elegant serif font, rose-colored text, pink bottom border
- Page: A4 Portrait, 4 columns

#### Lunar New Year (`lunar-new-year-v2`)
- Default palette: `lunar-red-gold` (deep red background, gold accents)
- Dividers: ornament style enabled
- Section headers: elegant serif font, gold text, dark red bottom border
- Page: A4 Portrait, 4 columns
- Texture support: dark paper with gold gradient overlay

### Palette nudging

Themed templates suggest a default palette, but you can override it. The template's decorative structure (divider style, typography, borders) is preserved while the colors come from whichever palette you select.

```typescript
// Use the Lunar New Year template with a different palette
const selection: SelectionConfigV2 = {
  colourPaletteId: 'midnight-gold'  // Override the default lunar-red-gold
}
```

In the Layout Lab, simply select a different palette from the "Color Palette" panel while keeping the themed template selected.

### Creating a new themed template

A themed template is just a regular YAML template file. The "theme" is the combination of:
- A palette designed for the occasion (add it to `PALETTES_V2` in `renderer-v2.ts`)
- Divider style and section header styling that match the occasion
- Optionally, a texture entry in `TEXTURE_REGISTRY`

There's no special theme schema — it's all standard template + palette configuration.

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
  colourPaletteId?: string     // Palette ID (falls back to clean-modern)
}
```

### Layout Lab controls → SelectionConfigV2 mapping

| Layout Lab Control | Config Field |
|---|---|
| Color Palette radio buttons | `colourPaletteId` |
| "Textured backgrounds" checkbox | `texturesEnabled` |
| "Text only (no images)" checkbox | `textOnly` |
| "Fillers on/off" checkbox | `fillersEnabled` |
| "Show menu title" checkbox | `showMenuTitle` |

### Template ID → YAML file mapping

| Template ID | YAML File |
|---|---|
| `classic-cards-v2` | `templates/classic-cards-v2.yaml` |
| `classic-cards-v2-landscape` | `templates/classic-cards-v2-landscape.yaml` |
| `two-column-classic-v2` | `templates/two-column-classic-v2.yaml` |
| `three-column-modern-v2` | `templates/three-column-modern-v2.yaml` |
| `half-a4-tall-v2` | `templates/half-a4-tall-v2.yaml` |
| `italian-v2` | `templates/italian-v2.yaml` |
| `valentines-v2` | `templates/valentines-v2.yaml` |
| `lunar-new-year-v2` | `templates/lunar-new-year-v2.yaml` |

### Key source files

| File | What it contains |
|---|---|
| `engine-types-v2.ts` | PAGE_DIMENSIONS, TileTypeV2, EngineItemV2, SelectionConfigV2, TemplateV2 |
| `renderer-v2.ts` | PALETTES_V2, TEXTURE_REGISTRY, rendering functions for all tile types |
| `template-schema-v2.ts` | Zod validation schema for template YAML files |
| `tile-placer.ts` | selectItemVariant(), createDividerTile(), createItemTile() |
| `streaming-paginator.ts` | Pagination algorithm with divider insertion |
| `template-loader-v2.ts` | YAML loading and page-size-aware validation |
| `invariant-validator.ts` | Layout correctness checks (INV-1 through INV-4) |
