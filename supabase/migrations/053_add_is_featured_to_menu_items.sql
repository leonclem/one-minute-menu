-- ============================================================================
-- Migration 053: Add is_featured column to menu_items
-- ============================================================================
-- Adds an editorial flag for restaurant owners to mark signature dishes
-- or high-margin items as "featured" for visual emphasis on menus.
-- Requirements: 8.4 (GridMenu V2 Layout Engine Enhancements)
-- ============================================================================

-- ============================================================================
-- 1. Add is_featured column to menu_items table
-- ============================================================================

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. Add index for featured item queries
-- ============================================================================

-- Index for efficiently querying featured items per menu
CREATE INDEX IF NOT EXISTS idx_menu_items_is_featured
  ON menu_items(menu_id, is_featured) WHERE is_featured = TRUE;

-- ============================================================================
-- 3. Add column documentation
-- ============================================================================

COMMENT ON COLUMN menu_items.is_featured IS
  'Editorial flag indicating the item should be visually highlighted on the menu using a FEATURE_CARD tile. Defaults to FALSE.';

-- ============================================================================
-- 4. Migration verification
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items'
    AND column_name = 'is_featured'
  ) THEN
    RAISE EXCEPTION 'Migration failed: is_featured column not created on menu_items';
  END IF;

  RAISE NOTICE 'Migration 053 completed: is_featured column added to menu_items';
END $$;
