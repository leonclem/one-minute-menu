-- ============================================================================
-- Clear Extraction Cache
-- ============================================================================
-- This script clears cached extraction results from the menu_extraction_jobs table.
-- Run this when you need to force re-extraction of menu images that were previously processed.
--
-- USAGE:
-- - For local development: Run via Supabase Studio SQL Editor
-- - For production: Run via Supabase Dashboard SQL Editor
--
-- CAUTION: This will delete completed extraction jobs, forcing re-extraction
-- of any images that were previously cached.
-- ============================================================================

-- Option 1: Clear ALL cached extraction results (completed jobs)
-- This removes all completed jobs, forcing re-extraction for all images
DELETE FROM menu_extraction_jobs 
WHERE status = 'completed';

-- Option 2: Clear cached results for a specific user (uncomment to use)
-- DELETE FROM menu_extraction_jobs 
-- WHERE status = 'completed' 
-- AND user_id = 'YOUR_USER_ID_HERE';

-- Option 3: Clear cached results older than a specific date (uncomment to use)
-- DELETE FROM menu_extraction_jobs 
-- WHERE status = 'completed' 
-- AND created_at < '2024-01-01'::timestamp;

-- Option 4: Clear cached results for a specific image hash (uncomment to use)
-- DELETE FROM menu_extraction_jobs 
-- WHERE status = 'completed' 
-- AND image_hash = 'YOUR_IMAGE_HASH_HERE';

-- Verify the cleanup
SELECT 
    status,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM menu_extraction_jobs
GROUP BY status
ORDER BY status;

-- Show remaining jobs
SELECT 
    id,
    status,
    schema_version,
    prompt_version,
    created_at,
    LEFT(image_hash, 16) || '...' as image_hash_preview
FROM menu_extraction_jobs
ORDER BY created_at DESC
LIMIT 10;
