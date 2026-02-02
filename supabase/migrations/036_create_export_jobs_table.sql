-- Migration: Create export_jobs table for Railway Workers feature
-- This table stores asynchronous PDF and image export jobs processed by Railway workers

-- Create export_jobs table
CREATE TABLE export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL CHECK (export_type IN ('pdf', 'image')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER NOT NULL DEFAULT 10,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  file_url TEXT,
  storage_path TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  worker_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Composite index for efficient job polling with priority queue and backoff support
-- This index supports: WHERE status = 'pending' AND available_at <= NOW() ORDER BY priority DESC, created_at ASC
CREATE INDEX idx_export_jobs_queue 
ON export_jobs (status, available_at, priority DESC, created_at ASC)
WHERE status = 'pending';

-- Index for user job history queries
CREATE INDEX idx_export_jobs_user_history 
ON export_jobs (user_id, created_at DESC);

-- Index for cleanup operations (deleting old files)
CREATE INDEX idx_export_jobs_cleanup 
ON export_jobs (created_at)
WHERE status = 'completed';

-- Index for stale job detection
CREATE INDEX idx_export_jobs_stale 
ON export_jobs (status, started_at)
WHERE status = 'processing';

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at trigger
CREATE TRIGGER update_export_jobs_updated_at
BEFORE UPDATE ON export_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY export_jobs_select_own
ON export_jobs FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert jobs for themselves
CREATE POLICY export_jobs_insert_own
ON export_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users cannot update jobs (only workers can via service role)
CREATE POLICY export_jobs_no_user_update
ON export_jobs FOR UPDATE
USING (false);

-- Users cannot delete jobs
CREATE POLICY export_jobs_no_user_delete
ON export_jobs FOR DELETE
USING (false);

-- Service role can do everything (workers use service role key)
CREATE POLICY export_jobs_service_role_all
ON export_jobs FOR ALL
USING (auth.role() = 'service_role');

-- Enable Supabase Realtime for export_jobs table
-- This allows real-time status updates to be pushed to clients
ALTER PUBLICATION supabase_realtime ADD TABLE export_jobs;

-- Add helpful comments
COMMENT ON TABLE export_jobs IS 'Asynchronous export jobs for PDF and image generation, processed by Railway workers';
COMMENT ON COLUMN export_jobs.available_at IS 'Timestamp when job becomes available for processing (supports retry backoff)';
COMMENT ON COLUMN export_jobs.storage_path IS 'Deterministic storage path for idempotent uploads';
COMMENT ON COLUMN export_jobs.priority IS 'Job priority: 100 for subscribers, 10 for free users';
COMMENT ON COLUMN export_jobs.retry_count IS 'Number of retry attempts (max 3)';
COMMENT ON COLUMN export_jobs.metadata IS 'JSONB field for render snapshot and additional metadata';
