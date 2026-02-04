-- Migration 046: Update menu_extraction_jobs for worker processing and add claim function
-- This migration adds worker-related columns to menu_extraction_jobs and
-- implements an atomic claiming function for background processing.

-- Step 1: Add worker-related columns to menu_extraction_jobs
ALTER TABLE menu_extraction_jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- Step 2: Add indexes for worker processing
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_worker_id ON menu_extraction_jobs(worker_id);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_available_at ON menu_extraction_jobs(available_at);
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_priority_created ON menu_extraction_jobs(priority DESC, created_at ASC);

-- Step 3: Add comments
COMMENT ON COLUMN menu_extraction_jobs.worker_id IS 'ID of the worker currently processing this job';
COMMENT ON COLUMN menu_extraction_jobs.started_at IS 'Timestamp when processing started';
COMMENT ON COLUMN menu_extraction_jobs.available_at IS 'Timestamp when the job becomes available for processing (used for retry backoff)';
COMMENT ON COLUMN menu_extraction_jobs.priority IS 'Job priority (higher values processed first)';

-- Step 4: Create atomic job claiming function
CREATE OR REPLACE FUNCTION claim_menu_extraction_job(p_worker_id TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  menu_id UUID,
  image_url TEXT,
  image_hash TEXT,
  status TEXT,
  schema_version TEXT,
  prompt_version TEXT,
  retry_count INTEGER,
  priority INTEGER,
  worker_id TEXT,
  available_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_job_id UUID;
BEGIN
  -- Atomically claim one job with priority queue ordering and backoff support
  -- We only claim jobs in 'queued' status
  SELECT menu_extraction_jobs.id INTO claimed_job_id
  FROM menu_extraction_jobs
  WHERE menu_extraction_jobs.status = 'queued'
    AND menu_extraction_jobs.available_at <= NOW()
  ORDER BY menu_extraction_jobs.priority DESC, menu_extraction_jobs.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no job found, return empty result
  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Update the claimed job to processing status
  UPDATE menu_extraction_jobs
  SET 
    status = 'processing',
    worker_id = p_worker_id,
    started_at = NOW(),
    updated_at = NOW()
  WHERE menu_extraction_jobs.id = claimed_job_id;

  -- Return the claimed job
  RETURN QUERY
  SELECT 
    m.id,
    m.user_id,
    m.menu_id,
    m.image_url,
    m.image_hash,
    m.status::TEXT,
    m.schema_version::TEXT,
    m.prompt_version::TEXT,
    m.retry_count,
    m.priority,
    m.worker_id,
    m.available_at,
    m.created_at,
    m.updated_at,
    m.started_at
  FROM menu_extraction_jobs m
  WHERE m.id = claimed_job_id;
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION claim_menu_extraction_job(TEXT) TO authenticated, service_role;

-- Step 6: Add comment to function
COMMENT ON FUNCTION claim_menu_extraction_job IS 'Atomically claims one queued menu extraction job for processing by a worker. Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions. Respects available_at timestamp for retry backoff.';
