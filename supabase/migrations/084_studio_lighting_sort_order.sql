-- Reorder Studio lighting tiles: Bold Sunlight sits between Bright & Clean and Soft Natural.

UPDATE studio_lighting_styles
SET sort_order = CASE key
  WHEN 'bright-clean' THEN 10
  WHEN 'bold-sunlight' THEN 20
  WHEN 'soft-natural' THEN 30
  WHEN 'golden-hour' THEN 40
  WHEN 'dark-moody' THEN 50
  ELSE sort_order
END
WHERE key IN ('bright-clean', 'bold-sunlight', 'soft-natural', 'golden-hour', 'dark-moody');
