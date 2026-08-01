-- ============================================================================
-- Migration 078: Move Studio export generation onto the Railway worker queue
--
-- Gemini (ai_expand) and Replicate (cutout) calls take ~30s, which exceeds the
-- serverless function budget. Deterministic crop/resize exports stay inline.
--
-- Follows the established queue conventions from 036/037 (export_jobs) and the
-- cutout pipeline: the domain row *is* the queue, so no separate jobs table.
-- ============================================================================

ALTER TABLE studio_export_variants
    ADD COLUMN IF NOT EXISTS worker_id TEXT,
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0
        CHECK (retry_count >= 0),
    ADD COLUMN IF NOT EXISTS error_code TEXT,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN studio_export_variants.worker_id IS
    'Worker currently generating this variant.';
COMMENT ON COLUMN studio_export_variants.available_at IS
    'When this variant becomes claimable; carries retry backoff.';
COMMENT ON COLUMN studio_export_variants.priority IS
    'Higher values are claimed first.';
COMMENT ON COLUMN studio_export_variants.retry_count IS
    'Transient-failure retries already attempted (max 3).';

-- Queue scan: status='queued' AND available_at <= NOW() ORDER BY priority DESC, created_at ASC
CREATE INDEX IF NOT EXISTS idx_studio_export_variants_queue
    ON studio_export_variants (status, available_at, priority DESC, created_at ASC)
    WHERE status = 'queued';

-- Stale detection for variants abandoned mid-generation.
CREATE INDEX IF NOT EXISTS idx_studio_export_variants_stale
    ON studio_export_variants (status, started_at)
    WHERE status = 'generating';

-- The pre-existing partial index only covered queued/generating by updated_at;
-- the two indexes above supersede it for claiming and stale recovery.
DROP INDEX IF EXISTS idx_studio_export_variants_in_flight;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_studio_export_variants_updated_at'
    ) THEN
        CREATE TRIGGER update_studio_export_variants_updated_at
            BEFORE UPDATE ON studio_export_variants
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Atomic claim, mirroring claim_export_job / claim_image_generation_job
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION claim_studio_export_variant(p_worker_id TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    dish_id UUID,
    source_image_id UUID,
    parent_image_id UUID,
    variant_type TEXT,
    width INTEGER,
    height INTEGER,
    aspect_ratio TEXT,
    file_type TEXT,
    status TEXT,
    storage_path TEXT,
    preview_url TEXT,
    generation_method TEXT,
    estimated_credits INTEGER,
    credits_charged INTEGER,
    error_message TEXT,
    error_code TEXT,
    metadata JSONB,
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
    claimed_id UUID;
BEGIN
    SELECT v.id INTO claimed_id
    FROM studio_export_variants AS v
    WHERE v.status = 'queued'
      AND v.available_at <= NOW()
    ORDER BY v.priority DESC, v.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF claimed_id IS NULL THEN
        RETURN;
    END IF;

    UPDATE studio_export_variants
    SET status = 'generating',
        worker_id = p_worker_id,
        started_at = NOW(),
        updated_at = NOW()
    WHERE studio_export_variants.id = claimed_id;

    RETURN QUERY
    SELECT
        v.id,
        v.user_id,
        v.dish_id,
        v.source_image_id,
        v.parent_image_id,
        v.variant_type::TEXT,
        v.width,
        v.height,
        v.aspect_ratio::TEXT,
        v.file_type::TEXT,
        v.status::TEXT,
        v.storage_path::TEXT,
        v.preview_url::TEXT,
        v.generation_method::TEXT,
        v.estimated_credits,
        v.credits_charged,
        v.error_message,
        v.error_code,
        v.metadata,
        v.retry_count,
        v.priority,
        v.worker_id,
        v.available_at,
        v.created_at,
        v.updated_at,
        v.started_at,
        v.completed_at
    FROM studio_export_variants AS v
    WHERE v.id = claimed_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_studio_export_variant(TEXT) TO service_role;

COMMENT ON FUNCTION claim_studio_export_variant(TEXT) IS
    'Atomically claims one queued Studio export variant for worker processing. Uses FOR UPDATE SKIP LOCKED and respects available_at for retry backoff.';

-- ---------------------------------------------------------------------------
-- Stale recovery: a variant stuck in 'generating' past the threshold is
-- returned to the queue, or failed once retries are exhausted.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reset_stale_studio_export_variants(
    p_stale_after_seconds INTEGER DEFAULT 300,
    p_max_retries INTEGER DEFAULT 3
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected INTEGER;
BEGIN
    WITH stale AS (
        SELECT v.id, v.retry_count
        FROM studio_export_variants AS v
        WHERE v.status = 'generating'
          AND v.started_at IS NOT NULL
          AND v.started_at < NOW() - (p_stale_after_seconds || ' seconds')::INTERVAL
        FOR UPDATE SKIP LOCKED
    )
    UPDATE studio_export_variants AS v
    SET status = CASE
            WHEN stale.retry_count >= p_max_retries THEN 'failed'
            ELSE 'queued'
        END,
        error_message = 'Generation did not finish in time and was recovered.',
        error_code = 'WORKER_STALE',
        retry_count = stale.retry_count + 1,
        worker_id = NULL,
        started_at = NULL,
        available_at = NOW(),
        completed_at = CASE
            WHEN stale.retry_count >= p_max_retries THEN NOW()
            ELSE NULL
        END,
        updated_at = NOW()
    FROM stale
    WHERE v.id = stale.id;

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_stale_studio_export_variants(INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION reset_stale_studio_export_variants(INTEGER, INTEGER) IS
    'Requeues Studio export variants abandoned mid-generation; fails them once retries are exhausted.';
