-- ============================================================================
-- Migration 059: Add is_flagship column to menu_items
-- ============================================================================
-- Adds a flagship flag for restaurant owners to designate one menu item
-- as the showcase item whose image appears in the menu banner hero zone.
-- Enforces one-per-menu uniqueness via a partial unique index.
-- Requirements: menu-banner-footer Task 3
-- ============================================================================

-- ============================================================================
-- 1. Add is_flagship column to menu_items table
-- ============================================================================

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS is_flagship BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================================
-- 2. Add partial unique index to enforce one flagship per menu
-- ============================================================================

-- Only one row per menu_id may have is_flagship = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_one_flagship_per_menu
  ON menu_items(menu_id)
  WHERE is_flagship = TRUE;

-- ============================================================================
-- 3. Add index for flagship item queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_menu_items_is_flagship
  ON menu_items(menu_id, is_flagship) WHERE is_flagship = TRUE;

-- ============================================================================
-- 4. Add column documentation
-- ============================================================================

COMMENT ON COLUMN menu_items.is_flagship IS
  'Flagship flag indicating this item''s image should be showcased in the menu banner hero zone. '
  'At most one item per menu may have is_flagship = TRUE. Defaults to FALSE.';

-- ============================================================================
-- 5. Migration verification
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items'
    AND column_name = 'is_flagship'
  ) THEN
    RAISE EXCEPTION 'Migration failed: is_flagship column not created on menu_items';
  END IF;

  RAISE NOTICE 'Migration 059 completed: is_flagship column added to menu_items';
END $$;
