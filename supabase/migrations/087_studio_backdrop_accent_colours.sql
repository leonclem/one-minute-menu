-- ============================================================================
-- Migration 087: Accent colour backdrops (mustard, coral, teal, hot pink)
-- ============================================================================

INSERT INTO studio_background_styles
  (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order, descriptor)
VALUES
  (
    'mustard-yellow',
    'Mustard Yellow',
    'Warm mustard yellow background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a warm mustard yellow background with a smooth matte appearance, subtle tonal variation, and soft even backdrop glow with controlled depth.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-mustard-yellow',
    140,
    '{
      "appearance": "warm mustard yellow background",
      "colour": "#D4A017",
      "texture": "smooth matte appearance with subtle tonal variation",
      "falloff": "soft, even backdrop glow with controlled depth"
    }'::jsonb
  ),
  (
    'coral-red',
    'Coral Red',
    'Bold coral red background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a bold coral red background with a smooth matte appearance, subtle tonal variation, and soft even vibrant falloff with restrained gradient depth.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-coral-red',
    150,
    '{
      "appearance": "bold coral red background",
      "colour": "#E56B5D",
      "texture": "smooth matte appearance with subtle tonal variation",
      "falloff": "soft, even and vibrant with restrained gradient depth"
    }'::jsonb
  ),
  (
    'teal',
    'Teal',
    'Rich modern teal background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a rich modern teal background with a smooth matte appearance, subtle tonal variation, and soft even backdrop depth with clean separation.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-teal',
    160,
    '{
      "appearance": "rich modern teal background",
      "colour": "#01B3BF",
      "texture": "smooth matte appearance with subtle tonal variation",
      "falloff": "soft, even backdrop depth with clean separation"
    }'::jsonb
  ),
  (
    'hot-pink',
    'Hot Pink',
    'Bold hot pink background',
    'backdrop',
    'Change only the vertical backdrop behind the tabletop to a bold hot pink background with a smooth matte appearance, subtle tonal variation, and soft even vibrant falloff with controlled depth.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'backdrops/backdrop-hot-pink',
    170,
    '{
      "appearance": "bold hot pink background",
      "colour": "#FF4FA3",
      "texture": "smooth matte appearance with subtle tonal variation",
      "falloff": "soft, even and vibrant with controlled depth"
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
