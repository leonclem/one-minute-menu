-- ============================================================================
-- Migration 085: Studio tabletop surface palette v2 (7 options)
-- ============================================================================

UPDATE studio_background_styles
SET is_active = false
WHERE category = 'surface'
  AND key IN ('dark-slate', 'rustic-wood', 'granite-light', 'marble-light', 'white-tablecloth');

INSERT INTO studio_background_styles
  (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order, descriptor)
VALUES
  (
    'natural-oak',
    'Natural Oak',
    'Light natural oak wood tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to light natural oak wood with a smooth matte finish and fine natural wood grain. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-natural-oak',
    10,
    '{
      "material": "light natural oak wood",
      "finish": "smooth matte finish with fine natural wood grain",
      "colour": "#C9A978"
    }'::jsonb
  ),
  (
    'dark-walnut',
    'Dark Walnut',
    'Dark walnut wood tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to dark walnut wood with a smooth matte finish and rich natural wood grain. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-dark-walnut',
    20,
    '{
      "material": "dark walnut wood",
      "finish": "smooth matte finish with rich natural wood grain",
      "colour": "#4A3024"
    }'::jsonb
  ),
  (
    'white-marble',
    'White Marble',
    'White marble tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to white marble with a smooth elegant surface and subtle soft grey veining. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-white-marble',
    30,
    '{
      "material": "white marble",
      "finish": "smooth elegant surface with subtle soft grey veining",
      "colour": "#F3F2EE"
    }'::jsonb
  ),
  (
    'raw-concrete',
    'Raw Concrete',
    'Raw concrete tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to raw concrete with a matte fine-grained surface and subtle natural mottling. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-raw-concrete',
    40,
    '{
      "material": "raw concrete",
      "finish": "matte fine-grained surface with subtle natural mottling",
      "colour": "#A7A6A1"
    }'::jsonb
  ),
  (
    'dark-stone',
    'Dark Stone',
    'Dark natural stone tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to dark natural stone with a honed matte surface and subtle organic stone texture. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-dark-stone',
    50,
    '{
      "material": "dark natural stone",
      "finish": "honed matte surface with subtle organic stone texture",
      "colour": "#2E3338"
    }'::jsonb
  ),
  (
    'natural-linen',
    'Natural Linen',
    'Natural linen fabric tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to natural linen fabric with a flat matte woven surface and subtle textile texture. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-natural-linen',
    60,
    '{
      "material": "natural linen fabric",
      "finish": "flat matte woven surface with subtle textile texture",
      "colour": "#E5D8C2"
    }'::jsonb
  ),
  (
    'terrazzo',
    'Terrazzo',
    'Light terrazzo stone tabletop',
    'surface',
    'Change only the tabletop surface supporting the dish to light terrazzo stone with a smooth matte surface and small subtle neutral stone chips. Keep the background/backdrop behind the table and the dish itself completely locked.',
    'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
    'surfaces/surface-terrazzo',
    70,
    '{
      "material": "light terrazzo stone",
      "finish": "smooth matte surface with small subtle neutral stone chips",
      "colour": "#E5E0D7"
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
