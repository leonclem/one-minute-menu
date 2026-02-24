# Template Authoring Guide

## Overview

The V2 layout engine uses YAML-driven templates. New templates can be created with zero code changes by authoring a `.yaml` file in `src/lib/templates/v2/templates/`.

**See also:** [README.md](./README.md) for architecture and flow; [STYLING_GUIDE.md](./STYLING_GUIDE.md) for fonts and styling; [LIMITATIONS.md](./LIMITATIONS.md) for what the engine cannot do.

## Creating a new template

1. **Read [LIMITATIONS.md](./LIMITATIONS.md)** — So you know what is not possible and where to make design concessions.
2. **Copy an existing template** — From `src/lib/templates/v2/templates/` (e.g. `4-column-portrait.yaml`).
3. **Define structure** — Page size and margins, regions, body grid. For each body tile, set `totalHeight` to the footprint: `rowSpan × rowHeight + (rowSpan − 1) × gapY`. Use the **YAML Reference** and **Content Budget Calculation** sections below.
4. **Style tiles** — Use [STYLING_GUIDE.md](./STYLING_GUIDE.md) for fonts, sub-element typography, spacing, borders, and backgrounds.
5. **Test in Layout Lab** — `/dev/layout-lab` with different fixtures; export PDF and verify.

## Quick Start

1. Copy an existing template (e.g., `4-column-portrait.yaml`)
2. Change `id`, `version`, and `name`
3. Adjust page size, margins, regions, grid settings
4. Configure tile styles with sub-element typography
5. Test in Layout Lab (`/dev/layout-lab`)

## YAML Reference

### Page Configuration
```yaml
page:
  size: A4_PORTRAIT  # A4_PORTRAIT | A4_LANDSCAPE | A3_PORTRAIT | A3_LANDSCAPE | HALF_A4_TALL
  margins:
    top: 22.68
    right: 25.51
    bottom: 22.68
    left: 25.51
```

### Regions
```yaml
regions:
  header:
    height: 60  # points
  title:
    height: 32
  footer:
    height: 45
  # body height is computed from remaining space
```

### Body Grid
```yaml
body:
  container:
    type: GRID
    cols: 4        # 1-6
    rowHeight: 70  # points (min 50)
    gapX: 8
    gapY: 8
```

### Sub-Element Typography

Each tile type can specify per-sub-element fonts:
```yaml
ITEM_CARD:
  style:
    typography:
      name:
        fontSet: "elegant-serif"
        fontSize: "xsm"
        fontWeight: "bold"
      description:
        fontSet: "modern-sans"
        fontSize: "xxs"
        fontWeight: "normal"
      price:
        fontSet: "modern-sans"
        fontSize: "xs"
        fontWeight: "bold"
```

Available font sets: `modern-sans`, `elegant-serif`, `friendly-rounded`, `classic-professional`, `distinctive-sans`, `system-sans` (Arial), `system-sans-bold` (Arial Black), `merriweather`, `raleway`, `lato`. Full details and which sub-elements apply to which tile types: [STYLING_GUIDE.md](./STYLING_GUIDE.md).

Font size tokens: `xxxs` (6pt), `xxs` (7pt), `xs` (10pt), `xsm` (9pt), `sm` (12pt), `base` (14pt), `lg` (16pt), `xl` (18pt), `2xl` (20pt), `3xl` (24pt), `4xl` (28pt)

Font weight tokens: `normal` (400), `medium` (500), `semibold` (600), `bold` (700), `extrabold` (800)

### Section Header Styles

Each template should have a distinctive section header. Common patterns:

**Accent underline:**
```yaml
SECTION_HEADER:
  style:
    typography:
      textTransform: "uppercase"
    border:
      width: 3
      color: "#D4AF37"
      sides: ["bottom"]
```

**Background block:**
```yaml
SECTION_HEADER:
  style:
    background:
      color: "#5C1A1A"
      borderRadius: 4
```

**Side bar + hairline:**
```yaml
SECTION_HEADER:
  style:
    border:
      width: 3
      color: "#333333"
      sides: ["left", "bottom"]
```

**Centered, no border:**
```yaml
SECTION_HEADER:
  style:
    typography:
      textAlign: "center"
      lineHeight: "relaxed"
    spacing:
      paddingTop: 12
      paddingBottom: 12
```

### Filler (spacer tiles) configuration

Filler tiles fill empty grid cells so that every cell is occupied. In the UI, **5. Spacer Tiles** offers: **Blank** (default; plain rectangles with alternating palette colours), **None** (no fillers), or a pattern to override filler appearance. Fillers are enabled by default when not **None** (via `selection.fillersEnabled`). The layout engine uses spread distribution rules to intersperse fillers among menu items rather than clustering them at the end.

```yaml
filler:
  enabled: true                     # template-level default; user can override
  safeZones:                        # regions where fillers may appear
    - startRow: 0                   # empty [] defaults to entire body grid
      endRow: LAST_CONTENT
      startCol: 0
      endCol: 3                     # should equal cols - 1
  tiles:                            # empty [] uses a default block matching ITEM_CARD rowSpan
    - id: filler-blank
      style: color                  # 'color' for plain block (UI controls final look: Blank or pattern)
      content: ''
      rowSpan: 2                    # match ITEM_CARD rowSpan for visual consistency
  policy: SEQUENTIAL                # SEQUENTIAL | RANDOM_SEEDED
```

**Key points:**
- Filler `rowSpan` should match the primary item tile's `rowSpan` so fillers fill the full slot height.
- When `tiles: []`, a default half-opacity colour block is generated with `rowSpan` matching `ITEM_CARD.rowSpan`.
- When `safeZones: []`, fillers can go in any empty cell within a section's rows.
- The spread algorithm avoids horizontally adjacent fillers and vertically stacked fillers across consecutive rows (best-effort).
- Sections with FEATURE_CARD items (multi-col) fall back to trailing filler placement.

### Content Budget Calculation

The template schema defines a **content budget** with these fields (all in points or line counts):

- `nameLines`, `descLines` — max lines for name/description (used for text clamping and layout; see **Text Truncation** below)
- `indicatorAreaHeight` — space reserved for dietary/allergen indicators
- `imageBoxHeight` — height of the image area (0 for text-only tiles)
- `paddingTop`, `paddingBottom`
- `totalHeight` — total vertical space for the tile’s content

**For body (grid) tiles:** placement uses **footprint**, not content budget. The footprint height is:

`rowSpan × rowHeight + (rowSpan − 1) × gapY`

**Rule:** Set `totalHeight` to exactly this value so the tile’s content area matches the grid cell. The loader does not derive `totalHeight`; you must set it in YAML.

Example for ITEM_CARD with rowSpan 2, rowHeight 70, gapY 8:
- Footprint height: 2 × 70 + 1 × 8 = **148pt**
- Use `totalHeight: 148` in that tile’s `contentBudget`

### Font Pairing Recommendations

| Style | Header | Body |
|-------|--------|------|
| Fine dining | elegant-serif | classic-professional |
| Modern cafe | distinctive-sans | modern-sans |
| Family restaurant | friendly-rounded | modern-sans |
| Trendy | modern-sans | modern-sans |

### Testing Checklist

- [ ] Renders correctly in Layout Lab at all zoom levels
- [ ] Text doesn't overflow tiles
- [ ] Images display correctly in all image modes
- [ ] Footer content is visible
- [ ] PDF export matches web preview
- [ ] Works with all colour palettes
- [ ] Works with background textures (dark-paper, waves, linen, etc.)
- [ ] Works when Image Options is set to "None" (text only, no images)
- [ ] Section headers are distinctive and legible
- [ ] Spacer tiles (fillers) render correctly when enabled (check spread distribution)
- [ ] Filler rowSpan matches ITEM_CARD rowSpan (no half-height gaps)

### Text Truncation

Descriptions and names are truncated by **line count**, not by character count:

- The renderer uses CSS `WebkitLineClamp` (web preview) to cap text at `nameLines` / `descLines`.
- Overflow text is hidden and an ellipsis (`...`) is appended.
- The effective character limit depends on tile width and font size — narrower tiles show fewer characters per line.
- The renderer estimates actual line usage to position elements compactly (content-aware layout), so short text doesn't leave large gaps.

Approximate characters per line (at default font sizes):

| Template | Approx. chars/line |
|----------|-------------------|
| 4-column-portrait | 25–35 |
| 3-column-portrait | 30–42 |
| 2-column-portrait | 40–55 |
| 1-column-tall | 18–22 |
| 4-column-landscape | 25–35 |

### Common Pitfalls

1. **totalHeight mismatch**: Must exactly equal `rowSpan × rowHeight + (rowSpan - 1) × gapY`
2. **Missing contentBudget**: Every tile variant requires a contentBudget
3. **Font set typo**: Must match a registered font set ID exactly
4. **Oversized images**: imageBoxHeight should leave room for text elements
5. **Footer overflow**: Footer region height must accommodate all contact info lines
