# Template System Module

This module provides the core template system for AI-enhanced menu templates. It includes TypeScript interfaces, validation schemas, and utilities for working with template descriptors.

## Overview

Templates are declarative JSON configurations that define:
- Canvas size and layout grid
- Typography (fonts, sizes, weights)
- Content fitting strategies (overflow policies)
- Image display modes
- Accessibility requirements

## Usage

### Validating a Template Descriptor

```typescript
import { validateDescriptor, validateDescriptorSafe } from '@/lib/templates/types';

// Throws error if invalid
try {
  const template = validateDescriptor(jsonData);
  console.log('Template is valid:', template.name);
} catch (error) {
  console.error('Validation failed:', error.message);
}

// Returns result object without throwing
const result = validateDescriptorSafe(jsonData);
if (result.success) {
  console.log('Template is valid:', result.data.name);
} else {
  console.error('Validation errors:', result.errors);
}
```

### Template Descriptor Structure

```typescript
{
  "id": "kraft-sports",
  "name": "Kraft Sports",
  "version": "1.0.0",
  "canvas": {
    "size": "A4",
    "dpi": 300,
    "cols": 2,
    "gutter": 20,
    "margins": { "top": 40, "right": 40, "bottom": 40, "left": 40 },
    "bleed": 3
  },
  "layers": {
    "background": {
      "type": "raster",
      "src": "/templates/references/kraft-sports-bg.jpg",
      "blend": "multiply"
    }
  },
  "fonts": {
    "heading": {
      "family": "Playfair Display",
      "weight": 700,
      "min": 18,
      "max": 24
    },
    "body": {
      "family": "Open Sans",
      "weight": 400,
      "min": 12,
      "max": 14
    },
    "price": {
      "family": "Open Sans",
      "weight": 600,
      "min": 12,
      "max": 14,
      "tabular": true
    }
  },
  "textFrames": [
    {
      "key": "main",
      "col": 1,
      "overflow": ["wrap", "compact", "shrink"]
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
  },
  "migration": {
    "from": "0.9.0",
    "notes": "Updated canvas configuration for better print quality"
  }
}
```

## Validation Rules

### Required Fields
- `id`: Unique template identifier (non-empty string)
- `name`: Human-readable name (non-empty string)
- `version`: Semantic version (format: X.Y.Z)
- `canvas`: Canvas configuration
- `layers`: Layer configuration with background
- `fonts`: Font specifications for heading, body, and price
- `textFrames`: At least one text frame definition
- `imageDisplay`: One of 'icon', 'thumbnail', 'hero', or 'none'
- `price`: Price formatting configuration
- `limits`: Content limits
- `overflowPolicies`: At least one overflow policy
- `accessibility`: Accessibility requirements

### Canvas Configuration
- `size`: Must be 'A4' or 'A3'
- `dpi`: Must be 300 or 600
- `cols`: Positive integer
- `gutter`: Non-negative number
- `margins`: All margins must be non-negative
- `bleed`: Optional, non-negative number

### Font Specifications
- `family`: Non-empty string (Google Fonts name)
- `weight`: Optional, 100-900
- `min`: Positive number, must be ≤ max
- `max`: Positive number, must be ≥ min
- `tabular`: Optional boolean

### Background Layer
- `type`: 'raster' or 'solid'
- If raster: `src` is required
- If solid: `color` is required (hex format: #RRGGBB)
- `blend`: Optional, 'normal', 'multiply', or 'overlay'

### Text Frames
- `key`: Non-empty string
- `col`: Positive integer, must not exceed canvas.cols
- `overflow`: Array of at least one overflow policy

### Overflow Policies
Valid values: 'wrap', 'compact', 'reflow', 'paginate', 'shrink'

### Accessibility
- `minBodyPx`: Positive number (minimum body font size)
- `contrastMin`: Positive number (minimum contrast ratio)

## Error Handling

The validation system provides detailed error messages:

```typescript
const result = validateDescriptorSafe(invalidData);
if (!result.success) {
  result.errors.forEach(error => {
    console.log(`Field: ${error.field}`);
    console.log(`Message: ${error.message}`);
    console.log(`Code: ${error.code}`);
  });
}
```

## Testing

Run the validation tests:

```bash
npm test -- src/lib/templates/__tests__/validation.test.ts
```

## Future Enhancements

- Font licensing validation
- Custom font upload support
- Template versioning and migration utilities
- Template preview generation
- Template marketplace integration
