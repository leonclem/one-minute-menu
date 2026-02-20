# Template Authoring Guide

## Overview

The V2 layout engine uses YAML-driven templates. New templates can be created with zero code changes by authoring a `.yaml` file in `src/lib/templates/v2/templates/`.

**See also:** [README.md](./README.md) for architecture and flow; [STYLING_GUIDE.md](./STYLING_GUIDE.md) for fonts and styling; [LIMITATIONS.md](./LIMITATIONS.md) for what the engine cannot do.

## Creating a new template

1. **Read [LIMITATIONS.md](./LIMITATIONS.md)** — So you know what is not possible and where to make design concessions.
2. **Copy an existing template** — From `src/lib/templates/v2/templates/` (e.g. `classic-cards-v2.yaml`).
3. **Define structure** — Page size and margins, regions, body grid. For each body tile, set `totalHeight` to the footprint: `rowSpan × rowHeight + (rowSpan − 1) × gapY`. Use the **YAML Reference** and **Content Budget Calculation** sections below.
4. **Style tiles** — Use [STYLING_GUIDE.md](./STYLING_GUIDE.md) for fonts, sub-element typography, spacing, borders, and backgrounds.
5. **Test in Layout Lab** — `/dev/layout-lab` with different fixtures; export PDF and verify.

## Quick Start

1. Copy an existing template (e.g., `classic-cards-v2.yaml`)
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

Available font sets: `modern-sans`, `elegant-serif`, `friendly-rounded`, `classic-professional`, `distinctive-sans`. Full details and which sub-elements apply to which tile types: [STYLING_GUIDE.md](./STYLING_GUIDE.md).

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

### Content Budget Calculation

The template schema defines a **content budget** with these fields (all in points or line counts):

- `nameLines`, `descLines` — max lines for name/description (used for text clamping)
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
- [ ] Works in text-only mode
- [ ] Section headers are distinctive and legible

### Common Pitfalls

1. **totalHeight mismatch**: Must exactly equal `rowSpan × rowHeight + (rowSpan - 1) × gapY`
2. **Missing contentBudget**: Every tile variant requires a contentBudget
3. **Font set typo**: Must match a registered font set ID exactly
4. **Oversized images**: imageBoxHeight should leave room for text elements
5. **Footer overflow**: Footer region height must accommodate all contact info lines
