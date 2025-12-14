# Extraction Fix Summary

## Problem
Menu items were not appearing after extraction when using cached results. Investigation revealed that items were being extracted but placed in the `uncertainItems` array instead of in category `items` arrays.

## Root Cause
The extraction prompts (both stage1 and stage2) were instructing the AI to:
- **Require** pricing information for all menu items
- Move items without visible prices to `uncertainItems` array
- Mark items as "uncertain" if price was not visible

This was too strict for real-world menus where:
- Prices might not be clearly visible in photos
- Image quality might obscure price text
- Menu layouts might separate prices from items

## Example of the Issue
From database query of cached extraction result:
```json
{
  "menu": {
    "categories": [
      {"name": "Starters", "items": [], "confidence": 1},
      {"name": "Mains", "items": [], "confidence": 1},
      {"name": "Desserts", "items": [], "confidence": 1}
    ]
  },
  "uncertainItems": [
    {"text": "BBQ chicken & roasted peach salad", "reason": "price not visible"},
    {"text": "Seafood platter with fresh bread", "reason": "price not visible"},
    {"text": "Halloumi & sweetcorn fritters with chilli", "reason": "price not visible"},
    ...8 items total...
  ]
}
```

All 8 menu items were extracted but flagged as "uncertain" due to missing prices.

## Solution
Updated extraction prompts to be more lenient:

### Stage 2 Prompt Changes (`src/lib/extraction/prompt-stage2.ts`):
1. **System Role**: Changed from requiring pricing to allowing items without prices
   - Before: "Every menu item MUST include pricing information... Items without any pricing should be added to uncertainItems"
   - After: "Extract ALL menu items, even if pricing is not visible. If a price cannot be determined, set price to 0 and set confidence lower"

2. **Item Extraction Rules**: 
   - Before: "If you cannot find ANY price for an item, do NOT include it in the items array"
   - After: "If you cannot find a price for an item, set price to 0 and lower confidence (e.g., 0.7-0.8)"

3. **Clarified uncertainItems Purpose**:
   - Now only for items where the NAME is unclear/illegible
   - Not for items with missing prices

### Stage 1 Prompt Changes (`src/lib/extraction/prompt-stage1.ts`):
- Added: "Extract ALL items, even if price is not visible"
- Added: "If price not visible, set to 0 and lower confidence (0.7-0.8)"
- Added: "Only use uncertainItems if item NAME is unclear, not just price"

## Impact
- Items without visible prices will now be included in extraction results
- They will have `price: 0` and lower confidence scores (0.7-0.8)
- Users can manually edit prices in the UI
- `uncertainItems` array will only contain truly illegible items

## Testing
After clearing the extraction cache:
```sql
DELETE FROM menu_extraction_jobs WHERE status = 'completed';
```

Re-extract menus to get fresh results with the updated prompts.

## Files Modified
1. `src/lib/extraction/prompt-stage2.ts` - Updated system role and extraction rules
2. `src/lib/extraction/prompt-stage1.ts` - Updated item extraction guidelines

## Additional Diagnostic Tools Created
1. `clear_extraction_cache.sql` - Simple cache clearing script
2. `clear_extraction_cache_safe.sql` - Production-safe cache clearing with preview
3. `diagnose_extraction_results.sql` - Query to inspect extraction result structure in database
