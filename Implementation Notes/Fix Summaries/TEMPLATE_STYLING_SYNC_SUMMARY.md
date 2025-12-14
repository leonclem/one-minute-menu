# Template Styling Synchronization Fix

## Problem
The template preview page (`/ux/menus/[menuId]/template`) showed updated styling with:
- Smaller circular images (75px) with gold borders
- Uppercase item names in serif font
- Smaller, refined typography (10px names, 12px prices, 8px descriptions)
- Elegant Dark theme with specific color palette

However, the PDF export was using old styling with:
- Larger images
- Different fonts and sizes
- Inconsistent colors

This created a mismatch between what users saw in the preview and what they received in the exported PDF.

## Root Cause
The application uses two different rendering components:

1. **`TemplateLayoutRenderer`** (`src/components/templates/TemplateLayoutRenderer.tsx`)
   - Used for browser preview on the template selection page
   - Uses inline React styles
   - Has the updated, refined styling

2. **`ServerLayoutRenderer`** (`src/lib/templates/export/layout-renderer.tsx`)
   - Used for PDF/HTML export
   - Uses CSS-in-JS with `<style>` tags
   - Had outdated styling that didn't match the preview

## Solution
Synchronized the CSS in `ServerLayoutRenderer` to match the inline styles from `TemplateLayoutRenderer`.

### Detailed Style Changes

#### 1. Circular Images (Elegant Dark Template)
```css
/* Before */
width: 120px;
height: 120px;

/* After */
width: 75px !important;
height: 75px !important;
border-radius: 50% !important;
border: 2px solid #c8a562 !important;
box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
```

#### 2. Item Names
```css
/* Before */
font-family: body font;
font-size: 1rem;
font-weight: 600;

/* After */
font-family: 'Nanum Myeongjo', 'Habibi', 'Times New Roman', serif !important;
font-size: 10px !important;
font-weight: 400 !important;
color: #f8f5f0 !important;
text-transform: uppercase !important;
letter-spacing: 0.05em !important;
height: 28px !important;
```

#### 3. Prices
```css
/* Before */
font-size: 1rem;
color: palette.price;

/* After */
font-family: 'Lato', system-ui, sans-serif !important;
font-size: 12px !important;
font-weight: 500 !important;
color: #c8a562 !important;
height: 16px !important;
```

#### 4. Descriptions
```css
/* Before */
font-size: 0.875rem;
opacity: 0.7;

/* After */
font-family: 'Lato', system-ui, sans-serif !important;
font-size: 8px !important;
font-weight: 400 !important;
color: #d4d2ce !important;
text-transform: lowercase !important;
line-height: 1.35 !important;
```

#### 5. Menu Title
```css
/* Before */
font-size: 2.5rem;
font-weight: 700;

/* After */
font-family: 'Playfair Display', 'Times New Roman', serif !important;
font-size: 36px !important;
font-weight: 600 !important;
color: #c8a562 !important;
letter-spacing: 0.08em !important;
text-transform: uppercase !important;
```

#### 6. Section Headers
```css
/* Before */
font-size: 1.5rem;
font-weight: 600;
border-bottom: 2px solid accent;

/* After */
font-size: 36px !important;
font-weight: 400 !important;
padding: 1.5rem 1rem;
border-bottom: 1px solid rgba(255, 255, 255, 0.1);
letter-spacing: 0.05em !important;
```

### Component Updates

#### MenuItemTile Component
**Before:**
```tsx
<img 
  src={tile.imageUrl} 
  alt={tile.name}
  className="w-full h-48 object-cover rounded-t-lg"
/>
<h3 className="text-lg font-medium text-gray-900">{tile.name}</h3>
```

**After:**
```tsx
<img 
  src={tile.imageUrl} 
  alt={tile.name}
  className="item-image"
/>
<h3 className="item-name">{tile.name}</h3>
```

Replaced Tailwind utility classes with semantic class names that have proper CSS definitions.

## Files Modified

1. **`src/lib/templates/export/layout-renderer.tsx`**
   - Updated `getTemplateCSS()` function with new styling
   - Updated `MenuItemTile` component to use semantic classes
   - Added `!important` flags to ensure style precedence
   - Added Nanum Myeongjo and Habibi fonts to Google Fonts import

2. **`src/lib/templates/export/pdf-exporter.ts`**
   - Enhanced wait strategy for font loading
   - Added `networkidle0` wait condition
   - Added `document.fonts.ready` check

3. **`src/app/api/templates/export/pdf/route.ts`**
   - Added debug logging for HTML preview
   - Improved HTML document structure

## Testing Checklist

### Visual Comparison Test
1. ✓ Open template preview page: `/ux/menus/[menuId]/template`
2. ✓ Note the visual styling (image sizes, fonts, colors)
3. ✓ Export PDF from: `/ux/menus/[menuId]/export`
4. ✓ Open exported PDF
5. ✓ Compare PDF styling with preview - should match exactly

### Specific Style Checks
- [ ] Circular images are 75px × 75px (not larger)
- [ ] Images have gold border (#c8a562)
- [ ] Item names are uppercase in serif font
- [ ] Item names are 10px font size
- [ ] Prices are 12px in gold color
- [ ] Descriptions are 8px, lowercase
- [ ] Menu title is 36px, uppercase, gold
- [ ] Section headers are 36px with subtle border
- [ ] Background texture is applied (Elegant Dark)

### Template-Specific Tests
Test with each template:
- [ ] Classic Grid Cards (with Elegant Dark palette)
- [ ] Classic Italian (text-only with leader dots)
- [ ] Modern Minimal
- [ ] Simple Rows (left-aligned images)

### Export Format Tests
- [ ] PDF export matches preview
- [ ] HTML export matches preview
- [ ] Image export matches preview (when implemented)

## Known Limitations

1. **Font Loading Time**: PDF generation may take 100-500ms longer due to waiting for Google Fonts to load. This is acceptable for reliability.

2. **!important Usage**: We use `!important` flags extensively to ensure export styles override any defaults. This is necessary because the PDF rendering context may have different style precedence rules.

3. **Image Fallbacks**: Items without images show a placeholder icon. The styling of these fallbacks matches the template's image styling.

## Rollback Instructions

If these changes cause issues:

```bash
# View changes
git diff src/lib/templates/export/layout-renderer.tsx
git diff src/lib/templates/export/pdf-exporter.ts
git diff src/app/api/templates/export/pdf/route.ts

# Revert specific file
git checkout HEAD -- src/lib/templates/export/layout-renderer.tsx

# Or revert all changes
git checkout HEAD -- src/lib/templates/export/
git checkout HEAD -- src/app/api/templates/export/pdf/
```

## Future Improvements

1. **Shared Style System**: Create a shared style generation function that both `TemplateLayoutRenderer` and `ServerLayoutRenderer` use to ensure they always stay in sync.

2. **Visual Regression Testing**: Implement automated visual comparison tests that compare preview screenshots with PDF renders.

3. **Style Validation**: Add a test that validates the CSS output from both renderers matches.

4. **Font Preloading**: Consider preloading fonts in a warmup phase to speed up PDF generation.

## Related Documentation

- [PDF Export Fix Summary](./PDF_EXPORT_FIX_SUMMARY.md)
- Template Engine Documentation: `src/lib/templates/README.md`
- Layout Renderer: `src/lib/templates/export/layout-renderer.tsx`
- Template Definitions: `src/lib/templates/template-definitions.ts`
