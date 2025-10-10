# Menu Templates

This directory contains template descriptor files that define the layout, typography, and styling for menu designs.

## Overview

Templates are declarative JSON configurations that control how menu content is rendered. Each template defines:

- **Canvas**: Paper size, DPI, column layout, margins, and bleed
- **Layers**: Background images/colors and decorative ornaments
- **Fonts**: Typography specifications with size ranges
- **Text Frames**: Content areas and overflow handling
- **Image Display**: How food images are shown (icon, thumbnail, hero, none)
- **Price Formatting**: Currency display and alignment
- **Content Limits**: Character and line limits for text fields
- **Accessibility**: Minimum font sizes and contrast ratios

## Available Templates

### Kraft Sports (`kraft-sports.json`)

A rustic, energetic design perfect for sports bars and casual dining.

- **Style**: Kraft paper texture with bold typography
- **Layout**: 2-column layout for compact presentation
- **Fonts**: Bebas Neue headings, Roboto body
- **Image Display**: Camera icons (click to view full images)
- **Best For**: Sports bars, pubs, casual restaurants

### Minimal Bistro (`minimal-bistro.json`)

An elegant, clean design for upscale dining establishments.

- **Style**: Minimalist with refined typography
- **Layout**: Single column for spacious presentation
- **Fonts**: Playfair Display headings, Lato body
- **Image Display**: Small inline thumbnails
- **Best For**: Fine dining, bistros, upscale cafes

## Template Structure

```json
{
  "id": "template-id",
  "name": "Template Name",
  "version": "1.0.0",
  "canvas": {
    "size": "A4",
    "dpi": 300,
    "cols": 2,
    "gutter": 40,
    "margins": { "top": 60, "right": 50, "bottom": 60, "left": 50 },
    "bleed": 10
  },
  "layers": {
    "background": {
      "type": "raster",
      "src": "/templates/references/template-reference.svg",
      "color": "#FFFFFF",
      "blend": "normal"
    }
  },
  "fonts": {
    "heading": {
      "family": "Font Name",
      "weight": 700,
      "min": 24,
      "max": 32,
      "tabular": false
    },
    "body": { ... },
    "price": { ... }
  },
  "textFrames": [
    {
      "key": "main-left",
      "col": 1,
      "overflow": ["wrap", "compact", "reflow", "paginate", "shrink"]
    }
  ],
  "imageDisplay": "icon",
  "price": {
    "currency": "auto",
    "decimals": 2,
    "align": "right"
  },
  "limits": {
    "nameChars": 50,
    "descLinesWeb": 3,
    "descLinesPrint": 2
  },
  "overflowPolicies": ["wrap", "compact", "reflow", "paginate", "shrink"],
  "accessibility": {
    "minBodyPx": 13,
    "contrastMin": 4.5
  }
}
```

## Overflow Policies

Templates define how content should adapt when it doesn't fit:

1. **wrap**: Enable hyphenation and text wrapping
2. **compact**: Reduce spacing and line-height by 20%
3. **reflow**: Convert multi-column to single column
4. **paginate**: Create multiple pages (print only)
5. **shrink**: Reduce font sizes within min/max range

Policies are applied in order until content fits.

## Image Display Modes

- **icon**: Camera icon (📷) after item names - click to view full image
- **thumbnail**: Small inline images next to items
- **hero**: Large images at section headers
- **none**: No images displayed

## Font Requirements

- All fonts must be available from Google Fonts
- Fonts should have good international character support
- Noto Sans is used as fallback for CJK and special characters
- Price fonts should support tabular numerals for alignment

## Accessibility Requirements

Templates must meet minimum accessibility standards:

- **Print**: Minimum 13px body text
- **Web**: Minimum 14px body text
- **Contrast**: Minimum 4.5:1 ratio (WCAG AA)

## Creating New Templates

1. Create a new JSON file in this directory: `{template-id}.json`
2. Follow the structure defined in the schema (see `src/lib/templates/types.ts`)
3. Create a reference style image in `references/{template-id}-reference.svg`
4. Validate using: `npm run template:validate`
5. Test with sample menu data: `npm run template:preview {template-id}`

## Validation

All templates are validated against a strict schema. Run validation:

```bash
npx tsx scripts/validate-templates.ts
```

Common validation errors:
- Invalid semver version format
- Font size min > max
- Text frame column exceeds canvas columns
- Missing required fields
- Invalid enum values

## Migration

When updating templates, include migration information:

```json
{
  "migration": {
    "from": "1.0.0",
    "notes": "Updated font sizes for better readability"
  }
}
```

## Best Practices

1. **Test with real data**: Use actual menu content with varying lengths
2. **Consider print**: Ensure fonts embed properly in PDFs
3. **International support**: Test with special characters (£, €, ñ, ä, 冷)
4. **Accessibility**: Always meet minimum contrast and font size requirements
5. **Performance**: Keep reference images under 5MB
6. **Fallbacks**: Always provide solid color fallback for backgrounds

## File Organization

```
public/templates/
├── README.md                          # This file
├── kraft-sports.json                  # Kraft Sports template
├── minimal-bistro.json                # Minimal Bistro template
└── references/                        # Reference style images
    ├── README.md
    ├── kraft-sports-reference.svg
    └── minimal-bistro-reference.svg
```

## Support

For questions or issues with templates:
- Check the design document: `.kiro/specs/ai-menu-templates/design.md`
- Review type definitions: `src/lib/templates/types.ts`
- See validation schema: `src/lib/templates/validation.ts`
