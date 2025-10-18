# Item ID Fix - Visual Flow

## Before Fix

```
User adds item via extraction → generateItemId() → item_abc123 (OLD FORMAT)
User adds item manually       → generateId()     → 550e8400-... (UUID)

Delete attempt:
  item.id = "item_abc123"
  itemId from API = "item_abc123"
  Comparison: item.id !== itemId → Sometimes fails ❌
```

## After Fix

```
User adds item via extraction → generateItemId() → 550e8400-... (UUID)
User adds item manually       → generateId()     → 550e8400-... (UUID)

Menu load:
  Database → transformMenuFromDB() → ensureBackwardCompatibility()
                                  → migrateItemIdsToUUIDs()
                                  → Old IDs converted to UUIDs

Delete attempt:
  item.id = "550e8400-..."
  itemId from API = "550e8400-..."
  Comparison: item.id !== itemId → Always works ✅
```

## Migration Flow

```
1. Menu loaded from database
   ↓
2. transformMenuFromDB() converts DB format to app format
   ↓
3. ensureBackwardCompatibility() called
   ↓
4. migrateItemIdsToUUIDs() detects old IDs
   ↓
5. Old IDs (item_*) → New UUIDs (550e8400-...)
   ↓
6. Menu displayed with new IDs
   ↓
7. User makes any edit
   ↓
8. New UUIDs saved to database
```

## Key Changes

| File | Function | Change |
|------|----------|--------|
| menu-data-migration.ts | generateItemId() | `item_${random}` → `crypto.randomUUID()` |
| menu-data-migration.ts | generateCategoryId() | `cat_${random}` → `crypto.randomUUID()` |
| menu-data-migration.ts | migrateItemIdsToUUIDs() | NEW - Converts old IDs to UUIDs |
| menu-data-migration.ts | ensureBackwardCompatibility() | Now calls migrateItemIdsToUUIDs() |
