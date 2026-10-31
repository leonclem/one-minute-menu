-- ============================================================================
-- Migration 094: Four additional Studio tabletop surfaces
-- ============================================================================
-- Weathered Metal, Sage Peace, Steel Countertop, and Warm Terracotta.
-- Generation uses the descriptor text. The jpg files are picker thumbnails.

INSERT INTO studio_background_styles
  (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order, descriptor)
VALUES
  (
    'weathered-metal',
    'Weathered Metal',
    'Weathered dark metal tabletop with rust blooms',
    'surface',
    'Change only the tabletop surface supporting the dish to weathered dark metal: a matte blue-charcoal field with fine scratches and irregular rust-brown blooms. Keep the background/backdrop behind the table and the dish itself completely locked. Keep the tabletop empty of props.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-weathered-metal.jpg',
    90,
    '{
      "material": "weathered dark metal",
      "finish": "matte and worn, with fine scratches and irregular rust-brown blooms across a blue-charcoal field",
      "colour": "#2C3A42",
      "description": "A dark oxidized metal tabletop. The base tone is blue-charcoal. Scattered rust-brown patches and fine scratches break the surface. Keep the tabletop empty of props, food, and vessels other than the dish already in the photograph."
    }'::jsonb
  ),
  (
    'sage-peace',
    'Sage Peace',
    'Pale sage plaster tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to pale sage plaster with a matte, lightly pitted texture. Keep the background/backdrop behind the table and the dish itself completely locked. Keep the tabletop clear of leaves, linen, and extra vessels.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-sage-peace.jpg',
    100,
    '{
      "material": "sage plaster",
      "finish": "matte, lightly textured, with a soft uneven plaster surface",
      "colour": "#C5CDB6",
      "description": "A pale sage-green plaster tabletop with a soft, lightly pitted texture. Keep the tabletop clear: no leaves, linen, plates, or extra vessels."
    }'::jsonb
  ),
  (
    'steel-countertop',
    'Steel Countertop',
    'Brushed stainless steel countertop',
    'surface',
    'Change only the tabletop surface supporting the dish to brushed stainless steel with a fine horizontal grain. Keep the background/backdrop behind the table and the dish itself completely locked. Keep the surface plain.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-steel-countertop.jpg',
    110,
    '{
      "material": "brushed stainless steel",
      "finish": "cool silver metal with a fine horizontal brushed grain",
      "colour": "#C5C9CE",
      "description": "A flat brushed stainless-steel countertop. The grain runs horizontally. Keep the surface plain: no seams, appliances, or extra objects."
    }'::jsonb
  ),
  (
    'warm-terracotta',
    'Warm Terracotta',
    'Warm terracotta plaster tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to warm terracotta plaster with a matte, finely pitted surface and soft tonal mottling. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-warm-terracotta.jpg',
    120,
    '{
      "material": "warm terracotta plaster",
      "finish": "matte and finely pitted, with soft tonal mottling",
      "colour": "#C48462",
      "description": "A warm clay-coloured plaster tabletop. The tone shifts gently between lighter and deeper terracotta. Keep the tabletop empty of props."
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
