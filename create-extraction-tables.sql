-- Create the missing extraction tables

CREATE TABLE IF NOT EXISTS menu_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    image_urls TEXT[] NOT NULL,
    extraction_method TEXT NOT NULL CHECK (extraction_method IN ('vision_llm', 'ocr_legacy')),
    result JSONB,
    error_message TEXT,
    processing_time INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_user ON menu_extraction_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_menu ON menu_extraction_jobs(menu_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON menu_extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_created ON menu_extraction_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE menu_extraction_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users manage own extraction jobs" ON menu_extraction_jobs;
CREATE POLICY "Users manage own extraction jobs" ON menu_extraction_jobs 
  FOR ALL USING (user_id = auth.uid());

-- Verify
SELECT 'menu_extraction_jobs table created' as status;
