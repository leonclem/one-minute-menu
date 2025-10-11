-- Template System Schema Migration
-- Adds support for AI-enhanced menu templates with background generation

-- ============================================================================
-- 1. Extend menus table for template support
-- ============================================================================

-- Add template-related columns to menus table
ALTER TABLE menus ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS template_version TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS background_url TEXT;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS template_config JSONB;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS render_metadata JSONB;

-- Add indexes for template lookups
CREATE INDEX IF NOT EXISTS idx_menus_template_id ON menus(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menus_template_version ON menus(template_id, template_version) WHERE template_id IS NOT NULL;

-- Add GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_menus_template_config_gin ON menus USING GIN (template_config) WHERE template_config IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menus_render_metadata_gin ON menus USING GIN (render_metadata) WHERE render_metadata IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN menus.template_id IS 'ID of the applied template (e.g., kraft-sports, minimal-bistro)';
COMMENT ON COLUMN menus.template_version IS 'Version of the template for migration support';
COMMENT ON COLUMN menus.background_url IS 'URL to AI-generated or fallback background image';
COMMENT ON COLUMN menus.template_config IS 'Template configuration including custom colors and override settings';
COMMENT ON COLUMN menus.render_metadata IS 'Applied policies, pagination points, warnings for reproducible exports';

-- ============================================================================
-- 2. Create background_generation_jobs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS background_generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    template_id TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of template_id + brand_colors for deduplication
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
    brand_colors JSONB, -- Array of brand colors extracted from brand image
    result_url TEXT, -- URL to generated background in storage
    error_message TEXT,
    generation_time INTEGER, -- in milliseconds
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Unique constraint for idempotency based on content hash
    UNIQUE(content_hash)
);

-- Enable RLS on background_generation_jobs
ALTER TABLE background_generation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for background_generation_jobs
CREATE POLICY "Users can view own background jobs" ON background_generation_jobs 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own background jobs" ON background_generation_jobs 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own background jobs" ON background_generation_jobs 
    FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for job status queries and lookups
CREATE INDEX IF NOT EXISTS idx_bg_jobs_status ON background_generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_user_id ON background_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_menu_id ON background_generation_jobs(menu_id);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_content_hash ON background_generation_jobs(content_hash);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_template_id ON background_generation_jobs(template_id);
CREATE INDEX IF NOT EXISTS idx_bg_jobs_created_at ON background_generation_jobs(created_at);

-- GIN index for brand_colors JSONB queries
CREATE INDEX IF NOT EXISTS idx_bg_jobs_brand_colors_gin ON background_generation_jobs USING GIN (brand_colors) WHERE brand_colors IS NOT NULL;

-- Enable realtime for background job updates
ALTER PUBLICATION supabase_realtime ADD TABLE background_generation_jobs;

-- Comments for documentation
COMMENT ON TABLE background_generation_jobs IS 'Queue for AI background generation with deduplication via content hash';
COMMENT ON COLUMN background_generation_jobs.content_hash IS 'SHA-256 hash of template_id + brand_colors for deduplication';
COMMENT ON COLUMN background_generation_jobs.status IS 'Job status: queued → generating → ready|failed';
COMMENT ON COLUMN background_generation_jobs.result_url IS 'URL to generated background: backgrounds/{templateId}/{hash}.webp';

-- ============================================================================
-- 3. Create storage buckets for templates, backgrounds, and fonts
-- ============================================================================

-- Templates bucket (public read for template assets and reference images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'templates',
  'templates',
  true, -- Public bucket for template descriptors and reference images
  10485760, -- 10MB limit (10 * 1024 * 1024)
  ARRAY['application/json', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Backgrounds bucket (private with signed URLs for AI-generated backgrounds)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'backgrounds',
  'backgrounds',
  false, -- Private bucket, use signed URLs
  20971520, -- 20MB limit (20 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Fonts bucket (private for licensed fonts with signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fonts',
  'fonts',
  false, -- Private bucket for licensed fonts
  5242880, -- 5MB limit (5 * 1024 * 1024)
  ARRAY['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/x-font-ttf', 'application/x-font-otf']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. Storage policies for new buckets
-- ============================================================================

-- Templates bucket policies (public read, admin write)
CREATE POLICY "Public can view templates" ON storage.objects
  FOR SELECT USING (bucket_id = 'templates');

-- Only allow authenticated users to upload templates (can be restricted to admin later)
CREATE POLICY "Authenticated users can upload templates" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'templates' AND
    auth.role() = 'authenticated'
  );

-- Backgrounds bucket policies (private with ownership verification)
CREATE POLICY "Users can upload their own backgrounds" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'backgrounds' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own backgrounds" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'backgrounds' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own backgrounds" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'backgrounds' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own backgrounds" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'backgrounds' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Fonts bucket policies (private, admin only for now)
CREATE POLICY "Authenticated users can view fonts" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fonts' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can upload fonts" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fonts' AND
    auth.role() = 'authenticated'
  );

-- ============================================================================
-- 5. Helper functions for template system
-- ============================================================================

-- Function to clean up old background generation jobs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_background_jobs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM background_generation_jobs
    WHERE completed_at < NOW() - INTERVAL '30 days'
    AND status IN ('ready', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_old_background_jobs() IS 'Cleans up background generation jobs older than 30 days';

-- Function to get or create background job by content hash (for deduplication)
CREATE OR REPLACE FUNCTION get_or_create_background_job(
    p_user_id UUID,
    p_menu_id UUID,
    p_template_id TEXT,
    p_content_hash VARCHAR(64),
    p_brand_colors JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_existing_job RECORD;
BEGIN
    -- Check if a job with this content hash already exists
    SELECT id, status, result_url INTO v_existing_job
    FROM background_generation_jobs
    WHERE content_hash = p_content_hash
    LIMIT 1;
    
    -- If job exists and is ready, return it
    IF FOUND AND v_existing_job.status = 'ready' THEN
        RETURN v_existing_job.id;
    END IF;
    
    -- If job exists but is queued or generating, return it
    IF FOUND AND v_existing_job.status IN ('queued', 'generating') THEN
        RETURN v_existing_job.id;
    END IF;
    
    -- Otherwise, create a new job
    INSERT INTO background_generation_jobs (
        user_id,
        menu_id,
        template_id,
        content_hash,
        brand_colors,
        status
    ) VALUES (
        p_user_id,
        p_menu_id,
        p_template_id,
        p_content_hash,
        p_brand_colors,
        'queued'
    )
    ON CONFLICT (content_hash) DO UPDATE
    SET menu_id = EXCLUDED.menu_id,
        updated_at = NOW()
    RETURNING id INTO v_job_id;
    
    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_or_create_background_job IS 'Gets existing background job or creates new one with deduplication via content hash';

-- ============================================================================
-- 6. Triggers for automatic timestamp updates
-- ============================================================================

-- Add updated_at column to background_generation_jobs if not exists
ALTER TABLE background_generation_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Trigger for automatic timestamp updates on background_generation_jobs
CREATE TRIGGER update_background_jobs_updated_at 
    BEFORE UPDATE ON background_generation_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration complete
-- ============================================================================
