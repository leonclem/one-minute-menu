# Issues to Fix - Summary

## ✅ Fixed

### Issue #5: Upload Image Error (FIXED)
**Problem**: Module not found error when uploading images
**Solution**: Fixed import in `src/app/api/menu-items/[itemId]/image/route.ts` to use correct Supabase client
**Status**: ✅ Complete - You can now upload images

---

## 🔧 Remaining Issues

### Issue #1: Remove Photo Button Doesn't Work
**Problem**: Clicking "Remove photo" shows success toast but image doesn't get removed
**Location**: Menu item editor
**What happens**: Toast says "Image has been removed..." but the image stays
**Likely cause**: The DELETE handler in `/api/menu-items/[itemId]/image` doesn't update the menu_items table
**Fix needed**: Update the DELETE handler to also clear the `custom_image_url` field in the database

### Issue #2: Image Thumbnail Not Clickable
**Problem**: When an image is created, the thumbnail should be clickable to view full size
**Current behavior**: Thumbnail is displayed but not interactive
**Expected behavior**: Click thumbnail → Open modal/lightbox with full-size image
**Fix needed**: Add click handler to thumbnail that opens image in a modal or new tab

### Issue #3: Description Not Used in Image Generation
**Problem**: When creating an image, if there's a description, it should be included in the prompt
**Current behavior**: Only uses item name for image generation
**Expected behavior**: Use both name and description to create better prompts
**Fix needed**: Update prompt construction in `src/lib/prompt-construction.ts` to include description

### Issue #4: 404 Error When Generating Image for New Item
**Problem**: Adding a new item and immediately trying to create an image results in 404
**Error**: `POST /api/generate-image 404 in 28ms`
**Likely cause**: Menu item ID might not be properly saved/synced before image generation starts
**Fix needed**: Ensure menu item is fully saved before allowing image generation, or add better error handling

---

## Priority Order

1. **Issue #5** ✅ - FIXED
2. **Issue #4** - Critical (blocks functionality)
3. **Issue #1** - High (confusing UX)
4. **Issue #3** - Medium (improves quality)
5. **Issue #2** - Low (nice-to-have UX improvement)

---

## Next Steps

Would you like me to:
1. Fix Issue #4 (404 error for new items)?
2. Fix Issue #1 (remove photo not working)?
3. Fix Issue #3 (use description in prompts)?
4. Fix Issue #2 (clickable thumbnails)?
5. Fix all of them?

Let me know which you'd like to tackle first!
