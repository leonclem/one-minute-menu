-- ============================================================================
-- Migration 060: Add mark_as_featured feature flag
-- ============================================================================
-- Adds a feature flag to enable/disable the "Mark as Featured" functionality.
-- This flag is enabled by default to allow restaurant owners to mark items
-- as featured for visual emphasis on menus.
-- ============================================================================

-- ============================================================================
-- 1. Seed the mark_as_featured feature flag (enabled by default)
-- ============================================================================

INSERT INTO feature_flags (id, enabled)
VALUES ('mark_as_featured', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Migration verification
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM feature_flags WHERE id = 'mark_as_featured'
  ) THEN
    RAISE EXCEPTION 'Migration failed: mark_as_featured feature flag not created';
  END IF;

  RAISE NOTICE 'Migration 060 completed: mark_as_featured feature flag added and enabled';
END $$;
