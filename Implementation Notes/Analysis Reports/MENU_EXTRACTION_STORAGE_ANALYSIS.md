# Menu Extraction Storage Investigation

## Issue Description
Users report inconsistent behavior when clicking "Edit Menu" after completing menu extraction. Sometimes they're correctly routed to `/extracted`, but other times they're sent back to `/extract`, requiring them to re-extract the menu.

## Investigation Findings

### Current Implementation

#### 1. Storage Mechanism
- **Location**: `extractionMetadata` is stored in the `menu_data` JSONB column in the `menus` table
- **Persistence**: This is **permanent storage** (not session/cache-based)
- **Structure**:
```typescript
extractionMetadata: {
  schemaVersion: 'stage1' | 'stage2',
  promptVersion: string,
  confidence: number,
  extractedAt: Date,
  jobId?: string
}
```

#### 2. Routing Logic (MenuCard.tsx)
```typescript
const getEditUrl = () => {
  if (!menu.imageUrl) {
    return `/menus/${menu.id}/upload`
  }
  if ((menu.items?.length ?? 0) > 0 || (menu.categories?.length ?? 0) > 0 || menu.extractionMetadata) {
    return `/ux/menus/${menu.id}/extracted`
  }
  return `/ux/menus/${menu.id}/extract`
}
```

The logic checks three conditions (OR):
1. Menu has items
2. Menu has categories
3. Menu has extractionMetadata

#### 3. Data Flow
1. User uploads image → `imageUrl` is set
2. User extracts menu → API calls `/api/extraction/submit`
3. Extraction completes → Results applied via `/api/menus/[menuId]/apply-extraction`
4. `applyExtractionToMenu()` is called → Updates menu with:
   - `items` array
   - `categories` array (if Stage 2)
   - `extractionMetadata` object

### Root Cause Identified ✅

#### **Issue: SessionStorage Dependency in /extracted Page**

The `/extracted` page (`extracted-client.tsx`) was checking for a `jobId` in sessionStorage:

```typescript
const jobId = sessionStorage.getItem(`extractionJob:${menuId}`)
if (!jobId) {
  // Redirect back to /extract
  router.push(`/ux/menus/${menuId}/extract`)
  return
}
```

**Problem**: SessionStorage is cleared when:
- User opens a new browser tab/window
- User clears browser data
- User returns after closing the browser
- User's session expires

Even though the extraction data is **permanently stored in the database**, the `/extracted` page was requiring the sessionStorage jobId to be present, causing users to be redirected back to `/extract` even though their menu already had extracted items.

#### Secondary Issue: Weak Routing Condition
The routing condition in MenuCard was checking for `menu.extractionMetadata` as a truthy value, which could potentially pass for empty objects `{}` (though this wasn't the primary issue).

## Implemented Solutions ✅

### Solution 1: Load Menu Data from Database (Primary Fix)
Modified `/extracted` page to check the database for existing menu data before requiring sessionStorage:

```typescript
// In extracted-client.tsx
// First, try to load the menu from the database
const loadMenuFromDatabase = async () => {
  const menuResp = await fetch(`/api/menus/${menuId}`)
  const menuJson = await menuResp.json()
  const loadedMenu = menuJson.data as Menu
  
  // Check if menu has extracted data
  if ((loadedMenu.items && loadedMenu.items.length > 0) || loadedMenu.extractionMetadata) {
    // Menu already has extracted data, use it directly
    setAuthMenu(loadedMenu)
    setThumbnailUrl(loadedMenu.imageUrl ?? null)
    return true
  }
  return false
}

// Try loading from database first
const hasExistingData = await loadMenuFromDatabase()

if (hasExistingData) {
  // Menu already has data, no need to check extraction job
  return
}

// Only check sessionStorage if no existing data found
const jobId = sessionStorage.getItem(`extractionJob:${menuId}`)
if (!jobId) {
  router.push(`/ux/menus/${menuId}/extract`)
  return
}
```

**Impact**: Users can now access their extracted menu items from any session, not just the one where extraction occurred.

### Solution 2: Strengthen Routing Condition (Secondary Fix)
Made the routing check more robust in MenuCard:

```typescript
// In MenuCard.tsx
const hasExtractedData = 
  (menu.items?.length ?? 0) > 0 || 
  (menu.categories?.length ?? 0) > 0 || 
  (menu.extractionMetadata?.schemaVersion && menu.extractionMetadata?.extractedAt)

if (hasExtractedData) {
  return `/ux/menus/${menu.id}/extracted`
}
```

**Impact**: More reliable detection of whether a menu has been extracted, checking for actual metadata properties rather than just truthy values.

## Testing Plan

1. **Test Case 1**: Fresh extraction
   - Upload image → Extract → Check routing
   - Expected: Route to `/extracted`

2. **Test Case 2**: Return after extraction
   - Complete extraction → Go to dashboard → Click "Edit Menu"
   - Expected: Route to `/extracted`

3. **Test Case 3**: New session
   - Complete extraction → Sign out → Sign in → Click "Edit Menu"
   - Expected: Route to `/extracted`

4. **Test Case 4**: Items deleted
   - Complete extraction → Delete all items → Click "Edit Menu"
   - Expected: Route to `/extracted` (because extractionMetadata exists)

5. **Test Case 5**: Browser refresh
   - Complete extraction → Refresh dashboard → Click "Edit Menu"
   - Expected: Route to `/extracted`

## Next Steps

1. Implement Solution 1 (strengthen routing condition)
2. Add temporary logging (Solution 2) to gather data
3. Test all scenarios
4. Monitor for any remaining issues
5. Remove logging once confirmed working
