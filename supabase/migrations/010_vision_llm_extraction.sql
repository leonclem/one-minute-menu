-- Migration: Rename ocr_jobs to menu_extraction_jobs and add vision-LLM fields
-- This migration enhances the extraction system to support vision-LLM extraction
-- with schema versioning, prompt versioning, and comprehensive tracking

-- Step 1: Rename ocr_jobs table to menu_extraction_jobs (if not already renamed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'ocr_jobs' AND schemaname = 'public') THEN
        ALTER TABLE ocr_jobs RENAME TO menu_extraction_jobs;
    END IF;
END $$;

-- Step 2: Rename existing indexes to match new table name (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ocr_jobs_status') THEN
        ALTER INDEX idx_ocr_jobs_status RENAME TO idx_menu_extraction_jobs_status;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ocr_jobs_user_id') THEN
        ALTER INDEX idx_ocr_jobs_user_id RENAME TO idx_menu_extraction_jobs_user_id;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ocr_jobs_image_hash') THEN
        ALTER INDEX idx_ocr_jobs_image_hash RENAME TO idx_menu_extraction_jobs_image_hash;
    END IF;
END $$;

-- Step 3: Rename triggers and functions
DROP TRIGGER IF EXISTS ocr_jobs_notify_insert ON menu_extraction_jobs;
DROP TRIGGER IF EXISTS ocr_jobs_notify_update ON menu_extraction_jobs;

-- Rename function if it exists, otherwise create it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'notify_ocr_jobs') THEN
        ALTER FUNCTION notify_ocr_jobs() RENAME TO notify_menu_extraction_jobs;
    END IF;
END $$;

-- Create the function if it doesn't exist (handles both renamed and new cases)
CREATE OR REPLACE FUNCTION notify_menu_extraction_jobs()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('menu_extraction_jobs', json_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER menu_extraction_jobs_notify_insert
    AFTER INSERT ON menu_extraction_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_menu_extraction_jobs();

CREATE TRIGGER menu_extraction_jobs_notify_update
    AFTER UPDATE ON menu_extraction_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_menu_extraction_jobs();

-- Step 4: Update realtime publication (if it exists)
DO $$
BEGIN
    -- Try to drop ocr_jobs from publication if it exists
    IF EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'ocr_jobs'
    ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE ocr_jobs;
    END IF;
    
    -- Add menu_extraction_jobs to publication if not already there
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'menu_extraction_jobs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE menu_extraction_jobs;
    END IF;
END $$;

-- Step 5: Add new fields to menu_extraction_jobs (if they don't exist)
ALTER TABLE menu_extraction_jobs 
  ADD COLUMN IF NOT EXISTS schema_version VARCHAR(20) DEFAULT 'stage1',
  ADD COLUMN IF NOT EXISTS prompt_version VARCHAR(50) DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS token_usage JSONB, -- { inputTokens, outputTokens, estimatedCost }
  ADD COLUMN IF NOT EXISTS confidence REAL, -- Overall confidence score (0.0-1.0)
  ADD COLUMN IF NOT EXISTS uncertain_items JSONB, -- Array of uncertain items
  ADD COLUMN IF NOT EXISTS superfluous_text JSONB; -- Array of decorative/non-menu text

-- Step 6: Add comments for documentation
COMMENT ON COLUMN menu_extraction_jobs.schema_version IS 'Schema version used for extraction (stage1 or stage2)';
COMMENT ON COLUMN menu_extraction_jobs.prompt_version IS 'Version of the extraction prompt used';
COMMENT ON COLUMN menu_extraction_jobs.image_hash IS 'SHA-256 hash for idempotency checks';
COMMENT ON COLUMN menu_extraction_jobs.token_usage IS 'JSON object with inputTokens, outputTokens, and estimatedCost';
COMMENT ON COLUMN menu_extraction_jobs.confidence IS 'Overall confidence score from 0.0 to 1.0';
COMMENT ON COLUMN menu_extraction_jobs.uncertain_items IS 'Array of items that need manual review';
COMMENT ON COLUMN menu_extraction_jobs.superfluous_text IS 'Array of decorative text filtered out';

-- Step 7: Create index for prompt_version (for A/B testing and analysis)
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_prompt_version 
  ON menu_extraction_jobs(prompt_version);

-- Step 8: Create index for schema_version
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_schema_version 
  ON menu_extraction_jobs(schema_version);

-- Step 9: Create extraction_prompt_metrics table for tracking prompt performance
CREATE TABLE IF NOT EXISTS extraction_prompt_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_version VARCHAR(50) NOT NULL,
  schema_version VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  
  -- Aggregated metrics
  total_extractions INTEGER DEFAULT 0,
  average_confidence REAL,
  average_processing_time INTEGER, -- milliseconds
  average_token_usage INTEGER,
  average_cost REAL,
  manual_correction_rate REAL, -- % of items corrected
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(prompt_version, schema_version, date)
);

-- Add comments for extraction_prompt_metrics
COMMENT ON TABLE extraction_prompt_metrics IS 'Aggregated metrics for tracking extraction prompt performance';
COMMENT ON COLUMN extraction_prompt_metrics.manual_correction_rate IS 'Percentage of extractions that required manual corrections';

-- Enable RLS on extraction_prompt_metrics
ALTER TABLE extraction_prompt_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view metrics (for now, allow all authenticated users to view)
DROP POLICY IF EXISTS "Authenticated users can view prompt metrics" ON extraction_prompt_metrics;
CREATE POLICY "Authenticated users can view prompt metrics" ON extraction_prompt_metrics 
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policy: Only service role can insert/update metrics
DROP POLICY IF EXISTS "Service role can manage prompt metrics" ON extraction_prompt_metrics;
CREATE POLICY "Service role can manage prompt metrics" ON extraction_prompt_metrics 
  FOR ALL
  USING (auth.role() = 'service_role');

-- Step 10: Create extraction_feedback table for user feedback
CREATE TABLE IF NOT EXISTS extraction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES menu_extraction_jobs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('system_error', 'menu_unclear', 'excellent', 'needs_improvement')),
  item_id VARCHAR(100), -- Which item had issues (optional)
  correction_made TEXT, -- What the user corrected
  comment TEXT, -- Additional user comments
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for extraction_feedback
COMMENT ON TABLE extraction_feedback IS 'User feedback on extraction quality for continuous improvement';
COMMENT ON COLUMN extraction_feedback.feedback_type IS 'Type of feedback: system_error, menu_unclear, excellent, needs_improvement';
COMMENT ON COLUMN extraction_feedback.item_id IS 'Identifier of the specific menu item that had issues';

-- Enable RLS on extraction_feedback
ALTER TABLE extraction_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON extraction_feedback;
CREATE POLICY "Users can view own feedback" ON extraction_feedback 
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can submit their own feedback
DROP POLICY IF EXISTS "Users can submit own feedback" ON extraction_feedback;
CREATE POLICY "Users can submit own feedback" ON extraction_feedback 
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own feedback
DROP POLICY IF EXISTS "Users can update own feedback" ON extraction_feedback;
CREATE POLICY "Users can update own feedback" ON extraction_feedback 
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own feedback
DROP POLICY IF EXISTS "Users can delete own feedback" ON extraction_feedback;
CREATE POLICY "Users can delete own feedback" ON extraction_feedback 
  FOR DELETE
  USING (auth.uid() = user_id);

-- Step 11: Create indexes for extraction_feedback
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_job_id ON extraction_feedback(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_user_id ON extraction_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_type ON extraction_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_extraction_feedback_created_at ON extraction_feedback(created_at);

-- Step 12: Create indexes for extraction_prompt_metrics
CREATE INDEX IF NOT EXISTS idx_extraction_prompt_metrics_date ON extraction_prompt_metrics(date);
CREATE INDEX IF NOT EXISTS idx_extraction_prompt_metrics_prompt_version ON extraction_prompt_metrics(prompt_version);
CREATE INDEX IF NOT EXISTS idx_extraction_prompt_metrics_schema_version ON extraction_prompt_metrics(schema_version);

-- Step 13: Update the notify function to use new channel name
CREATE OR REPLACE FUNCTION notify_menu_extraction_jobs()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('menu_extraction_jobs', json_build_object(
        'id', NEW.id,
        'status', NEW.status,
        'user_id', NEW.user_id,
        'schema_version', NEW.schema_version,
        'confidence', NEW.confidence
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Create function to update metrics timestamp
CREATE OR REPLACE FUNCTION update_extraction_prompt_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating metrics timestamp
DROP TRIGGER IF EXISTS update_extraction_prompt_metrics_timestamp ON extraction_prompt_metrics;
CREATE TRIGGER update_extraction_prompt_metrics_timestamp
    BEFORE UPDATE ON extraction_prompt_metrics
    FOR EACH ROW EXECUTE FUNCTION update_extraction_prompt_metrics_timestamp();

-- Verification queries
SELECT 'Migration completed successfully!' as status;
SELECT 'menu_extraction_jobs table: ' || tablename as table_status 
FROM pg_tables WHERE tablename = 'menu_extraction_jobs' AND schemaname = 'public';
SELECT 'extraction_prompt_metrics table: ' || tablename as table_status 
FROM pg_tables WHERE tablename = 'extraction_prompt_metrics' AND schemaname = 'public';
SELECT 'extraction_feedback table: ' || tablename as table_status 
FROM pg_tables WHERE tablename = 'extraction_feedback' AND schemaname = 'public';
