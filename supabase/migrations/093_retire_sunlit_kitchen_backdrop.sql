-- ============================================================================
-- Migration 093: Retire the unused Sunlit Kitchen backdrop
-- ============================================================================
-- Kitchen Worktop stays active. Saved editor state that still stores
-- sunlit-kitchen is rewritten to soft-neutral in application code.

UPDATE studio_background_styles
SET is_active = false
WHERE key = 'sunlit-kitchen'
  AND category = 'backdrop';
