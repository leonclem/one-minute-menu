-- Rollback Migration: Revert menu_extraction_jobs back to ocr_jobs
-- This script reverts the changes made in 010_vision_llm_extraction.sql

-- Step 1: Drop new tables
DROP TABLE IF EXISTS extraction_feedback CASCADE;
DROP TABLE IF EXISTS extraction_prompt_metrics CASCADE;

-- Step 2: Drop new triggers
DROP TRIGGER IF EXISTS menu_extraction_jobs_notify_insert ON menu_extraction_jobs;
DROP TRIGGER IF EXISTS menu_extraction_jobs_notify_update ON menu_extraction_jobs;
DROP TRIGGER IF EXISTS update_extraction_prompt_metrics_timestamp ON extraction_prompt_metrics;

-- Step 3: Drop new functions
DROP FUNCTION IF EXISTS update_extraction_prompt_metrics_timestamp();

-- Step 4: Remove new columns from menu_extraction_jobs
ALTER TABLE menu_extraction_jobs 
  DROP COLUMN IF EXISTS schema_version,
  DROP COLUMN IF EXISTS prompt_version,
  DROP COLUMN IF EXISTS token_usage,
  DROP COLUMN IF EXISTS confidence,
  DROP COLUMN IF EXISTS uncertain_items,
  DROP COLUMN IF EXISTS superfluous_text;

-- Step 5: Drop new indexes
DROP INDEX IF EXISTS idx_menu_extraction_jobs_prompt_version;
DROP INDEX IF EXISTS idx_menu_extraction_jobs_schema_version;

-- Step 6: Rename table back to ocr_jobs
ALTER TABLE menu_extraction_jobs RENAME TO ocr_jobs;

-- Step 7: Rename indexes back
ALTER INDEX idx_menu_extraction_jobs_status RENAME TO idx_ocr_jobs_status;
ALTER INDEX idx_menu_extraction_jobs_user_id RENAME TO idx_ocr_jobs_user_id;
ALTER INDEX idx_menu_extraction_jobs_image_hash RENAME TO idx_ocr_jobs_image_hash;

-- Step 8: Rename function back
ALTER FUNCTION notify_menu_extraction_jobs() RENAME TO notify_ocr_jobs;

-- Step 9: Recreate original triggers
CREATE TRIGGER ocr_jobs_notify_insert
    AFTER INSERT ON ocr_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_ocr_jobs();

CREATE TRIGGER ocr_jobs_notify_update
    AFTER UPDATE ON ocr_jobs
    FOR EACH ROW EXECUTE FUNCTION notify_ocr_jobs();

-- Step 10: Update realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE menu_extraction_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE ocr_jobs;

-- Verification
SELECT 'Rollback completed successfully!' as status;
SELECT 'ocr_jobs table: ' || tablename as table_status 
FROM pg_tables WHERE tablename = 'ocr_jobs' AND schemaname = 'public';
