# V2 Template Styling Guide

This guide covers the comprehensive styling system available for V2 templates.

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

#### Line Height Tokens
- `tight`: 1.2
- `normal`: 1.4
- `relaxed`: 1.6

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

## Complete Example

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

Currently, styling is supported for:
- `SECTION_HEADER` - Section headers with full styling support
- `TITLE` - Menu title (typography styling)

More tile types will support styling in future updates.

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