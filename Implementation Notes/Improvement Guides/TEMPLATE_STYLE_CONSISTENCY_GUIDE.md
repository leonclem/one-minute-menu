# Template Style Consistency Guide

## Problem
We have two rendering systems that need to stay in sync:
1. **Client-side preview** (`TemplateLayoutRenderer.tsx`) - uses inline React styles
2. **Server-side export** (`layout-renderer.tsx`) - uses CSS-in-JS for PDF/HTML export

When styles are updated in one place, they must be manually updated in the other, leading to inconsistencies.

## Current Solution (Interim)

### Manual Synchronization Checklist
When updating template styles, you MUST update both files:

#### 1. Update Client Preview (`src/components/templates/TemplateLayoutRenderer.tsx`)
- Inline styles in React components
- Used for browser preview on `/template` page

#### 2. Update Server Export (`src/lib/templates/export/layout-renderer.tsx`)
- CSS strings in `getTemplateCSS()` function
- Used for PDF, HTML, and image exports

### Critical Style Points to Keep in Sync

#### Circular Images (Elegant Dark Template)
**Location in both files:**
- Size: `75px × 75px`
- Border: `2px solid ${palette.accent}` (gold: #c8a562)
- Border radius: `50%`
- Box shadow: `0 2px 6px rgba(0, 0, 0, 0.25)`
- Margin bottom: `12px`

**Client (TemplateLayoutRenderer.tsx):**
```tsx
<div style={{
  width: '75px',
  height: '75px',
  borderRadius: '50%',
  border: `2px solid ${palette.accent}`,
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
}}>
```

**Server (layout-renderer.tsx):**
```css
.menu-item-image img {
  width: 75px !important;
  height: 75px !important;
  border-radius: 50% !important;
  border: 2px solid #c8a562 !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
}
```

#### Item Names
**Both files:**
- Font: `'Nanum Myeongjo', 'Habibi', 'Times New Roman', serif`
- Size: `10px`
- Weight: `400`
- Color: `#f8f5f0`
- Transform: `uppercase`
- Letter spacing: `0.05em`
- Height: `28px` (for vertical alignment)

#### Prices
**Both files:**
- Font: `'Lato', system-ui, sans-serif`
- Size: `12px`
- Weight: `500`
- Color: `#c8a562` (gold)
- Height: `16px` (for vertical alignment)

#### Descriptions
**Both files:**
- Font: `'Lato', system-ui, sans-serif`
- Size: `8px`
- Weight: `400`
- Color: `#d4d2ce`
- Transform: `lowercase`
- Line height: `1.35`

#### Background Texture (Elegant Dark)
**Both files:**
- Background image: `url('/textures/dark-paper.png')`
- Background color: `#0b0d11`
- Vignette overlay: Radial gradients with soft-light blend mode

#### Image Fallbacks
**Both files:**
- Circular: `75px × 75px` with gold border
- Rectangle: `100% × 150px`
- Icon size: `1.5rem` (circle) or `2.5rem` (rectangle)
- Border: `2px solid ${accentColor}` (circle) or `2px solid ${accentColor}20` (rectangle)

### Vertical Alignment Strategy

To ensure menu items align properly in a grid row:

1. **Fixed Heights for Components:**
   - Image area: `75px` (circle) or `150px` (rectangle)
   - Item name: `28px`
   - Price: `16px`
   - Description: Variable (auto)

2. **Flexbox Alignment:**
   - Use `display: flex` with `flex-direction: column`
   - Use `align-items: center` for circular layout
   - Use `flex-shrink: 0` on fixed-height elements

3. **CSS Grid Alignment:**
   - Items in same row share grid row number
   - Use `align-items: start` on grid container
   - Each item stretches to fill its grid cell

## Long-term Solution (Recommended)

### Option 1: Shared Style Generator Function

Create a single source of truth for styles:

```typescript
// src/lib/templates/style-generator.ts
export function generateTemplateStyles(
  template: MenuTemplate,
  palette: TemplateColorPalette,
  format: 'inline' | 'css'
) {
  const styles = {
    circularImage: {
      width: '75px',
      height: '75px',
      borderRadius: '50%',
      border: `2px solid ${palette.accent}`,
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
    },
    itemName: {
      fontFamily: "'Nanum Myeongjo', 'Habibi', 'Times New Roman', serif",
      fontSize: '10px',
      fontWeight: 400,
      color: '#f8f5f0',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      height: '28px'
    },
    // ... more styles
  }
  
  if (format === 'inline') {
    return styles // Return as React CSSProperties
  } else {
    return convertToCSS(styles) // Convert to CSS string
  }
}
```

### Option 2: CSS-in-JS Library

Use a library like `styled-components` or `emotion` that works both client and server-side:

```typescript
import { css } from '@emotion/css'

const circularImageStyle = css`
  width: 75px;
  height: 75px;
  border-radius: 50%;
  border: 2px solid ${palette.accent};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
`
```

### Option 3: Tailwind CSS for Both

Use Tailwind classes everywhere and ensure they're available in PDF export:

```tsx
// Both files use same classes
<img className="w-[75px] h-[75px] rounded-full border-2 border-gold shadow-md" />
```

Requires configuring Puppeteer to include Tailwind CSS.

### Option 4: Template Definition as Single Source

Move all styling to template definitions:

```typescript
// template-definitions.ts
export const ELEGANT_DARK_TEMPLATE = {
  id: 'elegant-dark',
  style: {
    itemCard: {
      imageSize: { width: 75, height: 75 },
      imageBorder: { width: 2, color: '#c8a562' },
      imageShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
      // ... all other styles
    }
  }
}
```

Then both renderers read from this definition.

## Testing Checklist

After making style changes, test:

### Visual Comparison
- [ ] Open `/ux/menus/[menuId]/template` in browser
- [ ] Take screenshot of preview
- [ ] Export PDF from `/ux/menus/[menuId]/export`
- [ ] Open PDF and compare with screenshot
- [ ] Verify all styles match exactly

### Specific Elements
- [ ] Circular images are same size in preview and PDF
- [ ] Image fallbacks match real image sizes
- [ ] Item names align vertically across row
- [ ] Prices align vertically across row
- [ ] Descriptions start at same height
- [ ] Background texture appears in both
- [ ] Colors match (especially gold accent)
- [ ] Fonts load correctly in PDF

### Multiple Templates
- [ ] Test with Elegant Dark (circular images)
- [ ] Test with Classic Italian (text-only)
- [ ] Test with Modern Minimal (top images)
- [ ] Test with Simple Rows (left images)

## Automated Testing (Future)

### Visual Regression Tests
```typescript
// tests/visual-regression/template-consistency.test.ts
test('PDF export matches preview', async () => {
  const preview = await capturePreview(menuId, templateId)
  const pdf = await capturePDF(menuId, templateId)
  
  const diff = await compareImages(preview, pdf)
  expect(diff.percentage).toBeLessThan(5) // Allow 5% difference
})
```

### Style Validation Tests
```typescript
test('styles are consistent', () => {
  const previewStyles = extractStylesFromComponent(TemplateLayoutRenderer)
  const exportStyles = extractStylesFromCSS(getTemplateCSS())
  
  expect(previewStyles.circularImage.width).toBe(exportStyles.circularImage.width)
  expect(previewStyles.itemName.fontSize).toBe(exportStyles.itemName.fontSize)
  // ... more assertions
})
```

## Quick Reference

### Files to Update
1. `src/components/templates/TemplateLayoutRenderer.tsx` - Client preview
2. `src/lib/templates/export/layout-renderer.tsx` - Server export
3. `src/app/globals.css` - Global template styles (if applicable)

### Key Style Values
- Circular image: `75px × 75px`
- Item name: `10px`, uppercase, Nanum Myeongjo
- Price: `12px`, gold (#c8a562)
- Description: `8px`, lowercase
- Background: `/textures/dark-paper.png`

### Common Mistakes
- ❌ Updating only one renderer
- ❌ Using different units (px vs rem)
- ❌ Forgetting `!important` in CSS
- ❌ Not testing with items without images
- ❌ Not checking vertical alignment
- ❌ Missing background texture in export

### Quick Fix Command
```bash
# Compare the two files to spot differences
code --diff src/components/templates/TemplateLayoutRenderer.tsx src/lib/templates/export/layout-renderer.tsx
```

## Image Export Considerations

### Current Status
Image export uses the same rendering pipeline as PDF export, so the same styling applies.

### Recommendation: Consider Removal
**Pros of keeping:**
- Provides PNG/JPG format for social media
- Some users may prefer image format

**Cons of keeping:**
- Adds maintenance burden (3 formats to keep in sync: preview, PDF, image)
- Limited use case (PDF covers most needs)
- Image quality/resolution concerns
- File size considerations

**Recommendation:** Consider removing image export and focusing on:
1. **PDF export** - Primary format, professional, printable
2. **HTML export** - For web embedding
3. **Preview** - For in-app viewing

This reduces maintenance to 2 rendering systems instead of 3.

### If Keeping Image Export
Add to synchronization checklist:
- [ ] Test image export matches preview
- [ ] Verify image resolution is appropriate
- [ ] Check file size is reasonable
- [ ] Ensure background texture renders correctly

## Background Texture Limitations

### Issue with PDF Export
Puppeteer (used for PDF generation) cannot access local file system paths like `/textures/dark-paper.png`. 

### Solutions Implemented

**Current Solution: CSS-Generated Texture**
Using CSS gradients and patterns to simulate the paper texture:
```css
background-image: 
  repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
  repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
  radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.03) 0%, transparent 50%);
```

**Pros:**
- Works in PDF export
- No external dependencies
- Lightweight

**Cons:**
- Doesn't match preview exactly
- Less realistic texture

### Alternative Solutions

**Option 1: Base64 Embed**
Convert texture image to base64 and embed in CSS:
```typescript
const textureBase64 = fs.readFileSync('public/textures/dark-paper.png', 'base64')
const css = `background-image: url('data:image/png;base64,${textureBase64}');`
```

**Pros:**
- Exact match with preview
- Self-contained

**Cons:**
- Increases CSS size significantly
- Slower PDF generation

**Option 2: HTTP URL**
Serve texture through HTTP endpoint:
```css
background-image: url('http://localhost:3000/textures/dark-paper.png');
```

**Pros:**
- Exact match with preview
- Puppeteer can fetch it

**Cons:**
- Requires server to be running
- Network dependency
- Won't work in production without absolute URL

**Option 3: Simplified Texture**
Use a simpler, CSS-only texture that looks similar:
```css
background: 
  radial-gradient(circle at 20% 30%, rgba(255,255,255,0.03), transparent),
  radial-gradient(circle at 80% 70%, rgba(0,0,0,0.05), transparent),
  #0b0d11;
```

**Recommended:** Implement Option 1 (Base64 embed) for production-quality exports.

## Layout Structure for Elegant Dark

### Component Stacking
Each menu item should have components stacked vertically:

```
┌─────────────────┐
│   [Image 75px]  │ ← Fixed height, centered
├─────────────────┤
│   ITEM NAME     │ ← Fixed height 28px, centered
├─────────────────┤
│    $12.00       │ ← Fixed height 16px, centered
├─────────────────┤
│  description    │ ← Variable height, centered
└─────────────────┘
```

### CSS Structure
```css
.menu-item-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.item-name {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-price {
  height: 16px;
  display: block;
}
```

### Common Mistake
❌ **Wrong:** Price on same line as name
```html
<div style="display: flex; justify-content: space-between;">
  <h3>Item Name</h3>
  <span>$12.00</span>
</div>
```

✓ **Correct:** Each component on its own line
```html
<h3>Item Name</h3>
<span>$12.00</span>
<p>description</p>
```

## UX Page CTA Panel Style

### Translucent Primary Blue Panel
Use this style for prominent call-to-action panels on marketing/UX pages (e.g. support, export).
**Do NOT** use glassy/blur (`bg-white/10 backdrop-blur-md`) for CTA panels — prefer the translucent primary gradient for stronger brand presence and better readability.

**Important:** Use a plain `<div>`, NOT `<UXCard>`. The `.card-ux` class applies `background-color: rgba(255,255,255,0.7)` and `backdrop-filter: blur(1.5px)` which wash out the gradient.

**Pattern:**
```tsx
<div className="text-center bg-gradient-to-br from-ux-primary/30 to-ux-primary/40 rounded-md p-8 border border-ux-primary/40 shadow-xl text-white">
  <h3 className="text-xl font-bold text-white text-hero-shadow mb-2">Headline</h3>
  <p className="text-white/90 text-hero-shadow-strong mb-6 max-w-lg mx-auto">
    Supporting text
  </p>
  <UXButton variant="primary" size="lg" className="px-8 shadow-lg">
    Call to Action
  </UXButton>
</div>
```

**Key classes:**
- Container: plain `<div>` (not `UXCard`) with `rounded-md p-8`
- Background: `bg-gradient-to-br from-ux-primary/30 to-ux-primary/40`
- Border: `border border-ux-primary/40`
- Heading: `text-white text-hero-shadow`
- Body text: `text-white/90 text-hero-shadow-strong`

**Pages using this pattern:**
- `/support` — "Ready to Get Started?" CTA
- `/menus/[menuId]/export` — "Want to unlock more features?" conversion panel

## Related Documentation
- [Template Styling Sync Summary](./TEMPLATE_STYLING_SYNC_SUMMARY.md)
- [PDF Export Fix Summary](./PDF_EXPORT_FIX_SUMMARY.md)
- Template Engine: `src/lib/templates/README.md
