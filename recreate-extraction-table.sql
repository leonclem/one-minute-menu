-- Simple: Drop and recreate menu_extraction_jobs with all columns

DROP TABLE IF EXISTS menu_extraction_jobs CASCADE;

CREATE TABLE menu_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    image_url TEXT NOT NULL,
    image_urls TEXT[] NOT NULL DEFAULT '{}',
    image_hash TEXT,
    extraction_method TEXT NOT NULL CHECK (extraction_method IN ('vision_llm', 'ocr_legacy')),
    schema_version VARCHAR(20) DEFAULT 'stage1',
    prompt_version VARCHAR(50) DEFAULT 'v1.0',
    result JSONB,
    token_usage JSONB,
    confidence DECIMAL(3,2),
    uncertain_items JSONB DEFAULT '[]',
    superfluous_text JSONB DEFAULT '[]',
    error_message TEXT,
    processing_time INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_menu_extraction_jobs_user ON menu_extraction_jobs(user_id);
CREATE INDEX idx_menu_extraction_jobs_menu ON menu_extraction_jobs(menu_id);
CREATE INDEX idx_menu_extraction_jobs_status ON menu_extraction_jobs(status);
CREATE INDEX idx_menu_extraction_jobs_created ON menu_extraction_jobs(created_at DESC);
CREATE INDEX idx_menu_extraction_jobs_image_hash ON menu_extraction_jobs(image_hash) WHERE image_hash IS NOT NULL;

-- Enable RLS
ALTER TABLE menu_extraction_jobs ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users manage own extraction jobs" ON menu_extraction_jobs 
  FOR ALL USING (user_id = auth.uid());

-- Verify
SELECT 'menu_extraction_jobs created with ' || COUNT(*) || ' columns' as status
FROM information_schema.columns 
WHERE table_name = 'menu_extraction_jobs';
