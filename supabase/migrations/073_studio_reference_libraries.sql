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

INSERT INTO studio_lighting_styles
    (key, name, short_description, prompt_fragment, negative_constraints, thumbnail_path, sort_order)
VALUES
    (
        'bright-and-airy',
        'Bright & Airy',
        'Clean high-key diffused light',
        'Change the lighting to bright-and-airy high-key diffused light. Remove heavy shadows and keep the scene clean, bright, and airy.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'light-natural',
        10
    ),
    (
        'low-key',
        'Low-Key / Dramatic',
        'Richer shadows and moody contrast',
        'Change the lighting to low-key dramatic light. Add richer shadows and a darker, moodier background while keeping the dish readable.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'light-moody',
        20
    ),
    (
        'soft-natural-window',
        'Soft Natural Window Light',
        'Gentle side window illumination',
        'Change the lighting to soft natural window light: gentle directional daylight from one side, soft falloff, natural colour temperature, and subtle shadows. Keep the dish readable and appetising.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel. Do not invent windows or architecture unless already present.',
        'light-soft-window',
        30
    ),
    (
        'clean-delivery',
        'Clean Delivery App Lighting',
        'Even, app-menu friendly light',
        'Change the lighting to clean delivery-app lighting: even, flattering, slightly cool-neutral illumination with minimal harsh shadows so the dish reads clearly at small thumbnail size.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'light-delivery',
        40
    ),
    (
        'warm-restaurant',
        'Warm Restaurant Ambient',
        'Warm ambient dining light',
        'Change the lighting to warm restaurant ambient light: soft warm colour temperature, gentle ambient fill, and inviting dinner-table mood while keeping the food colours accurate.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'light-warm-restaurant',
        50
    ),
    (
        'studio',
        'Premium Editorial / Studio',
        'Polished commercial studio light',
        'Change the lighting to clean commercial studio lighting: even, controlled key light with soft fill, neutral colour temperature, and a polished menu-photo look. Do not change the dish or add props.',
        'Do not add props, ingredients, hands, text, or logos. Do not change the dish or vessel.',
        'light-studio',
        60
    )
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed: 8 background/surface styles (§7.5)
-- ---------------------------------------------------------------------------

INSERT INTO studio_background_styles
    (key, name, short_description, category, prompt_fragment, negative_constraints, thumbnail_path, sort_order)
VALUES
    (
        'clean-white-studio',
        'Clean White Studio',
        'Seamless white studio surface',
        'surface',
        'Change only the background/surface to a clean seamless white studio surface. Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-clean-white',
        10
    ),
    (
        'warm-beige-ceramic',
        'Warm Beige Ceramic',
        'Warm beige ceramic tabletop',
        'surface',
        'Change only the background/surface to a warm beige ceramic tabletop with soft natural texture. Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-warm-beige',
        20
    ),
    (
        'dark-slate',
        'Dark Slate',
        'Dark slate stone surface',
        'surface',
        'Change only the background/surface to a dark slate stone surface with subtle natural texture. Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-dark-slate',
        30
    ),
    (
        'rustic-wood',
        'Rustic Wood',
        'Rustic wooden tabletop',
        'surface',
        'Change only the background/surface to a rustic wood tabletop with natural grain. Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-rustic-wood',
        40
    ),
    (
        'marble-counter',
        'Marble Counter',
        'Light marble countertop',
        'surface',
        'Change only the background/surface to a light marble countertop with subtle veining. Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-marble',
        50
    ),
    (
        'neutral-delivery',
        'Neutral Delivery Background',
        'Neutral solid delivery-app backdrop',
        'backdrop',
        'Change only the background to a clean neutral delivery-app backdrop (soft light grey, seamless, distraction-free). Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-neutral-delivery',
        60
    ),
    (
        'premium-dark-restaurant',
        'Premium Dark Restaurant',
        'Dark premium restaurant surface',
        'surface',
        'Change only the background/surface to a premium dark restaurant surface (deep charcoal / black with soft falloff). Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-premium-dark',
        70
    ),
    (
        'bright-cafe-table',
        'Bright Café Table',
        'Bright light café tabletop',
        'surface',
        'Change only the background/surface to a bright café tabletop (light wood or pale laminate, airy). Keep the dish, vessel, food count, and core food appearance locked. Do not add props, cutlery, napkins, or clutter.',
        'Do not change the dish, vessel, or food. Do not add props, hands, text, or logos.',
        'bg-bright-cafe',
        80
    )
ON CONFLICT (key) DO NOTHING;
