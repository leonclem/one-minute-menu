-- ============================================================================
-- Migration 083: Studio lighting palette v2 (5 options)
-- ============================================================================
-- Replaces the four legacy keys (studio, bright-and-airy, low-key) with four
-- new keys plus an updated golden-hour descriptor. Legacy rows are deactivated
-- so resolveLightingStyle only returns active v2 styles.

UPDATE studio_lighting_styles
SET is_active = false
WHERE key IN ('bright-and-airy', 'low-key', 'studio');

UPDATE studio_lighting_styles
SET
  name = 'Golden Hour',
  short_description = 'Warm directional late-afternoon light',
  prompt_fragment = 'Change the lighting to warm directional late-afternoon golden-hour light with elongated soft-edged shadows and warm highlights.',
  negative_constraints = 'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
  thumbnail_path = 'lighting/lighting-golden-hour',
  sort_order = 40,
  is_active = true,
  descriptor = '{
    "quality": "warm directional late-afternoon golden-hour light",
    "temperature": "warm golden",
    "shadows": "elongated soft-edged shadows with warm highlights",
    "falloff": "gentle warm glow with natural directional falloff"
  }'::jsonb
WHERE key = 'golden-hour';

INSERT INTO studio_lighting_styles
  (key, name, short_description, prompt_fragment, negative_constraints, thumbnail_path, sort_order, descriptor)
VALUES
  (
    'bright-clean',
    'Bright & Clean',
    'Clean commercial studio light with soft even key',
    'Change the lighting to clean commercial studio lighting with a soft even key and balanced fill, neutral colour temperature, and smooth gradual falloff.',
    'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
    'lighting/lighting-bright-clean',
    10,
    '{
      "quality": "clean commercial studio lighting with a soft even key and balanced fill",
      "temperature": "neutral",
      "shadows": "soft, controlled shadows with good subject definition",
      "falloff": "smooth and gradual"
    }'::jsonb
  ),
  (
    'soft-natural',
    'Soft Natural',
    'Soft diffused natural daylight',
    'Change the lighting to soft diffused natural daylight with gentle directional illumination, clean neutral daylight colour, and gentle natural falloff.',
    'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
    'lighting/lighting-soft-natural',
    30,
    '{
      "quality": "soft diffused natural daylight with gentle directional illumination",
      "temperature": "clean neutral daylight",
      "shadows": "soft, natural shadows with subtle depth",
      "falloff": "gentle natural falloff across the scene"
    }'::jsonb
  ),
  (
    'dark-moody',
    'Dark & Moody',
    'Low-key directional light with rich shadows',
    'Change the lighting to low-key directional lighting with controlled highlights, deep rich shadows, and pronounced falloff into a darker atmospheric background while keeping the food readable.',
    'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
    'lighting/lighting-dark-moody',
    50,
    '{
      "quality": "low-key directional lighting with controlled highlights and strong subject separation",
      "temperature": "neutral to subtly warm",
      "shadows": "deep, rich shadows while preserving visible detail in the food",
      "falloff": "pronounced falloff into a darker atmospheric background"
    }'::jsonb
  ),
  (
    'bold-sunlight',
    'Bold Sunlight',
    'Strong direct daylight with crisp contrast',
    'Change the lighting to strong direct daylight with crisp directional illumination, defined crisp-edged shadows, and clear directional falloff with bright highlights.',
    'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
    'lighting/lighting-bold-sunlight',
    20,
    '{
      "quality": "strong direct daylight with crisp directional illumination and graphic contrast",
      "temperature": "neutral to slightly warm daylight",
      "shadows": "defined, crisp-edged shadows with strong contrast",
      "falloff": "clear directional falloff with bright highlights and pronounced light-to-shadow separation"
    }'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  prompt_fragment = EXCLUDED.prompt_fragment,
  negative_constraints = EXCLUDED.negative_constraints,
  thumbnail_path = EXCLUDED.thumbnail_path,
  sort_order = EXCLUDED.sort_order,
  descriptor = EXCLUDED.descriptor,
  is_active = true;
