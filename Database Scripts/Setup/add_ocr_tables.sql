-- Add OCR functionality tables

-- Create OCR Jobs table (for image processing queue)
CREATE TABLE IF NOT EXISTS ocr_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for idempotency
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    result JSONB,
    error_message TEXT,
    processing_time INTEGER, -- in milliseconds
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on ocr_jobs
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ocr_jobs
CREATE POLICY "Users can view own OCR jobs" ON ocr_jobs 
    USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_image_hash ON ocr_jobs(image_hash);

-- Create function for OCR job notifications (for worker)
CREATE OR REPLACE FUNCTION notify_ocr_jobs()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('ocr_jobs', json_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for OCR job notifications
DROP TRIGGER IF EXISTS ocr_jobs_notify_insert ON ocr_jobs;
CREATE TRIGGER ocr_jobs_notify_insert
    AFTER INSERT ON ocr_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_ocr_jobs();

DROP TRIGGER IF EXISTS ocr_jobs_notify_update ON ocr_jobs;
CREATE TRIGGER ocr_jobs_notify_update
    AFTER UPDATE ON ocr_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_ocr_jobs();

-- Enable realtime for OCR job updates
ALTER PUBLICATION supabase_realtime ADD TABLE ocr_jobs;

-- Create other missing tables that might be needed

-- Menu Versions (for rollback functionality)
CREATE TABLE IF NOT EXISTS menu_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    version INTEGER NOT NULL,
    menu_data JSONB NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(menu_id, version)
);

-- Enable RLS on menu_versions
ALTER TABLE menu_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_versions
CREATE POLICY "Users can view own menu versions" ON menu_versions 
    USING (auth.uid() = (SELECT user_id FROM menus WHERE id = menu_id));

-- Menu Audit (for tracking changes)
CREATE TABLE IF NOT EXISTS menu_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'published', 'reverted', 'deleted')),
    changes JSONB,
    version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on menu_audit
ALTER TABLE menu_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_audit
CREATE POLICY "Users can view own menu audit" ON menu_audit 
    USING (auth.uid() = user_id);

-- Reserved slugs to prevent conflicts
CREATE TABLE IF NOT EXISTS reserved_slugs (
    slug VARCHAR(255) PRIMARY KEY,
    reason VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert system reserved slugs
INSERT INTO reserved_slugs (slug, reason) VALUES 
    ('admin', 'system'),
    ('api', 'system'),
    ('app', 'system'),
    ('support', 'system'),
    ('help', 'system'),
    ('about', 'system'),
    ('privacy', 'system'),
    ('terms', 'system'),
    ('login', 'system'),
    ('signup', 'system'),
    ('dashboard', 'system'),
    ('settings', 'system'),
    ('profile', 'system'),
    ('billing', 'system'),
    ('upgrade', 'system'),
    -- Major brand protection
    ('mcdonalds', 'brand protection'),
    ('kfc', 'brand protection'),
    ('subway', 'brand protection'),
    ('starbucks', 'brand protection'),
    ('pizzahut', 'brand protection'),
    ('dominos', 'brand protection'),
    ('burgerking', 'brand protection')
ON CONFLICT (slug) DO NOTHING;

-- Add additional indexes
CREATE INDEX IF NOT EXISTS idx_menu_versions_menu_id ON menu_versions(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_audit_menu_id ON menu_audit(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_audit_user_id ON menu_audit(user_id);

-- Verify OCR setup
SELECT 'OCR tables created successfully!' as status;
SELECT 'OCR jobs table: ' || tablename as table_status 
FROM pg_tables WHERE tablename = 'ocr_jobs' AND schemaname = 'public';