-- Migration 065: Prepare image_generation_jobs for Railway worker queue processing
-- Adds queue metadata, menu/batch lookup fields, and an atomic claim function.

ALTER TABLE image_generation_jobs
  ADD COLUMN IF NOT EXISTS menu_id UUID REFERENCES menus(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill menu_id for existing generation jobs so status lookups can avoid
-- relying only on the menu_items join.
UPDATE image_generation_jobs AS jobs
SET menu_id = items.menu_id
FROM menu_items AS items
WHERE jobs.menu_id IS NULL
  AND jobs.menu_item_id = items.id;

CREATE INDEX IF NOT EXISTS idx_gen_jobs_menu_id ON image_generation_jobs(menu_id);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_batch_id ON image_generation_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_worker_id ON image_generation_jobs(worker_id);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_available_at ON image_generation_jobs(available_at);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_priority_created ON image_generation_jobs(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_menu_active
  ON image_generation_jobs(menu_id, status, created_at DESC)
  WHERE status IN ('queued', 'processing');

-- Existing dev/prod data can contain duplicate active jobs from the pre-worker
-- synchronous path or interrupted retries. Keep one active job per item before
-- enforcing the invariant below.
WITH ranked_active_jobs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY menu_item_id
      ORDER BY
        CASE WHEN status = 'processing' THEN 0 ELSE 1 END,
        COALESCE(started_at, created_at) DESC,
        created_at DESC,
        id DESC
    ) AS active_rank
  FROM image_generation_jobs
  WHERE status IN ('queued', 'processing')
)
UPDATE image_generation_jobs AS jobs
SET
  status = 'failed',
  error_message = COALESCE(
    jobs.error_message,
    'Superseded by another active image generation job for this menu item during queue migration'
  ),
  error_code = COALESCE(jobs.error_code, 'DUPLICATE_ACTIVE_JOB_SUPERSEDED'),
  completed_at = COALESCE(jobs.completed_at, NOW()),
  updated_at = NOW()
FROM ranked_active_jobs AS ranked
WHERE jobs.id = ranked.id
  AND ranked.active_rank > 1;

-- Prevent duplicate active generation work for the same menu item. Completed
-- and failed jobs remain available for history and retry decisions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gen_jobs_one_active_per_menu_item
  ON image_generation_jobs(menu_item_id)
  WHERE status IN ('queued', 'processing');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_image_generation_jobs_updated_at'
  ) THEN
    CREATE TRIGGER update_image_generation_jobs_updated_at
      BEFORE UPDATE ON image_generation_jobs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON COLUMN image_generation_jobs.menu_id IS 'Menu owning the generated item, denormalized for efficient menu-level status checks.';
COMMENT ON COLUMN image_generation_jobs.batch_id IS 'Client-visible batch identifier shared by jobs created from one batch request.';
COMMENT ON COLUMN image_generation_jobs.worker_id IS 'ID of the worker currently processing this image generation job.';
COMMENT ON COLUMN image_generation_jobs.available_at IS 'Timestamp when this job becomes available for processing or retry.';
COMMENT ON COLUMN image_generation_jobs.priority IS 'Job priority; higher values are processed first.';

CREATE OR REPLACE FUNCTION claim_image_generation_job(p_worker_id TEXT)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  menu_id UUID,
  menu_item_id UUID,
  batch_id UUID,
  status TEXT,
  prompt TEXT,
  negative_prompt TEXT,
  api_params JSONB,
  number_of_variations INTEGER,
  result_count INTEGER,
  error_message TEXT,
  error_code TEXT,
  processing_time INTEGER,
  estimated_cost NUMERIC,
  retry_count INTEGER,
  priority INTEGER,
  worker_id TEXT,
  available_at TIMESTAMPTZ,
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
  SELECT image_generation_jobs.id INTO claimed_job_id
  FROM image_generation_jobs
  WHERE image_generation_jobs.status = 'queued'
    AND image_generation_jobs.available_at <= NOW()
  ORDER BY image_generation_jobs.priority DESC, image_generation_jobs.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF claimed_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE image_generation_jobs
  SET
    status = 'processing',
    worker_id = p_worker_id,
    started_at = NOW(),
    updated_at = NOW()
  WHERE image_generation_jobs.id = claimed_job_id;

  RETURN QUERY
  SELECT
    jobs.id,
    jobs.user_id,
    jobs.menu_id,
    jobs.menu_item_id,
    jobs.batch_id,
    jobs.status::TEXT,
    jobs.prompt,
    jobs.negative_prompt,
    jobs.api_params,
    jobs.number_of_variations,
    jobs.result_count,
    jobs.error_message,
    jobs.error_code::TEXT,
    jobs.processing_time,
    jobs.estimated_cost,
    jobs.retry_count,
    jobs.priority,
    jobs.worker_id,
    jobs.available_at,
    jobs.created_at,
    jobs.updated_at,
    jobs.started_at,
    jobs.completed_at
  FROM image_generation_jobs AS jobs
  WHERE jobs.id = claimed_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_image_generation_job(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION claim_image_generation_job(TEXT) IS 'Atomically claims one queued image generation job for worker processing. Uses SELECT FOR UPDATE SKIP LOCKED and respects available_at for retry backoff.';
