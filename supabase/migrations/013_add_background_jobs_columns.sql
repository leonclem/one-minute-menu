-- Add missing columns to background_generation_jobs table
-- These columns are needed for proper job tracking and quota management

-- Add error_code column for structured error handling
ALTER TABLE background_generation_jobs 
ADD COLUMN IF NOT EXISTS error_code VARCHAR(50);

-- Add started_at column to track when job processing began
ALTER TABLE background_generation_jobs 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- Add quota_consumed flag to prevent double-charging
ALTER TABLE background_generation_jobs 
ADD COLUMN IF NOT EXISTS quota_consumed BOOLEAN DEFAULT FALSE;

-- Add index for quota_consumed queries
CREATE INDEX IF NOT EXISTS idx_bg_jobs_quota_consumed 
ON background_generation_jobs(quota_consumed) 
WHERE quota_consumed = FALSE;

-- Comments for documentation
COMMENT ON COLUMN background_generation_jobs.error_code IS 'Structured error code for failed jobs (e.g., GENERATION_FAILED, QUOTA_EXCEEDED)';
COMMENT ON COLUMN background_generation_jobs.started_at IS 'Timestamp when job processing started';
COMMENT ON COLUMN background_generation_jobs.quota_consumed IS 'Flag to prevent double-charging quota for the same job';
