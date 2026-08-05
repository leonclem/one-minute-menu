-- Align Studio control-panel labels and default lighting order.
-- This is intentionally non-destructive and safe to re-run.

UPDATE studio_lighting_styles
SET
  name = CASE key
    WHEN 'studio' THEN 'Studio'
    WHEN 'bright-and-airy' THEN 'Window Light'
    WHEN 'golden-hour' THEN 'Golden Hour'
    WHEN 'low-key' THEN 'Low-Key / Dramatic'
    ELSE name
  END,
  sort_order = CASE key
    WHEN 'studio' THEN 10
    WHEN 'bright-and-airy' THEN 20
    WHEN 'golden-hour' THEN 30
    WHEN 'low-key' THEN 40
    ELSE sort_order
  END
WHERE key IN ('studio', 'bright-and-airy', 'golden-hour', 'low-key');
