-- Migration: Add image_transform column to menu_items
-- Stores per-item image zoom and reposition data (offsetX, offsetY, scale).
-- Null means "use mode default" (no transform applied).

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS image_transform JSONB DEFAULT NULL;

COMMENT ON COLUMN menu_items.image_transform IS
  'Per-item image transform: { offsetX: number, offsetY: number, scale: number }. '
  'offsetX/offsetY are percentage-point shifts from the mode default focal point. '
  'scale is zoom multiplier (1.0 = default cover fit, max ~2.5). Null = no transform.';
