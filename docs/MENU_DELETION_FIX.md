# Menu Item Deletion Fix

## Issue Description

Users were unable to delete all items from a menu. This occurred in two scenarios:
1. **Batch deletion**: When selecting all items and deleting them, one item would remain
2. **Single deletion**: When trying to delete the last remaining item, it would fail

## Root Cause

The issue was caused by THREE problems:

### 1. Database Trigger Session State Issue

The `sync_jsonb_to_menu_items()` and `sync_menu_item_changes()` triggers in `setup-menu-sync.sql` were using:

```sql
SET session_replication_role = replica;
-- ... operations ...
SET session_replication_role = DEFAULT;
```

This approach has a critical flaw: the `session_replication_role` setting persists for the entire database session, not just the function execution. When multiple deletions happened in quick succession (as in batch deletion), the session state could become corrupted, causing triggers to remain disabled and preventing proper synchronization between the `menu_items` table and the `menus.menu_data` JSONB field.

### 2. Race Condition in Batch Deletion

The frontend was deleting items one by one in a loop:

```typescript
for (const id of Array.from(selectedItemIds)) {
  const res = await fetch(`/api/menus/${menu.id}/items/${id}`, { method: 'DELETE' })
  // ...
}
```

This sequential approach meant each deletion was operating on potentially stale data, and the rapid-fire requests could interfere with each other due to the trigger state issues.

### 3. ID Format Mismatch (THE REAL BUG!)

The `menu_items` table uses `UUID` for the `id` column, but the application was generating short string IDs like `0avm2dvpd` using:

```typescript
function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}
```

When the trigger tried to sync items from JSONB to the `menu_items` table, it attempted to cast these short IDs to UUIDs:

```sql
COALESCE((value->>'id')::uuid, uuid_generate_v4())
```

This cast would fail silently, and while it would generate a new UUID, the mismatch meant:
- Items in JSONB had short IDs
- Items in `menu_items` table (if they existed) had different UUIDs
- Deletions and updates couldn't find matching items
- The sync was completely broken

## Solution

### 1. Fixed ID Generation

Changed `generateId()` in `src/lib/database.ts` to generate proper UUIDs:

```typescript
function generateId(): string {
  // Generate a UUID v4 compatible with the menu_items table
  return crypto.randomUUID()
}
```

### 2. Fixed Database Triggers

Updated both trigger functions to properly save and restore the session replication role:

```sql
CREATE OR REPLACE FUNCTION sync_jsonb_to_menu_items()
RETURNS TRIGGER AS $$
DECLARE
    original_role TEXT;
BEGIN
    -- Save the current session replication role
    SELECT current_setting('session_replication_role', true) INTO original_role;
    
    -- DISABLE triggers temporarily
    PERFORM set_config('session_replication_role', 'replica', true);
    
    -- ... operations ...
    
    -- RESTORE the original session replication role
    PERFORM set_config('session_replication_role', COALESCE(original_role, 'origin'), true);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Key improvements:
- Save the original `session_replication_role` before changing it
- Use `set_config()` with the `is_local` parameter set to `true` for transaction-scoped changes
- Restore the original role (or default to 'origin') after operations complete

The trigger now also handles the UUID validation more robustly using regex pattern matching instead of relying on cast exceptions.

### 3. Added Batch Delete API

Added a new `deleteMultipleItems` function to `src/lib/database.ts`:

```typescript
async deleteMultipleItems(menuId: string, userId: string, itemIds: string[]): Promise<Menu> {
  const menu = await menuOperations.getMenu(menuId, userId)
  if (!menu) throw new DatabaseError('Menu not found')
  
  const itemIdsSet = new Set(itemIds)
  const updatedItems = menu.items
    .filter(item => !itemIdsSet.has(item.id))
    .map((item, index) => ({ ...item, order: index }))
  
  return menuOperations.updateMenu(menuId, userId, { items: updatedItems })
}
```

### 4. Migrated Existing Data

Created `fix-short-ids-to-uuids.sql` to convert all existing short IDs to UUIDs in the database.

### 5. Updated API Route

Modified `src/app/api/menus/[menuId]/items/route.ts` DELETE endpoint to support both:
- Clearing all items (no body)
- Deleting specific items (body with `itemIds` array)

### 6. Updated Frontend

Changed `handleDeleteSelected` in `MenuEditor.tsx` to use a single batch delete API call instead of looping through individual deletions:

```typescript
const res = await fetch(`/api/menus/${menu.id}/items`, {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ itemIds: Array.from(selectedItemIds) })
})
```

## Files Changed

1. **src/lib/database.ts** - Fixed `generateId()` to use UUIDs + added `deleteMultipleItems` function
2. **fix-menu-sync-triggers.sql** (new) - SQL migration to fix the trigger functions
3. **fix-short-ids-to-uuids.sql** (new) - SQL migration to convert existing short IDs to UUIDs
4. **src/app/api/menus/[menuId]/items/route.ts** - Updated DELETE endpoint to support batch deletion
5. **src/app/dashboard/menus/[menuId]/MenuEditor.tsx** - Updated to use batch delete API

## How to Apply the Fix

**IMPORTANT: Run these in order!**

1. **First**, run the trigger fix:
   ```bash
   psql -d your_database < fix-menu-sync-triggers.sql
   ```

2. **Second**, convert existing short IDs to UUIDs:
   ```bash
   psql -d your_database < fix-short-ids-to-uuids.sql
   ```
   
   Or through Supabase dashboard:
   - Go to SQL Editor
   - Paste and run `fix-menu-sync-triggers.sql`
   - Then paste and run `fix-short-ids-to-uuids.sql`

3. **Third**, restart your Next.js dev server to pick up the code changes:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

4. **Finally**, hard refresh your browser (Ctrl+Shift+R)

## Testing

After applying the fix, test:
1. ✅ Delete all items using batch selection
2. ✅ Delete the last remaining item in a menu
3. ✅ Delete multiple items (but not all) using batch selection
4. ✅ Delete items one by one
5. ✅ Verify items are properly removed from both the UI and database

## Technical Notes

- The fix uses `set_config()` with `is_local = true` to ensure changes are transaction-scoped
- The batch delete approach is more efficient and avoids race conditions
- The existing single-item delete endpoint (`/api/menus/[menuId]/items/[itemId]`) remains unchanged for backward compatibility
- Empty menus (with `items: []`) are now properly handled by the triggers
