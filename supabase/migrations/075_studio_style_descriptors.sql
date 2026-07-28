-- ============================================================================
-- Migration 075: Structured Studio style descriptors
-- Group B / Scene-descriptor payload (Requirements 2.20, 3.9, 3.10, 3.11)
-- ============================================================================
-- The legacy prompt_fragment and negative_constraints columns intentionally remain
-- available for admin CRUD and the null-descriptor compatibility fallback. The
-- descriptor is read server-side; customer display column lists are unchanged.

ALTER TABLE studio_lighting_styles
    ADD COLUMN IF NOT EXISTS descriptor JSONB;

ALTER TABLE studio_background_styles
    ADD COLUMN IF NOT EXISTS descriptor JSONB;

COMMENT ON COLUMN studio_lighting_styles.descriptor IS
    'Server-only structured lighting attributes for the Studio scene descriptor';
COMMENT ON COLUMN studio_background_styles.descriptor IS
    'Server-only structured surface/backdrop attributes for the Studio scene descriptor';

-- ---------------------------------------------------------------------------
-- Seeded lighting descriptors
-- ---------------------------------------------------------------------------
-- Only NULL descriptors are filled so re-applying this migration is safe and
-- does not overwrite an administrator-authored descriptor.

UPDATE studio_lighting_styles
SET descriptor = '{
    "quality": "bright-and-airy high-key diffused light",
    "temperature": "clean neutral daylight",
    "shadows": "minimal, light shadows",
    "falloff": "soft, even diffusion"
}'::jsonb
WHERE key = 'bright-and-airy'
  AND descriptor IS NULL;

UPDATE studio_lighting_styles
SET descriptor = '{
    "quality": "low-key dramatic light",
    "temperature": "neutral, moody",
    "shadows": "richer shadows",
    "falloff": "darker, moodier background"
}'::jsonb
WHERE key = 'low-key'
  AND descriptor IS NULL;

UPDATE studio_lighting_styles
SET descriptor = '{
    "quality": "clean commercial studio, even key with soft fill",
    "temperature": "neutral",
    "shadows": "soft, controlled shadows",
    "falloff": "gradual"
}'::jsonb
WHERE key = 'studio'
  AND descriptor IS NULL;

UPDATE studio_lighting_styles
SET descriptor = '{
    "quality": "warm, directional golden-hour sunlight",
    "temperature": "warm golden",
    "shadows": "long, soft shadows",
    "falloff": "soft golden glow across the scene"
}'::jsonb
WHERE key = 'golden-hour'
  AND descriptor IS NULL;

-- ---------------------------------------------------------------------------
-- Seeded surface descriptors
-- ---------------------------------------------------------------------------

UPDATE studio_background_styles
SET descriptor = '{
    "material": "dark slate stone",
    "finish": "honed matte with subtle natural texture",
    "colour": "#2E3338"
}'::jsonb
WHERE key = 'dark-slate'
  AND category = 'surface'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "rustic wood",
    "finish": "natural grain",
    "colour": "#8B5A2B"
}'::jsonb
WHERE key = 'rustic-wood'
  AND category = 'surface'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "light granite stone",
    "finish": "polished with subtle grey and white crystalline flecks",
    "colour": "#D9D9D2"
}'::jsonb
WHERE key = 'granite-light'
  AND category = 'surface'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "light marble",
    "finish": "elegant surface with delicate soft grey veins",
    "colour": "#F1F0EB"
}'::jsonb
WHERE key = 'marble-light'
  AND category = 'surface'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "clean white fabric",
    "finish": "crisp with soft natural folds",
    "colour": "#FFFFFF"
}'::jsonb
WHERE key = 'white-tablecloth'
  AND category = 'surface'
  AND descriptor IS NULL;

-- ---------------------------------------------------------------------------
-- Seeded backdrop descriptors
-- ---------------------------------------------------------------------------

UPDATE studio_background_styles
SET descriptor = '{
    "material": "deep dark nightsky backdrop",
    "colour": "#191F3A",
    "falloff": "subtle, soft midnight blue texture"
}'::jsonb
WHERE key = 'studio-nightsky'
  AND category = 'backdrop'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "vibrant red studio backdrop",
    "colour": "#C62828",
    "falloff": "subtle, soft texture"
}'::jsonb
WHERE key = 'studio-red'
  AND category = 'backdrop'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "seamless neutral grey-white studio backdrop",
    "colour": "#D9D9D9",
    "falloff": "soft, professional studio lighting"
}'::jsonb
WHERE key = 'studio-grey-white'
  AND category = 'backdrop'
  AND descriptor IS NULL;

UPDATE studio_background_styles
SET descriptor = '{
    "material": "vibrant solid yellow studio backdrop",
    "colour": "#F2C200",
    "falloff": "soft, professional studio lighting"
}'::jsonb
WHERE key = 'studio-yellow'
  AND category = 'backdrop'
  AND descriptor IS NULL;
