-- Migration 047: Add updated_at to menu_extraction_jobs
-- The extraction worker and claim_menu_extraction_job RPC expect menu_extraction_jobs.updated_at to exist.

-- 1) Add updated_at column (if missing)
ALTER TABLE menu_extraction_jobs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) Backfill existing rows (if any)
UPDATE menu_extraction_jobs
SET updated_at = COALESCE(updated_at, created_at, NOW())
WHERE updated_at IS NULL;

-- 3) Keep updated_at current on updates (safe if function exists from initial schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_menu_extraction_jobs_updated_at'
  ) THEN
    CREATE TRIGGER update_menu_extraction_jobs_updated_at
      BEFORE UPDATE ON menu_extraction_jobs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

