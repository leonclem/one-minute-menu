-- ============================================================================
-- Migration 092: Experimental photographic kitchen backdrop and worktop
-- ============================================================================
-- Sunlit Kitchen is a full kitchen scene offered as a backdrop.
-- Kitchen Worktop is the overhead marble baking surface offered as a surface.
-- Generation still uses the descriptor text; the jpg is the picker thumbnail.

INSERT INTO studio_background_styles
  (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order, descriptor)
VALUES
  (
    'sunlit-kitchen',
    'Sunlit Kitchen',
    'Sunlit cream kitchen with white cabinets and a window',
    'backdrop',
    'Change only the backdrop behind the dish to a sunlit cream home kitchen: white shaker cabinets with brass knobs, a glass-front cabinet, open shelves of jars and ceramics, white subway tile, and a window with daylight and greenery. Keep the dish, vessel, food, and camera unchanged.',
    'Do not change the dish, vessel, or food. Do not move the camera.',
    'backdrops/backdrop-sunlit-kitchen.jpg',
    180,
    '{
      "appearance": "sunlit cream home kitchen with white shaker cabinets, open shelves of jars and ceramics, white subway tile, and a window",
      "colour": "#F3EEE6",
      "texture": "painted cabinets, glossy subway tile, and soft daylight",
      "falloff": "soft window light with gentle shadows across the wall",
      "description": "Sunlit cream kitchen behind the dish. Glass-front cabinet at the upper left, open white shelves of jars, bowls, and a trailing plant, white subway tile, and a window with greenery at the right. On the counter: pink tulips, wooden boards, oil bottles, and hanging utensils. At the left edge: copper pans on a brass stand and a wooden stool. Change the backdrop to this kitchen. Keep the dish, its vessel, the food, and the camera unchanged."
    }'::jsonb
  ),
  (
    'kitchen-worktop',
    'Kitchen Worktop',
    'Pale marble baking worktop with flour at the edges',
    'surface',
    'Change only the tabletop under the dish to a pale marble baking worktop. The centre stays clear. Flour is dusted toward the far edge, with two eggs and a wooden rolling pin cropped at the top, a bowl of flour and linen at the upper left, and rosemary and linen at the lower right. Keep the dish, vessel, food, camera, and backdrop unchanged.',
    'Do not change the dish, vessel, or food. Do not move the camera.',
    'surfaces/surface-kitchen-worktop.jpg',
    80,
    '{
      "material": "pale marble baking worktop",
      "finish": "smooth cream marble with a light dusting of flour and baking tools cropped at the edges",
      "colour": "#F2EFEA",
      "description": "Pale marble worktop, mostly clear in the centre so the dish can sit there. Flour is dusted toward the top, with two eggs and a wooden rolling pin cropped at the top edge, a bowl of flour and linen at the upper left, and a rosemary sprig and linen at the lower right. Change only the tabletop under the dish to this surface. Keep the dish, vessel, food, camera, and backdrop unchanged."
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
