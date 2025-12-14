# Logo Upload UI Fixes - Summary

## Changes Made

### 1. Button Layout Reorganization ✅
**File:** `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

**Before:**
- 3 buttons in a flex row (Upload menu image, Batch Create Photos, Add QR)
- "Upload logo" button wrapped below in a separate row (blue/primary variant, smaller size)
- Logo preview shown next to the upload logo button

**After:**
- 4 buttons in a responsive grid layout (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`)
- All buttons are the same size (`size="md"`) and style (`variant="warning"` - yellow/gold)
- Button order: Upload a menu image, Upload logo, Batch Create Photos, Add QR / manage items
- Logo preview moved below the button grid
- Upload logo button only shown for authenticated menus (not demo menus)

### 2. Icon Consistency ✅
**File:** `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

**Change:**
- Added `<ImageUp>` icon to "Upload logo" button (same as "Upload a menu image")
- Both buttons now have the same visual treatment

### 3. Modal Viewport Positioning ✅
**File:** `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

**Before:**
```tsx
<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
  <div className="w-full max-w-md mx-4">
```

**After:**
```tsx
<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
  <div className="w-full max-w-md my-8">
```

**Changes:**
- Added `p-4` padding to the overlay container
- Added `overflow-y-auto` to allow scrolling when content is taller than viewport
- Changed `mx-4` to `my-8` on inner container for vertical spacing
- Modal now stays in viewport and scrolls properly (matches BatchAIImageGeneration pattern)

### 4. Remove Card Border from ImageUpload ✅
**Files:** 
- `src/components/ImageUpload.tsx`
- `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

**Changes to ImageUpload.tsx:**
- Added new prop: `noWrapper?: boolean`
- When `noWrapper={true}`, the component renders without the Card wrapper
- Content is rendered directly without the border/shadow/padding from Card
- Maintains all functionality (camera, drag-drop, preview, etc.)

**Changes to extracted-client.tsx:**
- Pass `noWrapper={true}` to ImageUpload component in logo modal
- Removed unnecessary className overrides (no longer needed)

**Result:**
- Upload area now spans full width of modal
- No thin white border around the upload mechanism
- "Choose file or drag and drop" section is wider and more spacious

## Visual Changes Summary

### Button Grid (Desktop)
```
┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│ 📤 Upload a menu    │ 📤 Upload logo      │ ✨ Batch Create     │ 🔲 Add QR / manage │
│    image            │                     │    Photos           │    items            │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

### Button Grid (Mobile)
```
┌─────────────────────────────────┐
│ 📤 Upload a menu image          │
├─────────────────────────────────┤
│ 📤 Upload logo                  │
├─────────────────────────────────┤
│ ✨ Batch Create Photos          │
├─────────────────────────────────┤
│ 🔲 Add QR / manage items        │
└─────────────────────────────────┘
```

### Modal Layout
```
┌─────────────────────────────────────────┐
│  Upload logo                         ✕  │
├─────────────────────────────────────────┤
│  Upload a small JPEG or PNG logo...     │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │        📷 Take Photo               │ │
│  └────────────────────────────────────┘ │
│                                          │
│                    or                    │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │            🖼️                      │ │
│  │                                    │ │
│  │   [Choose file] or drag and drop  │ │  ← Now full width!
│  │                                    │ │
│  │      PNG, JPG up to 8MB           │ │
│  └────────────────────────────────────┘ │
│                                          │
│           [Cancel]                       │
└─────────────────────────────────────────┘
```

## Testing Checklist

- [x] Dev server starts without errors
- [x] No TypeScript diagnostics
- [ ] Button layout displays correctly on desktop (4 columns)
- [ ] Button layout displays correctly on mobile (stacked)
- [ ] All buttons are the same yellow/gold color
- [ ] Upload logo button has ImageUp icon
- [ ] Modal appears in viewport when clicked
- [ ] Modal scrolls properly on small screens
- [ ] Upload area is full width without border
- [ ] Logo preview appears below buttons (not next to button)
- [ ] Upload logo button hidden for demo menus

## Files Modified

1. `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`
   - Reorganized button grid layout
   - Added icon to Upload logo button
   - Fixed modal positioning
   - Added noWrapper prop to ImageUpload

2. `src/components/ImageUpload.tsx`
   - Added noWrapper prop
   - Conditionally render without Card wrapper
   - Maintains backward compatibility (default: wrapped)

## Next Steps

1. Test the changes in the browser at `http://localhost:3001`
2. Navigate to a real menu's extracted page
3. Verify button layout and styling
4. Test logo upload modal positioning
5. Verify upload area is full width

## Rollback Instructions

If needed, revert these commits:
```bash
git log --oneline -5
git revert <commit-hash>
```

Or restore from this investigation:
- See `LOGO_UPLOAD_INVESTIGATION.md` for original implementation details
