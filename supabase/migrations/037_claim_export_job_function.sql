-- Migration: Create atomic job claiming function
-- This function implements SELECT FOR UPDATE SKIP LOCKED for atomic job claiming
-- with support for retry backoff via available_at timestamp

CREATE OR REPLACE FUNCTION claim_export_job(p_worker_id TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  menu_id UUID,
  export_type TEXT,
  status TEXT,
  priority INTEGER,
  retry_count INTEGER,
  error_message TEXT,
  file_url TEXT,
  storage_path TEXT,
  available_at TIMESTAMPTZ,
  metadata JSONB,
  worker_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  claimed_job_id UUID;
BEGIN
  -- Atomically claim one job with priority queue ordering and backoff support
  SELECT export_jobs.id INTO claimed_job_id
  FROM export_jobs
  WHERE export_jobs.status = 'pending'
    AND export_jobs.available_at <= NOW()
  ORDER BY export_jobs.priority DESC, export_jobs.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no job found, return empty result
  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Update the claimed job to processing status
  UPDATE export_jobs
  SET 
    status = 'processing',
    worker_id = p_worker_id,
    started_at = NOW(),
    updated_at = NOW()
  WHERE export_jobs.id = claimed_job_id;

  -- Return the claimed job
  RETURN QUERY
  SELECT 
    export_jobs.id,
    export_jobs.user_id,
    export_jobs.menu_id,
    export_jobs.export_type,
    export_jobs.status,
    export_jobs.priority,
    export_jobs.retry_count,
    export_jobs.error_message,
    export_jobs.file_url,
    export_jobs.storage_path,
    export_jobs.available_at,
    export_jobs.metadata,
    export_jobs.worker_id,
    export_jobs.created_at,
    export_jobs.updated_at,
    export_jobs.started_at,
    export_jobs.completed_at
  FROM export_jobs
  WHERE export_jobs.id = claimed_job_id;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION claim_export_job(TEXT) TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION claim_export_job IS 'Atomically claims one pending export job for processing by a worker. Uses SELECT FOR UPDATE SKIP LOCKED to prevent race conditions. Respects available_at timestamp for retry backoff.';
