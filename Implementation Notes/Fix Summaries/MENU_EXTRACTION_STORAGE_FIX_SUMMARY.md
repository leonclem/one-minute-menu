# Menu Extraction Storage Fix - Summary

## Problem
Users experienced inconsistent behavior when clicking "Edit Menu" after completing menu extraction. In new sessions or browser tabs, they were redirected back to `/extract` instead of `/extracted`, even though their menu data was permanently stored in the database.

## Root Cause
The `/extracted` page was dependent on `sessionStorage` to have the extraction `jobId`. When users returned in a new session, the sessionStorage was empty, causing a redirect to `/extract` even though the menu had extracted items in the database.

## Solution Implemented

### 1. Modified `/extracted` Page to Check Database First
**File**: `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`

The page now:
1. First attempts to load the menu from the database
2. Checks if the menu has extracted data (items or extractionMetadata)
3. If data exists, uses it directly without requiring sessionStorage
4. Only checks sessionStorage for active extraction jobs if no existing data is found

**Flow**:
```
User visits /extracted
  ↓
Load menu from database
  ↓
Has items or extractionMetadata? 
  ↓ YES → Display extracted items ✅
  ↓ NO  → Check sessionStorage for active job
           ↓ Has jobId? 
             ↓ YES → Poll for extraction completion
             ↓ NO  → Redirect to /extract
```

### 2. Strengthened Routing Logic in MenuCard
**File**: `src/components/dashboard/MenuCard.tsx`

Made the routing condition more robust by checking for actual metadata properties:

```typescript
const hasExtractedData = 
  (menu.items?.length ?? 0) > 0 || 
  (menu.categories?.length ?? 0) > 0 || 
  (menu.extractionMetadata?.schemaVersion && menu.extractionMetadata?.extractedAt)
```

This ensures we're checking for valid extraction metadata, not just any truthy value.

## Impact

### Before Fix
- ❌ Users redirected to `/extract` in new sessions
- ❌ Extraction data appeared "lost" despite being in database
- ❌ Users had to re-extract menus unnecessarily
- ❌ Poor user experience with inconsistent behavior

### After Fix
- ✅ Users can access extracted menus from any session
- ✅ Extraction data persists across browser sessions
- ✅ No unnecessary re-extraction required
- ✅ Consistent behavior: once extracted, always goes to `/extracted`

## Testing Scenarios

All scenarios should now route to `/extracted`:

1. ✅ **Fresh extraction** - Complete extraction → Click "Edit Menu"
2. ✅ **Same session** - Extract → Dashboard → Click "Edit Menu"
3. ✅ **New session** - Extract → Sign out → Sign in → Click "Edit Menu"
4. ✅ **New browser tab** - Extract → Open new tab → Dashboard → Click "Edit Menu"
5. ✅ **After browser restart** - Extract → Close browser → Reopen → Click "Edit Menu"
6. ✅ **Cleared sessionStorage** - Extract → Clear storage → Dashboard → Click "Edit Menu"

## Files Modified

1. `src/app/ux/menus/[menuId]/extracted/extracted-client.tsx`
   - Added database check before sessionStorage check
   - Load existing menu data if available

2. `src/components/dashboard/MenuCard.tsx`
   - Strengthened routing condition
   - Check for valid extractionMetadata properties

## Technical Details

### Storage Architecture
- **Permanent Storage**: PostgreSQL database (`menus` table, `menu_data` JSONB column)
- **Temporary Storage**: sessionStorage (only for active extraction jobs)

### Data Structure
```typescript
menu_data: {
  items: MenuItem[],
  categories?: MenuCategory[],
  extractionMetadata?: {
    schemaVersion: 'stage1' | 'stage2',
    promptVersion: string,
    confidence: number,
    extractedAt: Date,
    jobId?: string
  }
}
```

### API Endpoints Used
- `GET /api/menus/[menuId]` - Fetch menu with all data
- `POST /api/menus/[menuId]/apply-extraction` - Apply extraction results
- `GET /api/extraction/status/[jobId]` - Check extraction job status

## Backward Compatibility
✅ Fully backward compatible - existing extraction flows continue to work
✅ No database migrations required
✅ No breaking changes to API contracts

## Next Steps
1. Deploy changes to production
2. Monitor for any edge cases
3. Consider removing sessionStorage dependency entirely in future refactor
4. Add analytics to track extraction success rates
