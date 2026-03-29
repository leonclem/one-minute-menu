-- ============================================================================
-- Cut-Out Feature Migration
-- Adds background-removal cut-out support for AI-generated food images
-- ============================================================================

-- ============================================================================
-- 1. Extend ai_generated_images with cut-out fields
-- ============================================================================

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_url VARCHAR(500);
COMMENT ON COLUMN ai_generated_images.cutout_url IS 'URL of the transparent-background cut-out PNG asset';

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_status VARCHAR(20) DEFAULT 'not_requested';
COMMENT ON COLUMN ai_generated_images.cutout_status IS 'Status of cut-out generation: not_requested, pending, processing (worker claimed), succeeded, failed, timed_out';

-- Add CHECK constraint separately for idempotency (ALTER TABLE ADD COLUMN IF NOT EXISTS doesn't support inline CHECK well for existing columns)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_generated_images_cutout_status_check'
    ) THEN
        ALTER TABLE ai_generated_images
            ADD CONSTRAINT ai_generated_images_cutout_status_check
            CHECK (cutout_status IN ('not_requested', 'pending', 'processing', 'succeeded', 'failed', 'timed_out'));
    END IF;
END $$;

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_provider VARCHAR(50);
COMMENT ON COLUMN ai_generated_images.cutout_provider IS 'Name of the background-removal provider used';

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_model_version VARCHAR(100);
COMMENT ON COLUMN ai_generated_images.cutout_model_version IS 'Provider model/version string for the cut-out generation';

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_requested_at TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN ai_generated_images.cutout_requested_at IS 'Timestamp when cut-out generation was requested';

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_completed_at TIMESTAMP WITH TIME ZONE;
COMMENT ON COLUMN ai_generated_images.cutout_completed_at IS 'Timestamp when cut-out generation completed (success or failure)';

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_failure_reason TEXT;
COMMENT ON COLUMN ai_generated_images.cutout_failure_reason IS 'Error message/reason if cut-out generation failed';

ALTER TABLE ai_generated_images ADD COLUMN IF NOT EXISTS cutout_generation_log_id UUID;
COMMENT ON COLUMN ai_generated_images.cutout_generation_log_id IS 'FK to the cutout_generation_logs entry for this attempt';

-- Index for querying images by cut-out status
CREATE INDEX IF NOT EXISTS idx_ai_generated_images_cutout_status
    ON ai_generated_images(cutout_status);

-- Index for querying by requested_at for admin monitoring
CREATE INDEX IF NOT EXISTS idx_ai_generated_images_cutout_requested_at
    ON ai_generated_images(cutout_requested_at)
    WHERE cutout_requested_at IS NOT NULL;

-- ============================================================================
-- 2. Create cutout_generation_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cutout_generation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
    menu_item_id UUID,
    image_id UUID REFERENCES ai_generated_images(id) ON DELETE SET NULL,

    -- Source
    source_image_type VARCHAR(20) NOT NULL DEFAULT 'ai_generated'
        CHECK (source_image_type IN ('ai_generated', 'user_uploaded')),

    -- Provider
    provider_name VARCHAR(50) NOT NULL,
    provider_model_version VARCHAR(100),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'succeeded', 'failed', 'timed_out')),

    -- Metrics
    processing_duration_ms INTEGER,
    output_asset_created BOOLEAN DEFAULT false,

    -- Error info
    error_category VARCHAR(50),
    error_code VARCHAR(50),
    error_message TEXT,

    -- Timestamps
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE cutout_generation_logs IS 'Operational log of background-removal cut-out generation attempts for admin monitoring';
COMMENT ON COLUMN cutout_generation_logs.user_id IS 'User who triggered the image generation';
COMMENT ON COLUMN cutout_generation_logs.menu_id IS 'Menu containing the item whose image was processed';
COMMENT ON COLUMN cutout_generation_logs.menu_item_id IS 'Menu item whose image was processed';
COMMENT ON COLUMN cutout_generation_logs.image_id IS 'FK to the ai_generated_images entry';
COMMENT ON COLUMN cutout_generation_logs.source_image_type IS 'Type of source image: ai_generated or user_uploaded';
COMMENT ON COLUMN cutout_generation_logs.provider_name IS 'Background-removal provider used (e.g. photoroom, remove-bg)';
COMMENT ON COLUMN cutout_generation_logs.provider_model_version IS 'Provider model/version string';
COMMENT ON COLUMN cutout_generation_logs.status IS 'Request status: pending, succeeded, failed, timed_out';
COMMENT ON COLUMN cutout_generation_logs.processing_duration_ms IS 'Processing time in milliseconds';
COMMENT ON COLUMN cutout_generation_logs.output_asset_created IS 'Whether a cut-out asset was successfully created';
COMMENT ON COLUMN cutout_generation_logs.error_category IS 'Error category for troubleshooting (e.g. provider_unavailable, processing_failed)';
COMMENT ON COLUMN cutout_generation_logs.error_code IS 'Provider-specific error code';
COMMENT ON COLUMN cutout_generation_logs.error_message IS 'Human-readable error message';
COMMENT ON COLUMN cutout_generation_logs.requested_at IS 'Timestamp when cut-out generation was requested';
COMMENT ON COLUMN cutout_generation_logs.completed_at IS 'Timestamp when processing completed (success or failure)';

-- Indexes for admin filtering (Requirement 6)
CREATE INDEX IF NOT EXISTS idx_cutout_logs_requested_at ON cutout_generation_logs(requested_at);
CREATE INDEX IF NOT EXISTS idx_cutout_logs_status ON cutout_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_cutout_logs_provider ON cutout_generation_logs(provider_name);
CREATE INDEX IF NOT EXISTS idx_cutout_logs_user_id ON cutout_generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_cutout_logs_menu_id ON cutout_generation_logs(menu_id);
CREATE INDEX IF NOT EXISTS idx_cutout_logs_image_id ON cutout_generation_logs(image_id);

-- RLS
ALTER TABLE cutout_generation_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can view cutout logs" ON cutout_generation_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Service role can insert/update (used by backend)
CREATE POLICY "Service can manage cutout logs" ON cutout_generation_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. Create cutout_render_usage table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cutout_render_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Context
    menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
    menu_item_id UUID,
    template_id VARCHAR(100) NOT NULL,

    -- Decision
    image_source_used VARCHAR(20) NOT NULL
        CHECK (image_source_used IN ('cutout', 'original')),
    fallback_reason VARCHAR(50),

    -- Timestamps
    rendered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE cutout_render_usage IS 'Tracks whether cut-out or original image was used at render time for analytics';
COMMENT ON COLUMN cutout_render_usage.menu_id IS 'Menu that was rendered';
COMMENT ON COLUMN cutout_render_usage.menu_item_id IS 'Menu item whose image was rendered';
COMMENT ON COLUMN cutout_render_usage.template_id IS 'Template used for rendering';
COMMENT ON COLUMN cutout_render_usage.image_source_used IS 'Whether cutout or original image was used';
COMMENT ON COLUMN cutout_render_usage.fallback_reason IS 'Reason for falling back to original (if applicable)';
COMMENT ON COLUMN cutout_render_usage.rendered_at IS 'Timestamp of the render event';

-- Indexes for admin querying (Requirement 7.4)
CREATE INDEX IF NOT EXISTS idx_render_usage_rendered_at ON cutout_render_usage(rendered_at);
CREATE INDEX IF NOT EXISTS idx_render_usage_template_id ON cutout_render_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_render_usage_image_source ON cutout_render_usage(image_source_used);
CREATE INDEX IF NOT EXISTS idx_render_usage_menu_id ON cutout_render_usage(menu_id);

-- RLS
ALTER TABLE cutout_render_usage ENABLE ROW LEVEL SECURITY;

-- Admin-only read access
CREATE POLICY "Admins can view render usage" ON cutout_render_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Service role can insert (used by renderer)
CREATE POLICY "Service can insert render usage" ON cutout_render_usage
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4. Create feature_flags table
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE feature_flags IS 'Admin-configurable feature flags for runtime feature gating';
COMMENT ON COLUMN feature_flags.id IS 'Unique feature flag identifier (e.g. cutout_generation)';
COMMENT ON COLUMN feature_flags.enabled IS 'Whether the feature is currently enabled';
COMMENT ON COLUMN feature_flags.updated_at IS 'Timestamp of last update';
COMMENT ON COLUMN feature_flags.updated_by IS 'Admin user who last updated this flag';

-- RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Admins can manage feature flags
CREATE POLICY "Admins can manage feature flags" ON feature_flags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Service role can read flags (used by backend for feature gating)
CREATE POLICY "Service can read feature flags" ON feature_flags
    FOR SELECT USING (auth.role() = 'service_role');

-- Seed the cut-out feature flag (disabled by default)
INSERT INTO feature_flags (id, enabled)
VALUES ('cutout_generation', false)
ON CONFLICT (id) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Add FK from ai_generated_images.cutout_generation_log_id to cutout_generation_logs
-- ============================================================================

-- Add FK constraint (only after cutout_generation_logs table exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_ai_images_cutout_log'
    ) THEN
        ALTER TABLE ai_generated_images
            ADD CONSTRAINT fk_ai_images_cutout_log
            FOREIGN KEY (cutout_generation_log_id) REFERENCES cutout_generation_logs(id) ON DELETE SET NULL;
    END IF;
END $$;
