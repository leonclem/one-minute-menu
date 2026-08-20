-- ============================================================================
-- Migration 086: Backdrop palette v2 (6 options)
-- ============================================================================

UPDATE studio_background_styles
SET is_active = false
WHERE category = 'backdrop'
  AND key IN ('studio-nightsky', 'studio-red', 'studio-grey-white', 'studio-yellow');

INSERT INTO studio_background_styles
  (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order, descriptor)
VALUES
  (
    'soft-neutral',
    'Soft Neutral',
    'Soft warm neutral background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a soft warm neutral background with a smooth matte appearance, extremely subtle natural tonal variation, and soft even falloff.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-soft-neutral',
    80,
    '{
      "appearance": "soft warm neutral background",
      "colour": "#E7E3DC",
      "texture": "smooth matte appearance with extremely subtle natural tonal variation",
      "falloff": "soft, even and unobtrusive"
    }'::jsonb
  ),
  (
    'warm-sand',
    'Warm Sand',
    'Warm muted sand-toned background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a warm muted sand-toned background with a smooth matte appearance, subtle warm tonal variation, and soft gradual falloff.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-warm-sand',
    90,
    '{
      "appearance": "warm muted sand-toned background",
      "colour": "#CDBA9C",
      "texture": "smooth matte appearance with subtle warm tonal variation",
      "falloff": "soft and gradual"
    }'::jsonb
  ),
  (
    'sage-green',
    'Sage Green',
    'Muted natural sage green background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a muted natural sage green background with a smooth matte appearance, restrained subtle texture, and soft even tonal depth.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-sage-green',
    100,
    '{
      "appearance": "muted natural sage green background",
      "colour": "#8E9C82",
      "texture": "smooth matte appearance with restrained subtle texture",
      "falloff": "soft and even with gentle tonal depth"
    }'::jsonb
  ),
  (
    'terracotta',
    'Terracotta',
    'Muted earthy terracotta background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a muted earthy terracotta background with a smooth matte appearance, subtle natural tonal variation, and soft gradual falloff.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-terracotta',
    110,
    '{
      "appearance": "muted earthy terracotta background",
      "colour": "#B8664F",
      "texture": "smooth matte appearance with subtle natural tonal variation",
      "falloff": "soft and gradual without harsh gradients"
    }'::jsonb
  ),
  (
    'deep-navy',
    'Deep Navy',
    'Deep rich navy background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a deep rich navy background with a smooth matte appearance, subtle tonal depth, and gentle dark falloff while keeping clear subject separation.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-deep-navy',
    120,
    '{
      "appearance": "deep rich navy background",
      "colour": "#19243A",
      "texture": "smooth matte appearance with very subtle tonal depth",
      "falloff": "gentle dark tonal falloff while retaining clear separation from the subject"
    }'::jsonb
  ),
  (
    'charcoal',
    'Charcoal',
    'Dark neutral charcoal background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a dark neutral charcoal background with a smooth matte appearance, graphite-like tonal variation, and controlled dark background depth.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-charcoal',
    130,
    '{
      "appearance": "dark neutral charcoal background",
      "colour": "#353638",
      "texture": "smooth matte appearance with subtle graphite-like tonal variation",
      "falloff": "soft dark falloff with controlled background depth"
    }'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  category = EXCLUDED.category,
  prompt_fragment = EXCLUDED.prompt_fragment,
  negative_constraints = EXCLUDED.negative_constraints,
  thumbnail_path = EXCLUDED.thumbnail_path,
  sort_order = EXCLUDED.sort_order,
  descriptor = EXCLUDED.descriptor,
  is_active = true;
