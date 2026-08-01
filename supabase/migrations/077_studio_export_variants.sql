-- ============================================================================
-- Migration 077: Studio export variants (channel-ready asset pack per hero image)
-- See .kiro/specs/studio-export/GridMenu_Studio_Export_Formats_Feature_Writeup_2026-07-31.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS studio_export_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dish_id UUID NOT NULL REFERENCES studio_dishes(id) ON DELETE CASCADE,

    -- The approved hero image this variant was derived from.
    source_image_id UUID NOT NULL REFERENCES studio_images(id) ON DELETE CASCADE,
    -- Optional intermediate the variant was derived from (e.g. Delivery Square
    -- reused for the PDF Menu Tile).
    parent_image_id UUID REFERENCES studio_images(id) ON DELETE SET NULL,

    variant_type VARCHAR(40) NOT NULL CHECK (variant_type IN (
        'delivery_square',
        'delivery_landscape',
        'instagram_feed',
        'pdf_menu_tile',
        'transparent_cutout'
    )),

    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    aspect_ratio VARCHAR(16) NOT NULL,
    file_type VARCHAR(8) NOT NULL CHECK (file_type IN ('jpg', 'png', 'webp')),

    status VARCHAR(20) NOT NULL DEFAULT 'empty' CHECK (status IN (
        'empty', 'queued', 'generating', 'ready', 'failed'
    )),

    storage_path VARCHAR(500),
    preview_url VARCHAR(500),

    generation_method VARCHAR(20) NOT NULL CHECK (generation_method IN (
        'crop_resize', 'ai_expand', 'ai_recompose', 'cutout'
    )),

    estimated_credits INTEGER NOT NULL DEFAULT 0 CHECK (estimated_credits >= 0),
    credits_charged INTEGER CHECK (credits_charged IS NULL OR credits_charged >= 0),

    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A ready variant must have a stored asset behind it.
    CONSTRAINT studio_export_variants_ready_has_asset CHECK (
        status <> 'ready' OR (storage_path IS NOT NULL AND preview_url IS NOT NULL)
    )
);

-- One variant row per format per hero image; regenerating overwrites in place.
CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_export_variants_source_type
    ON studio_export_variants (source_image_id, variant_type);

CREATE INDEX IF NOT EXISTS idx_studio_export_variants_user_dish
    ON studio_export_variants (user_id, dish_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_export_variants_in_flight
    ON studio_export_variants (updated_at)
    WHERE status IN ('queued', 'generating');

ALTER TABLE studio_export_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own studio export variants"
    ON studio_export_variants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studio export variants"
    ON studio_export_variants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own studio export variants"
    ON studio_export_variants FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own studio export variants"
    ON studio_export_variants FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON TABLE studio_export_variants IS
    'Channel-ready export assets derived from an approved Studio hero image.';
COMMENT ON COLUMN studio_export_variants.generation_method IS
    'crop_resize (deterministic, free) | ai_expand | ai_recompose | cutout (charged)';
COMMENT ON COLUMN studio_export_variants.estimated_credits IS
    'Credits quoted to the user before generating; 0 for deterministic exports.';
COMMENT ON COLUMN studio_export_variants.credits_charged IS
    'Credits actually debited once the asset was produced.';
