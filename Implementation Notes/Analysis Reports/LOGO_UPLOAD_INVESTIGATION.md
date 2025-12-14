# Logo Upload Feature Investigation

## Summary
I've investigated the logo upload functionality that was implemented with Cursor. The implementation appears **complete and well-structured**, following the original plan closely. Here's what I found:

## ✅ Implementation Status

### 1. Data Model Extensions ✓
**Location:** `src/types/index.ts`, `src/lib/templates/engine-types.ts`, `src/lib/templates/menu-transformer.ts`

- ✅ `Menu` type has `logoUrl?: string` field
- ✅ `EngineMenu.metadata` includes `logoUrl?: string`
- ✅ `menu-transformer.ts` correctly populates `logoUrl` from `menu.logoUrl`
- ✅ Database operations support `logo_url` column (mapped via `transformMenuFromDB`)

### 2. Backend API Endpoint ✓
**Location:** `src/app/api/menus/[menuId]/logo/route.ts`

- ✅ POST endpoint for logo upload
- ✅ DELETE endpoint for logo removal
- ✅ Server-side validation (JPEG/PNG only, 8MB max)
- ✅ Plan limit enforcement (monthly upload quota)
- ✅ Uses `imageOperations.uploadMenuImage()` for storage
- ✅ Updates menu via `imageOperations.updateMenuLogo()`
- ✅ Logs uploads for quota tracking

### 3. Frontend UI ✓
**Location:** `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

- ✅ State management: `logoUrl`, `showLogoUpload`, `uploadingLogo`, `logoUploadError`
- ✅ "Upload logo" button in control panel (line ~781)
- ✅ Button only shown for authenticated menus (not demo menus)
- ✅ Circular logo preview displayed when `logoUrl` exists
- ✅ Modal with `ImageUpload` component (line ~1080-1140)
- ✅ `handleLogoImageSelected` function (line ~345-395)
- ✅ Error handling and toast notifications
- ✅ Proper loading states

### 4. Template Support ✓
**Location:** `src/lib/templates/template-definitions.ts`

All three MVP templates have logo support enabled:
- ✅ `CLASSIC_GRID_CARDS` (Elegant Dark)
- ✅ `TWO_COLUMN_TEXT` (Classic Italian)  
- ✅ `SIMPLE_ROWS`

Each template has:
- ✅ `capabilities.supportsLogoPlaceholder: true`
- ✅ `configurationSchema.allowLogoUpload: true`
- ✅ LOGO tile in layout (e.g., `{ id: 'logo-1', type: 'LOGO', col: 0, row: 0, ... }`)

### 5. Layout Engine ✓
**Location:** `src/lib/templates/layout-engine.ts`

- ✅ `fillStaticTiles` function handles LOGO tiles (line ~598-603)
- ✅ Populates `logoUrl` from `menu.metadata.logoUrl`
- ✅ Uses venue/menu name as fallback text for alt text
- ✅ Emits LOGO tile even when `logoUrl` is absent (placeholder behavior)

### 6. Renderer ✓
**Location:** `src/lib/templates/export/layout-renderer.tsx`

- ✅ `StaticTile` component renders LOGO tiles (line ~83-100)
- ✅ Displays `<img>` when `tile.logoUrl` exists
- ✅ Falls back to text placeholder when no logo
- ✅ Proper styling with `.logo-placeholder` class

### 7. Tests ✓
**Location:** `src/__tests__/unit/ux-extracted-client.test.tsx`

- ✅ Test verifies "Upload logo" button appears
- ✅ Test verifies modal opens on click
- ✅ Test checks for upload instructions text

## 🔍 How to Test

### Prerequisites
1. **Use a real menu** (not a demo menu)
   - URL should be: `http://localhost:3000/ux/menus/<uuid>/extracted`
   - NOT: `http://localhost:3000/ux/menus/demo-*/extracted`
2. **Be signed in** (authenticated user)
3. **Have the control panel expanded**

### Testing Steps

#### 1. Access the Feature
```
1. Navigate to /ux/menus/<your-menu-id>/extracted
2. Scroll to "Menu control panel" card
3. If collapsed, click the chevron to expand
4. Look for "Upload logo" button below other buttons
```

#### 2. Upload a Logo
```
1. Click "Upload logo" button
2. Modal should open with title "Upload logo"
3. Drag/drop or select a JPEG/PNG file (max 8MB)
4. Click confirm in ImageUpload component
5. Wait for upload to complete
6. Modal should close
7. Circular logo preview should appear next to button
```

#### 3. Verify Logo in Templates
```
1. Navigate to template selection page
2. Select a template (Classic Grid Cards, Two Column Text, or Simple Rows)
3. Preview should show your logo in the LOGO tile area
4. Export to PDF/HTML and verify logo appears
```

#### 4. Test Error Cases
```
- Try uploading a file > 8MB → Should show error
- Try uploading a non-JPEG/PNG → Should show error
- If at monthly limit → Should show plan limit error
```

#### 5. Remove Logo
```
- Currently DELETE endpoint exists but UI button not visible
- Can test via API: DELETE /api/menus/<menuId>/logo
```

## 🐛 Potential Issues to Check

### 1. Database Schema
**Check if `logo_url` column exists in `menus` table:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menus' AND column_name = 'logo_url';
```

If missing, add it:
```sql
ALTER TABLE menus ADD COLUMN logo_url TEXT;
```

### 2. Storage Bucket
The logo upload uses the same storage bucket as menu images. Verify:
- Bucket exists and is accessible
- RLS policies allow authenticated users to upload
- Public access is configured for reading

### 3. Demo Menu Behavior
The logo button is intentionally hidden for demo menus (line ~774):
```tsx
{!isDemo && (
  <div className="mt-3 flex flex-wrap items-center gap-3">
    <UXButton onClick={() => setShowLogoUpload(true)}>
      Upload logo
    </UXButton>
```

This is correct per the plan.

### 4. Logo Display in Templates
If logo doesn't appear in templates:
1. Check browser console for image loading errors
2. Verify `logoUrl` is a valid, accessible URL
3. Check CSS for `.logo-placeholder` class
4. Verify template has `supportsLogoPlaceholder: true`

## 📝 Implementation Quality

### Strengths
- ✅ Follows the plan closely
- ✅ Proper separation of concerns (API, UI, engine, renderer)
- ✅ Good error handling and user feedback
- ✅ Security validations (file type, size, auth)
- ✅ Plan limit enforcement
- ✅ Backward compatible (missing logoUrl handled gracefully)
- ✅ Tests included

### Minor Observations
1. **No UI for logo removal** - DELETE endpoint exists but no button in UI
2. **Logo size/aspect ratio** - No validation for optimal logo dimensions
3. **Logo positioning** - Currently fixed in templates, no user control
4. **Configuration usage** - `useLogo` config option exists but not fully wired

## 🧪 Quick Test Script

Run this in your browser console on the extracted page:
```javascript
// Check if logo state exists
console.log('Logo URL:', document.querySelector('img[alt*="logo"]')?.src)

// Check if upload button exists
console.log('Upload button:', document.querySelector('button:contains("Upload logo")'))

// Check menu data
fetch(`/api/menus/${window.location.pathname.split('/')[3]}`)
  .then(r => r.json())
  .then(d => console.log('Menu logoUrl:', d.data?.logoUrl))
```

## 🎯 Next Steps

1. **Test the feature** following the steps above
2. **Check database schema** for `logo_url` column
3. **Verify storage bucket** configuration
4. **Test with different logo sizes** and formats
5. **Consider adding**:
   - Logo removal button in UI
   - Logo dimension recommendations
   - Logo preview in template selection
   - Crop/resize tool for logos

## Questions to Answer

1. Does the "Upload logo" button appear on your real menu?
2. Does the modal open when you click it?
3. Can you successfully upload a logo?
4. Does the logo appear in the circular preview?
5. Does the logo show in template previews/exports?
6. Are there any console errors?

Let me know what you find and I can help debug any issues!
