# Vercel PDF Export Timeout Fix

## Problem

PDF exports were failing on Vercel with a timeout error after ~22 seconds:

```
[TextureUtils] File not found at /var/task/public/textures/dark-paper.png
[TextureUtils] Fetching local image via HTTP: https://one-minute-menu.vercel.app/textures/dark-paper.png
Error exporting PDF: TargetCloseError: Protocol error (Runtime.callFunctionOn): Target closed
```

## Root Cause

The issue had multiple contributing factors:

1. **Missing Headers**: The PDF/image/HTML export routes were only passing `cookie` and `authorization` headers to the texture utilities, but not `host`, `x-forwarded-host`, and `x-forwarded-proto` headers.

2. **URL Construction Failure**: Without these headers, the texture utilities couldn't construct the correct base URL to fetch textures via HTTP, falling back to environment variables that might not be set correctly.

3. **Long Timeout**: The HTTP fallback was using a 3-second timeout, but the actual timeout was much longer (~22 seconds), causing Puppeteer to close the connection.

4. **Vercel Filesystem**: On Vercel's serverless functions, the `public` folder is served statically but not copied into the function's filesystem. Files must be accessed via HTTP.

## Solution

### 1. Pass Required Headers (All Export Routes)

Updated all three export routes to pass the necessary headers:

**Files Changed:**
- `src/app/api/templates/export/pdf/route.ts`
- `src/app/api/templates/export/image/route.ts`
- `src/app/api/templates/export/html/route.ts`

```typescript
const headers = {
  cookie: request.headers.get('cookie') || '',
  authorization: request.headers.get('authorization') || '',
  host: request.headers.get('host') || '',
  'x-forwarded-host': request.headers.get('x-forwarded-host') || '',
  'x-forwarded-proto': request.headers.get('x-forwarded-proto') || ''
}
```

### 2. Reduce Texture Timeout

**File Changed:** `src/lib/templates/export/texture-utils.ts`

- Added a `timeoutMs` parameter to `fetchImageAsDataURL()` (default: 5000ms)
- Reduced texture-specific timeout to 1000ms (1 second) in `getTextureDataURL()`
- This ensures textures fail fast and fall back to CSS-generated patterns

```typescript
export async function getTextureDataURL(textureName: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    // Use a very short timeout for textures - they should be fast or fail to CSS fallback
    return await fetchImageAsDataURL(`/textures/${textureName}`, headers, 1000)
  } catch (error) {
    console.error(`[TextureUtils] Error loading texture ${textureName}:`, error)
    return null
  }
}
```

### 3. Add URL Validation

Added a check to skip HTTP fallback if a valid URL cannot be constructed:

```typescript
// Skip HTTP fallback for textures if we can't construct a valid URL
// This prevents circular dependencies and timeouts in serverless environments
if (!baseUrl || baseUrl === 'http://localhost:3000') {
  console.warn(`[TextureUtils] Cannot construct valid URL for ${imageUrl}, skipping HTTP fallback`)
  return null
}
```

## Fallback Behavior

The `getElegantDarkBackground()` function already has a CSS fallback that generates a texture using CSS gradients:

```typescript
// Fallback to CSS-generated texture if image not available
return `
  background-color: #0b0d11;
  background-image: 
    repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
    repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 4px),
    radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(0,0,0,0.03) 0%, transparent 50%);
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%;
`
```

This ensures PDFs still look good even if the texture image fails to load.

## Testing

To test the fix:

1. Deploy to Vercel
2. Try exporting a PDF with the "Elegant Dark" template
3. Check logs to verify:
   - Headers are being passed correctly
   - Texture loads quickly or fails fast (< 1 second)
   - CSS fallback is used if texture fails
   - PDF generation completes successfully

## Alternative Solutions Considered

1. **Embed texture as base64 in code**: Would increase bundle size
2. **Copy public files to function**: Not supported by Vercel's default Next.js build
3. **Use Vercel's static file serving**: Already in use, but requires HTTP access
4. **Disable textures entirely**: Would reduce visual quality

The chosen solution balances performance, reliability, and visual quality.
