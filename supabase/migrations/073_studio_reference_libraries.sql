-- ============================================================================
-- Migration 073: Studio lighting + background reference libraries (Chunk 4 / Phase 3)
-- ============================================================================
-- Admin-managed curated style libraries. Authenticated users can SELECT active
-- rows; only admins can INSERT/UPDATE/DELETE. Prompt fragments stay in the DB
-- and are resolved server-side (customer APIs must not expose them).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Lighting styles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studio_lighting_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_description TEXT,
    prompt_fragment TEXT NOT NULL,
    negative_constraints TEXT,
    thumbnail_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_lighting_styles_active_sort
    ON studio_lighting_styles (is_active, sort_order);

COMMENT ON TABLE studio_lighting_styles IS
    'Curated lighting style library for Photo Studio (admin-managed)';
COMMENT ON COLUMN studio_lighting_styles.key IS
    'Stable style key stored on editorState.scene_setup.lighting';
COMMENT ON COLUMN studio_lighting_styles.prompt_fragment IS
    'Server-only directive clause; never return to FOH clients';
COMMENT ON COLUMN studio_lighting_styles.thumbnail_path IS
    'Basename (no extension) under public/studio/controls/';

-- ---------------------------------------------------------------------------
-- Background / surface styles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studio_background_styles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    short_description TEXT,
    category TEXT NOT NULL CHECK (category IN ('surface', 'environment', 'backdrop')),
    prompt_fragment TEXT NOT NULL,
    negative_constraints TEXT,
    thumbnail_path TEXT,
    is_premium BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_background_styles_active_sort
    ON studio_background_styles (is_active, sort_order);

COMMENT ON TABLE studio_background_styles IS
    'Curated background/surface style library for Photo Studio (admin-managed)';
COMMENT ON COLUMN studio_background_styles.key IS
    'Stable style key stored on editorState.canvas.background_style';
COMMENT ON COLUMN studio_background_styles.prompt_fragment IS
    'Server-only directive clause; never return to FOH clients';

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_studio_lighting_styles_updated_at ON studio_lighting_styles;
    CREATE TRIGGER update_studio_lighting_styles_updated_at
      BEFORE UPDATE ON studio_lighting_styles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_studio_background_styles_updated_at ON studio_background_styles;
    CREATE TRIGGER update_studio_background_styles_updated_at
      BEFORE UPDATE ON studio_background_styles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE studio_lighting_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_background_styles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to allow re-running the script cleanly
DROP POLICY IF EXISTS "Authenticated users can select active lighting styles" ON studio_lighting_styles;
DROP POLICY IF EXISTS "Authenticated users can select active background styles" ON studio_background_styles;
DROP POLICY IF EXISTS "Admins can select all lighting styles" ON studio_lighting_styles;
DROP POLICY IF EXISTS "Admins can insert lighting styles" ON studio_lighting_styles;
DROP POLICY IF EXISTS "Admins can update lighting styles" ON studio_lighting_styles;
DROP POLICY IF EXISTS "Admins can delete lighting styles" ON studio_lighting_styles;
DROP POLICY IF EXISTS "Admins can select all background styles" ON studio_background_styles;
DROP POLICY IF EXISTS "Admins can insert background styles" ON studio_background_styles;
DROP POLICY IF EXISTS "Admins can update background styles" ON studio_background_styles;
DROP POLICY IF EXISTS "Admins can delete background styles" ON studio_background_styles;

-- Authenticated users can read active styles (display fields used by FOH).
CREATE POLICY "Authenticated users can select active lighting styles"
    ON studio_lighting_styles FOR SELECT
    TO authenticated
    USING (is_active = true);

CREATE POLICY "Authenticated users can select active background styles"
    ON studio_background_styles FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Admins can read all rows (including inactive) and manage CRUD.
CREATE POLICY "Admins can select all lighting styles"
    ON studio_lighting_styles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can insert lighting styles"
    ON studio_lighting_styles FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can update lighting styles"
    ON studio_lighting_styles FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can delete lighting styles"
    ON studio_lighting_styles FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can select all background styles"
    ON studio_background_styles FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can insert background styles"
    ON studio_background_styles FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can update background styles"
    ON studio_background_styles FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

CREATE POLICY "Admins can delete background styles"
    ON studio_background_styles FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );

-- ---------------------------------------------------------------------------
-- Seed: 6 lighting styles (§7.4) — keep existing keys for continuity
-- ---------------------------------------------------------------------------

-- First, delete styles that are no longer wanted to ensure a clean, tidied table
DELETE FROM studio_lighting_styles WHERE key IN ('soft-natural-window', 'clean-delivery', 'warm-restaurant');

INSERT INTO studio_lighting_styles
    (key, name, short_description, prompt_fragment, negative_constraints, thumbnail_path, sort_order)
VALUES
    (
        'bright-and-airy',
        'Window light',
        'Clean high-key diffused light',
        'Change the lighting to bright-and-airy high-key diffused light. Remove heavy shadows and keep the scene clean, bright, and airy.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'lighting/lighting-natural',
        10
    ),
    (
        'low-key',
        'Low-Key / Dramatic',
        'Richer shadows and moody contrast',
        'Change the lighting to low-key dramatic light. Add richer shadows and a darker, moodier background while keeping the dish readable.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'lighting/lighting-moody',
        20
    ),
    (
        'studio',
        'Premium Editorial / Studio',
        'Polished commercial studio light',
        'Change the lighting to clean commercial studio lighting: even, controlled key light with soft fill, neutral colour temperature, and a polished menu-photo look. Do not change the dish or add props.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'lighting/lighting-studio',
        30
    ),
    (
        'golden-hour',
        'Golden Hour',
        'Warm directional golden hour sunlight',
        'Change the lighting to warm, directional golden hour sunlight. Add long, soft shadows and a beautiful warm golden glow across the scene.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'lighting/lighting-golden-hour',
        40
    )
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    prompt_fragment = EXCLUDED.prompt_fragment,
    negative_constraints = EXCLUDED.negative_constraints,
    thumbnail_path = EXCLUDED.thumbnail_path,
    sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Seed: background/surface styles (§7.5)
-- ---------------------------------------------------------------------------

-- Delete styles that are no longer wanted to ensure a clean, tidied table
DELETE FROM studio_background_styles WHERE key IN ('clean-white-studio', 'warm-beige-ceramic', 'marble-counter', 'neutral-delivery', 'premium-dark-restaurant', 'bright-cafe-table');

INSERT INTO studio_background_styles
    (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order)
VALUES
    (
        'dark-slate',
        'Dark Slate',
        'Dark slate stone surface',
        'surface',
        'Change only the tabletop surface supporting the dish to a dark slate stone surface with subtle natural texture. Keep the background/backdrop behind the table and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'surfaces/surface-dark-slate',
        10
    ),
    (
        'rustic-wood',
        'Rustic Wood',
        'Rustic wooden tabletop',
        'surface',
        'Change only the tabletop surface supporting the dish to a rustic wood tabletop with natural grain. Keep the background/backdrop behind the table and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'surfaces/surface-rustic-wood',
        20
    ),
    (
        'granite-light',
        'Light Granite',
        'Polished light granite surface',
        'surface',
        'Change only the tabletop surface supporting the dish to a polished light granite stone surface with subtle grey and white crystalline flecks. Keep the background/backdrop behind the table and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'surfaces/surface-granite-light',
        30
    ),
    (
        'marble-light',
        'Light Marble',
        'Elegant light marble surface',
        'surface',
        'Change only the tabletop surface supporting the dish to an elegant light marble surface with delicate soft grey veins. Keep the background/backdrop behind the table and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'surfaces/surface-marble-light',
        40
    ),
    (
        'white-tablecloth',
        'White tablecloth',
        'Clean white fabric tablecloth',
        'surface',
        'Change only the tabletop surface supporting the dish to a clean, crisp white fabric tablecloth with soft natural folds. Keep the background/backdrop behind the table and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'surfaces/surface-white-tablecloth',
        50
    ),
    (
        'studio-nightsky',
        'Studio Nightsky',
        'Deep dark nightsky backdrop',
        'backdrop',
        'Change only the vertical backdrop/wall behind the tabletop to a deep dark nightsky backdrop with a subtle, soft midnight blue texture. Keep the tabletop surface, its shadows, and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'backdrops/backdrop-studio-nightsky',
        60
    ),
    (
        'studio-red',
        'Studio Red',
        'Vibrant red studio backdrop',
        'backdrop',
        'Change only the vertical backdrop/wall behind the tabletop to a vibrant red studio backdrop with a subtle, soft texture. Keep the tabletop surface, its shadows, and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'backdrops/backdrop-studio-red',
        70
    ),
    (
        'studio-grey-white',
        'Studio grey-white',
        'Neutral grey-white studio backdrop',
        'backdrop',
        'Change only the vertical backdrop/wall behind the tabletop to a seamless, neutral grey-white studio backdrop with soft, professional studio lighting falloff. Keep the tabletop surface, its shadows, and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'backdrops/backdrop-grey-white',
        80
    ),
    (
        'studio-yellow',
        'Studio yellow',
        'Vibrant yellow studio backdrop',
        'backdrop',
        'Change only the vertical backdrop/wall behind the tabletop to a vibrant, solid yellow studio backdrop with soft, professional studio lighting falloff. Keep the tabletop surface, its shadows, and the dish itself completely locked.',
        'Do not change the dish, vessel, or food. Do not add props, cutlery, napkins, or clutter.',
        'backdrops/backdrop-studio-yellow',
        90
    )
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    category = EXCLUDED.category,
    prompt_fragment = EXCLUDED.prompt_fragment,
    negative_constraints = EXCLUDED.negative_constraints,
    thumbnail_path = EXCLUDED.thumbnail_path,
    sort_order = EXCLUDED.sort_order;
