# Vercel PDF Export SSL/TLS Fix Summary

## Problem

PDF exports on Vercel were failing because images from Supabase storage couldn't be fetched due to SSL/TLS handshake failures:

```
Error: write EPROTO 80E8E5D8897F0000:error:0A000410:SSL routines:ssl3_read_bytes:ssl/tls alert handshake failure:ssl/record/rec_layer_s3.c:912:SSL alert number 40
```

This resulted in PDFs showing placeholder icons instead of actual menu item images, even though the images were visible in the preview.

## Root Cause

The issue was caused by Node.js's `https` module having SSL/TLS compatibility issues in Vercel's serverless environment when connecting to Supabase's storage endpoints. This is a common problem in serverless environments where the SSL/TLS stack differs from local development.

## Solution Applied

### 1. Replaced `https` module with `fetch()` API

**File Changed:** `src/lib/templates/export/texture-utils.ts`

**Before:** Used Node.js `https.request()` with manual SSL configuration
**After:** Used modern `fetch()` API which handles SSL/TLS better in serverless environments

**Key Changes:**
- Replaced `https.request()` with `fetch()`
- Added proper timeout handling with `AbortController`
- Improved error handling for SSL-specific errors
- Added retry logic with exponential backoff for SSL failures

### 2. Added Retry Mechanism

Added automatic retry with exponential backoff for SSL/TLS errors:
- Max 2 retries (3 total attempts)
- Delays: 1s, 2s between retries
- Only retries on SSL/TLS specific errors (EPROTO, SSL, TLS, handshake)

### 3. Reduced Concurrency and Timeouts

**File Changed:** `src/app/api/templates/export/pdf/route.ts`

- Reduced image conversion concurrency from 3 to 2
- Reduced timeout from 15s to 8s to fail faster on SSL issues
- This prevents overwhelming the SSL connection pool

### 4. Enhanced Error Handling

Added specific detection and logging for SSL/TLS errors:
- Detects EPROTO, SSL, TLS, and handshake failure messages
- Provides clear logging for debugging
- Gracefully falls back to placeholder icons when images fail

## Technical Details

### Why `fetch()` Works Better

1. **Modern SSL/TLS Stack**: `fetch()` uses a more modern SSL/TLS implementation
2. **Better Cipher Support**: Automatically negotiates the best available ciphers
3. **Serverless Optimized**: Designed to work well in serverless environments
4. **Simpler Configuration**: No need for manual SSL options

### Fallback Behavior

When images fail to load:
1. **Menu Items**: Show placeholder food icons (already implemented)
2. **Textures**: Fall back to CSS-generated patterns (already implemented)
3. **Logos**: Show placeholder or no logo

This ensures PDFs are always generated successfully, even if some images fail.

## Testing

### Local Testing

Run the test script to verify SSL connectivity:

```bash
node test-ssl-fix.js
```

This will test both the old `https` module approach and the new `fetch()` approach.

### Production Testing

1. Deploy the changes to Vercel
2. Try exporting a PDF with images
3. Check the logs for:
   - ✅ Successful image fetches
   - ✅ Retry attempts (if any)
   - ✅ Graceful fallbacks for failed images
   - ✅ PDF generation completion

### Expected Log Output (Success)

```
[TextureUtils] Fetching image: https://uztyljbiqyrykzwtdbpa.supabase.co/storage/...
[TextureUtils] Successfully fetched image: ... (123456 bytes)
[TextureUtils] Compressed image: ... (123456 -> 45678 bytes, 63.0% reduction)
[TextureUtils] Converted image to base64: ... (45678 bytes, image/jpeg)
[TextureUtils] Image conversion complete: 20 succeeded, 0 failed
```

### Expected Log Output (With Retries)

```
[TextureUtils] SSL/TLS error fetching image ... (attempt 1): EPROTO
[TextureUtils] Retrying in 1000ms...
[TextureUtils] Retrying image fetch (attempt 2): ...
[TextureUtils] Successfully fetched image: ... (123456 bytes)
```

## Environment Variables

You can control image conversion behavior:

- `PDF_ENABLE_IMAGES=false` - Completely disable image conversion (fastest)
- `PDF_ENABLE_IMAGES=true` - Enable image conversion (default)

## Performance Impact

- **Positive**: Faster SSL handshakes with `fetch()`
- **Positive**: Reduced timeouts mean faster failure detection
- **Neutral**: Retry mechanism adds ~3s max delay for failed images
- **Positive**: Lower concurrency reduces server load

## Rollback Plan

If issues occur, you can quickly disable image conversion:

1. Set environment variable: `PDF_ENABLE_IMAGES=false`
2. Or revert the texture-utils.ts file to use the old `https` module approach

## Related Files

- `src/lib/templates/export/texture-utils.ts` - Main SSL fix
- `src/app/api/templates/export/pdf/route.ts` - Timeout and concurrency adjustments
- `test-ssl-fix.js` - Testing script

## Future Improvements

1. **Connection Pooling**: Implement HTTP/2 connection reuse
2. **CDN Caching**: Cache converted images to avoid repeated fetches
3. **Progressive Loading**: Load images in batches based on priority
4. **Health Checks**: Monitor SSL connectivity and auto-adjust settings

## Monitoring

Watch for these metrics in production:
- Image conversion success rate
- SSL retry frequency
- PDF generation time
- Error patterns in logs

The fix should significantly improve the reliability of PDF exports on Vercel while maintaining good performance and user experience.