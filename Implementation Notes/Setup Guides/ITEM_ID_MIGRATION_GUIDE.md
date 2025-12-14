# Item ID Migration Guide

## Problem

Menu items were being created with two different ID formats:

1. **Old format** (from extraction): `item_XXXXXXXXX` (e.g., `item_a1b2c3d4e`)
2. **New format** (from manual creation): UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)

This inconsistency caused issues when trying to delete items with old-style IDs because:
- The delete API expects to match item IDs exactly
- Items with `item_` prefixed IDs wouldn't match properly in some operations
- The database operations use UUID generation, but the extraction migration used a different ID format

## Root Cause

The issue was in `src/lib/menu-data-migration.ts`:

```typescript
// OLD CODE (problematic)
function generateItemId(): string {
  return `item_${Math.random().toString(36).substr(2, 9)}`
}
```

This was creating non-UUID IDs during the extraction process, while manually added items used:

```typescript
// In src/lib/database.ts
function generateId(): string {
  return crypto.randomUUID()
}
```

## Solution

### 1. Fixed ID Generation

Updated `generateItemId()` and `generateCategoryId()` in `src/lib/menu-data-migration.ts` to use proper UUIDs:

```typescript
function generateItemId(): string {
  return crypto.randomUUID()
}

function generateCategoryId(): string {
  return crypto.randomUUID()
}
```

### 2. Added Migration Function

Created `migrateItemIdsToUUIDs()` function that:
- Detects items with old-style IDs (starting with `item_` or `cat_`)
- Generates new UUIDs for those items
- Updates both the flat items array and hierarchical categories
- Maintains ID consistency across the menu structure

### 3. Automatic Migration on Load

Updated `ensureBackwardCompatibility()` to automatically migrate old IDs when menus are loaded:

```typescript
export function ensureBackwardCompatibility(menu: Menu): Menu {
  // First, migrate any old-style IDs to UUIDs
  let migratedMenu = migrateItemIdsToUUIDs(menu)
  // ... rest of compatibility logic
}
```

This means:
- **New items**: Will always get proper UUIDs
- **Existing items with old IDs**: Will be automatically migrated when the menu is loaded
- **The migration persists**: When the menu is saved after any edit, the new UUIDs are stored

## Migration Options

### Option 1: Automatic (Recommended)

The fix is already in place. Old IDs will be automatically migrated to UUIDs when:
- A menu is loaded in the editor
- Any edit is made to the menu (the new IDs will be saved)

**No manual action required** - just use the app normally.

### Option 2: Bulk Migration Script (TypeScript)

For immediate migration of all menus, run:

```bash
npx tsx scripts/migrate-item-ids-to-uuids.ts
```

This script:
- Fetches all menus from the database
- Identifies menus with old-style IDs
- Migrates them to UUIDs
- Updates the database

**Requirements:**
- Environment variables must be set (`.env.local`)
- `tsx` package installed (`npm install -g tsx`)

### Option 3: SQL Migration

Run the SQL script directly in Supabase SQL Editor:

```bash
# Copy the contents of fix-item-ids-migration.sql
# Paste into Supabase SQL Editor
# Execute
```

This approach:
- Runs entirely in the database
- Faster for large datasets
- Provides immediate feedback

## Verification

After migration, you can verify the fix by:

1. **Check the browser console** when viewing a menu:
   - Old IDs: `item_a1b2c3d4e`
   - New IDs: `550e8400-e29b-41d4-a716-446655440000`

2. **Test deletion**:
   - Try deleting items that previously couldn't be deleted
   - They should now delete successfully

3. **Run SQL verification**:
   ```sql
   SELECT 
     COUNT(*) as total_menus,
     COUNT(CASE 
       WHEN EXISTS (
         SELECT 1 
         FROM jsonb_array_elements(menu_data->'items') AS item
         WHERE (item->>'id') LIKE 'item_%' OR (item->>'id') LIKE 'cat_%'
       ) THEN 1 
     END) as menus_with_old_ids
   FROM menus
   WHERE menu_data IS NOT NULL;
   ```
   
   If `menus_with_old_ids` is 0, all menus have been migrated.

## Impact

- **Backward compatible**: Old menus continue to work
- **Forward compatible**: New items always use UUIDs
- **Automatic**: No user action required
- **Safe**: IDs are migrated, not deleted
- **Persistent**: Once migrated and saved, the new IDs are permanent

## Testing

To test the fix:

1. Load a menu with old-style IDs
2. Try to delete an item (should work now)
3. Check the browser console to see the new UUID
4. Refresh the page - the UUID should persist

## Rollback

If issues occur, the old code can be restored, but this is not recommended as it would reintroduce the deletion bug. Instead, report any issues so they can be fixed while maintaining UUID compatibility.
