-- Complete fix for menu_extraction_jobs table
-- This handles both scenarios: table exists as ocr_jobs OR needs to be created fresh

-- Drop the incomplete table if it exists
DROP TABLE IF EXISTS menu_extraction_jobs CASCADE;

-- Check if ocr_jobs exists and rename it, otherwise create from scratch
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ocr_jobs') THEN
        -- Rename existing ocr_jobs table
        ALTER TABLE ocr_jobs RENAME TO menu_extraction_jobs;
        
        -- Add missing columns
        ALTER TABLE menu_extraction_jobs 
          ADD COLUMN IF NOT EXISTS image_url TEXT,
          ADD COLUMN IF NOT EXISTS image_hash TEXT,
          ADD COLUMN IF NOT EXISTS schema_version VARCHAR(20) DEFAULT 'stage1',
          ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(50) DEFAULT 'v1.0',
          ADD COLUMN IF NOT EXISTS token_usage JSONB,
          ADD COLUMN IF NOT EXISTS confidence DECIMAL(3,2),
          ADD COLUMN IF NOT EXISTS uncertain_items JSONB DEFAULT '[]',
          ADD COLUMN IF NOT EXISTS superfluous_text JSONB DEFAULT '[]';
    ELSE
        -- Create table from scratch with all required columns
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
    END IF;
END $$;

-- Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_user ON menu_extraction_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_menu ON menu_extraction_jobs(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_status ON menu_extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_created ON menu_extraction_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_image_hash ON menu_extraction_jobs(image_hash) WHERE image_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_prompt_version ON menu_extraction_jobs(prompt_version);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_schema_version ON menu_extraction_jobs(schema_version);

-- Enable RLS
ALTER TABLE menu_extraction_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Users manage own extraction jobs" ON menu_extraction_jobs;
CREATE POLICY "Users manage own extraction jobs" ON menu_extraction_jobs 
  FOR ALL USING (user_id = auth.uid());

-- Verify all columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_extraction_jobs'
ORDER BY ordinal_position;
