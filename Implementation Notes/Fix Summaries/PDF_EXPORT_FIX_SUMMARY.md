# PDF Export Blank Page Fix

## Problem
When exporting PDFs from the export page (`/ux/menus/[menu-id]/export`), the downloaded PDF appears as a blank white page.

## Root Causes Identified

### 1. Font Loading Timing
The PDF was being generated before Google Fonts finished loading, resulting in missing text rendering.

### 2. CSS Application
The styles were being embedded in the `<head>` but Puppeteer wasn't waiting for them to be fully applied before generating the PDF.

### 3. Missing Color Definitions
Some CSS rules didn't explicitly define text colors, potentially causing white-on-white rendering issues.

## Fixes Applied

### 1. Synchronized Styling Between Preview and Export (`src/lib/templates/export/layout-renderer.tsx`)

**Problem:** The template preview page showed updated styling (smaller circular images, uppercase names, specific fonts) but the PDF export used old styling, causing a mismatch.

**Solution:** Updated the CSS in `layout-renderer.tsx` to match the inline styles from `TemplateLayoutRenderer.tsx`:

**Key Style Updates:**
- **Circular Images:** Reduced from default size to 75px × 75px with gold border
- **Item Names:** Changed to uppercase, 10px font size, using 'Nanum Myeongjo' font
- **Prices:** 12px font size in gold color (#c8a562)
- **Descriptions:** 8px font size, lowercase, light gray color
- **Title:** 36px Playfair Display font, uppercase, gold color
- **Section Headers:** 36px font size with subtle bottom border

All styles now use `!important` to ensure they override any default styles.

### 2. Enhanced PDF Generation Wait Strategy (`src/lib/templates/export/pdf-exporter.ts`)

**Before:**
```typescript
await page.setContent(htmlContent, {
  waitUntil: 'domcontentloaded',
  timeout: 60000
})
```

**After:**
```typescript
await page.setContent(htmlContent, {
  waitUntil: ['domcontentloaded', 'networkidle0'],
  timeout: 60000
})

// Give additional time for fonts to load and render
await page.evaluateHandle('document.fonts.ready')
```

**Why:** This ensures:
- All network requests (including font files) complete before PDF generation
- The browser's font loading API confirms fonts are ready
- CSS is fully applied to the DOM

### 3. Fixed Component Styling (`src/lib/templates/export/layout-renderer.tsx`)

**Problem:** The `MenuItemTile` component was using Tailwind CSS classes that weren't available in the PDF export context.

**Solution:** Replaced Tailwind classes with semantic class names that are defined in the CSS:
- Changed `className="w-full h-48 object-cover rounded-t-lg"` to `className="item-image"`
- Changed `className="text-lg font-medium text-gray-900"` to `className="item-name"`
- Changed inline Tailwind classes to semantic classes with proper CSS definitions

### 4. Added Debug Logging (`src/app/api/templates/export/pdf/route.ts`)

Added logging to help diagnose issues:
```typescript
logger.info('[PDFExporter] HTML preview:', htmlDocument.substring(0, 500))
```

This allows you to verify the HTML structure being sent to Puppeteer.

## Testing Instructions

### 1. Test with a Real Menu

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to a menu export page:
   ```
   http://localhost:3000/ux/menus/[your-menu-id]/export
   ```

3. Click "Export" on the PDF option

4. Open the downloaded PDF and verify:
   - ✓ Content is visible (not blank)
   - ✓ Text is readable
   - ✓ Colors are applied correctly
   - ✓ Fonts are loaded properly
   - ✓ Layout matches the preview

### 2. Test with Demo Menu

1. Go to the demo flow:
   ```
   http://localhost:3000/ux/demo/sample
   ```

2. Complete the demo flow to the export page

3. Try exporting PDF (note: demo users may see upgrade prompt for PDF)

### 3. Check Server Logs

When a PDF is generated, you should see in the logs:
```
[PDFExporter] HTML preview: <!DOCTYPE html>...
[PDFExporter] Generated PDF in XXXms (XXXXX bytes)
```

### 4. Test Different Templates

Test PDF export with different templates:
- Classic Grid
- Elegant Dark
- Modern Minimal
- Text Only

Each should render correctly with appropriate colors and fonts.

## What to Look For

### ✓ Success Indicators
- PDF opens and displays content
- Text is visible and readable
- Colors match the template preview
- Fonts are properly loaded
- Images appear (if template includes them)
- Layout is properly structured

### ✗ Failure Indicators
- Blank white pages
- Missing text
- Wrong colors (white on white)
- Missing fonts (fallback to system fonts)
- Broken layout

## Rollback Plan

If these changes cause issues, you can revert:

```bash
git diff src/lib/templates/export/pdf-exporter.ts
git diff src/lib/templates/export/layout-renderer.tsx
git diff src/app/api/templates/export/pdf/route.ts
```

Then use `git checkout` to revert specific files if needed.

## Additional Notes

### Browser Compatibility
The fixes use standard web APIs:
- `document.fonts.ready` - Supported in all modern browsers and Puppeteer
- `networkidle0` - Puppeteer-specific wait strategy

### Performance Impact
- PDF generation may take slightly longer (100-500ms) due to waiting for fonts
- This is acceptable for better reliability
- The timeout is set to 60 seconds, which should be sufficient

### Future Improvements
Consider:
1. Caching font files locally to speed up generation
2. Pre-loading fonts in a warmup phase
3. Adding retry logic for failed PDF generations
4. Implementing progress indicators for users

## Related Files
- `src/lib/templates/export/pdf-exporter.ts` - PDF generation logic
- `src/lib/templates/export/layout-renderer.tsx` - HTML/CSS rendering
- `src/app/api/templates/export/pdf/route.ts` - API endpoint
- `src/app/ux/menus/[menuId]/export/export-client.tsx` - Frontend UI

## Questions or Issues?
If PDFs are still blank after these changes:
1. Check the server logs for the HTML preview
2. Verify Puppeteer is installed correctly
3. Test with the `test-pdf-export.js` script
4. Check if fonts are being blocked by firewall/proxy
