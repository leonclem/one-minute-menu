# V2 Template Styling Guide

This guide covers the styling system available for V2 templates (fonts, typography, spacing, borders, backgrounds). For template structure and content budget, see [TEMPLATE_AUTHORING_GUIDE.md](./TEMPLATE_AUTHORING_GUIDE.md). For what cannot be styled or overridden, see [LIMITATIONS.md](./LIMITATIONS.md).

## Font Sets

Choose from 5 predefined font combinations optimized for menu design:

### Available Font Sets

| Font Set ID | Primary Font | Personality | Best For |
|-------------|--------------|-------------|----------|
| `modern-sans` | Inter | Clean, modern, highly readable | Contemporary dining, fast-casual |
| `elegant-serif` | Playfair Display | Sophisticated, upscale, editorial | Fine dining, wine bars, upscale establishments |
| `friendly-rounded` | Nunito Sans | Approachable, warm, friendly | Cafes, family restaurants, breakfast spots |
| `classic-professional` | Source Sans Pro | Professional, trustworthy, versatile | Business dining, corporate cafeterias |
| `distinctive-sans` | Poppins | Modern, geometric, distinctive | Trendy cafes, modern bistros |

## Styling Properties

### Typography

```yaml
style:
  typography:
    fontSet: "modern-sans"        # Font set ID (see table above)
    fontSize: "2xl"               # Font size token (see sizes below)
    fontWeight: "semibold"        # Font weight token (see weights below)
    textAlign: "center"           # Text alignment: left, center, right
    lineHeight: "normal"          # Line height token (see line heights below)
    textTransform: "uppercase"    # Text transform: none, uppercase, lowercase, capitalize
    color: "#1E40AF"              # Text color override (hex, rgb, named colors)
```

#### Font Size Tokens
- `xxxs`: 6pt
- `xxs`: 7pt  
- `xs`: 10pt
- `xsm`: 9pt
- `sm`: 12pt
- `base`: 14pt
- `lg`: 16pt
- `xl`: 18pt
- `2xl`: 20pt
- `3xl`: 24pt
- `4xl`: 28pt

#### Font Weight Tokens
- `normal`: 400
- `medium`: 500
- `semibold`: 600
- `bold`: 700
- `extrabold`: 800

#### Line Height Tokens
- `tight`: 1.2
- `normal`: 1.4
- `relaxed`: 1.6

### Sub-Element Typography

For tiles that contain multiple text elements, you can style each sub-element independently. Sub-elements and where they apply:

- **`name`**, **`description`**, **`price`** — `ITEM_CARD`, `ITEM_TEXT_ROW`, `FEATURE_CARD`
- **`label`** — `SECTION_HEADER` (section title text)
- **`contact`** — `FOOTER_INFO` (address, phone, email, etc.)

Each sub-element supports:
- `fontSet`: Font set ID
- `fontSize`: Font size token
- `fontWeight`: Font weight token
- `lineHeight`: Line height token

**Example:**
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

### Renderer defaults (not in template schema)

- **Image drop shadow** — The renderer applies a fixed drop shadow to item images (except in compact-circle mode). This is not configurable per template.
- **Letter spacing** — When `textTransform: "uppercase"` is set, the renderer applies a small letter-spacing value automatically. Custom letter-spacing cannot be set in YAML.

### Spacing

```yaml
style:
  spacing:
    paddingTop: 8        # Top padding in points
    paddingBottom: 4     # Bottom padding in points
    paddingLeft: 16      # Left padding in points
    paddingRight: 16     # Right padding in points
```

### Borders

```yaml
style:
  border:
    width: 1                    # Border width in points
    color: "#E5E7EB"           # Border color (hex, rgb, named colors)
    style: "solid"             # Border style: solid, dashed, dotted
    sides: ["bottom"]          # Array of sides: top, bottom, left, right
```

#### Border Examples

**Bottom border only:**
```yaml
border:
  width: 1
  color: "#E5E7EB"
  style: "solid"
  sides: ["bottom"]
```

**Full border:**
```yaml
border:
  width: 2
  color: "#D4AF37"
  style: "solid"
  sides: ["top", "bottom", "left", "right"]
```

**Dashed top and bottom:**
```yaml
border:
  width: 1
  color: "#666666"
  style: "dashed"
  sides: ["top", "bottom"]
```

### Background

```yaml
style:
  background:
    color: "#F5F2D0"      # Background color (hex, rgb, named colors)
    borderRadius: 8       # Corner radius in points
```

## Complete Examples

### Section Header Example

Here's a fully styled section header:

```yaml
SECTION_HEADER:
  region: body
  colSpan: 4
  style:
    typography:
      fontSet: "elegant-serif"
      fontSize: "2xl"
      fontWeight: "semibold"
      textAlign: "center"
      lineHeight: "normal"
    spacing:
      paddingTop: 12
      paddingBottom: 8
      paddingLeft: 16
      paddingRight: 16
    border:
      width: 2
      color: "#D4AF37"
      style: "solid"
      sides: ["bottom"]
    background:
      color: "#F5F2D0"
      borderRadius: 8
  contentBudget:
    nameLines: 1
    descLines: 0
    indicatorAreaHeight: 0
    imageBoxHeight: 0
    paddingTop: 12
    paddingBottom: 8
    totalHeight: 40
```

### ITEM_CARD Example

Here's a complete example of an ITEM_CARD with sub-element typography and full styling:

```yaml
ITEM_CARD:
  region: body
  colSpan: 2
  style:
    typography:
      name:
        fontSet: "elegant-serif"
        fontSize: "xsm"
        fontWeight: "bold"
        lineHeight: "tight"
      description:
        fontSet: "modern-sans"
        fontSize: "xxs"
        fontWeight: "normal"
        lineHeight: "normal"
      price:
        fontSet: "modern-sans"
        fontSize: "xs"
        fontWeight: "bold"
        color: "#D4AF37"
    spacing:
      paddingTop: 8
      paddingBottom: 8
      paddingLeft: 12
      paddingRight: 12
    border:
      width: 1
      color: "#E5E7EB"
      style: "solid"
      sides: ["bottom"]
    background:
      color: "#FFFFFF"
      borderRadius: 4
  contentBudget:
    nameLines: 2
    descLines: 3
    indicatorAreaHeight: 0
    imageBoxHeight: 0
    paddingTop: 8
    paddingBottom: 8
    totalHeight: 60
```

### FOOTER_INFO Example

Here's a complete example of FOOTER_INFO with template styling:

```yaml
FOOTER_INFO:
  region: footer
  colSpan: 4
  style:
    background:
      color: "#1E40AF"
      borderRadius: 0
    border:
      width: 0
      color: "transparent"
      style: "solid"
      sides: []
    spacing:
      paddingTop: 16
      paddingBottom: 16
      paddingLeft: 24
      paddingRight: 24
    typography:
      contact:
        fontSet: "modern-sans"
        fontSize: "xs"
        fontWeight: "normal"
        color: "#FFFFFF"
        textAlign: "center"
        lineHeight: "relaxed"
  contentBudget:
    nameLines: 0
    descLines: 0
    indicatorAreaHeight: 0
    imageBoxHeight: 0
    paddingTop: 16
    paddingBottom: 16
    totalHeight: 50
```

## Color Recommendations

### Common Menu Colors

**Neutral Colors:**
- Light gray: `#F9FAFB`
- Medium gray: `#E5E7EB`
- Dark gray: `#6B7280`

**Elegant Colors:**
- Cream: `#F5F2D0`
- Warm beige: `#F3F0E7`
- Gold accent: `#D4AF37`

**Modern Colors:**
- Clean white: `#FFFFFF`
- Soft blue: `#F0F9FF`
- Navy accent: `#1E40AF`

## Tile Types That Support Styling

All tile types support styling, including:
- `SECTION_HEADER` - Section headers with full styling support
- `TITLE` - Menu title (typography styling)
- `ITEM_CARD` - Menu items with sub-element typography support
- `FOOTER_INFO` - Footer information with background, border, and contact typography
- `IMAGE` - Images with box shadow and other render style properties
- And all other tile types in the V2 template system

## Tips

1. **Font Pairing**: Stick to one font set per template for consistency
2. **Contrast**: Ensure sufficient contrast between text and background colors
3. **Spacing**: Use consistent padding values throughout your template
4. **Borders**: Subtle borders (1-2pt) work best for menu design
5. **Colors**: Test colors in both web preview and PDF export

## Testing Your Styles

1. Use the Layout Lab at `/dev/layout-lab` to preview changes
2. Test with different fixture data (tiny, medium, large)
3. Export PDF to verify font loading and styling
4. Check both light and dark color palettes