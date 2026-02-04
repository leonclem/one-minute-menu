-- Migration 048: Fix claim_menu_extraction_job return shape
-- Some DBs (especially those evolved from older ocr_jobs schemas) can hit:
--   "structure of query does not match function result type"
-- This migration replaces the function and explicitly casts each returned column
-- to match the RETURNS TABLE signature exactly.

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
  SELECT m.id
  INTO claimed_job_id
  FROM menu_extraction_jobs m
  WHERE m.status = 'queued'
    AND m.available_at <= NOW()
  ORDER BY m.priority DESC, m.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE menu_extraction_jobs
  SET
    status = 'processing',
    worker_id = p_worker_id,
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = claimed_job_id;

  RETURN QUERY
  SELECT
    m.id::UUID,
    m.user_id::UUID,
    m.menu_id::UUID,
    m.image_url::TEXT,
    m.image_hash::TEXT,
    m.status::TEXT,
    m.schema_version::TEXT,
    m.prompt_version::TEXT,
    m.retry_count::INTEGER,
    m.priority::INTEGER,
    m.worker_id::TEXT,
    m.available_at::TIMESTAMPTZ,
    m.created_at::TIMESTAMPTZ,
    m.updated_at::TIMESTAMPTZ,
    m.started_at::TIMESTAMPTZ
  FROM menu_extraction_jobs m
  WHERE m.id = claimed_job_id;
END;
$$;

-- Ensure permissions are still correct
GRANT EXECUTE ON FUNCTION claim_menu_extraction_job(TEXT) TO authenticated, service_role;

