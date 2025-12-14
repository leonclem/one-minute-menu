-- ============================================================================
-- Clear Extraction Cache (Safe Version)
-- ============================================================================
-- This script safely clears cached extraction results that may have been
-- created with an old schema version or are causing issues.
--
-- RECOMMENDED FOR PRODUCTION: This version only clears jobs that:
-- 1. Are completed (status = 'completed')
-- 2. Have old schema versions or missing new format data
-- 3. Are older than 7 days (optional safety measure)
--
-- This preserves recent, valid cached results while clearing problematic ones.
-- ============================================================================

-- First, let's see what we have
SELECT 
    'Current extraction jobs summary' as info,
    status,
    schema_version,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM menu_extraction_jobs
GROUP BY status, schema_version
ORDER BY status, schema_version;

-- Show jobs that will be cleared (preview before deletion)
SELECT 
    'Jobs that will be cleared' as info,
    id,
    status,
    schema_version,
    prompt_version,
    created_at,
    LEFT(image_hash, 16) || '...' as image_hash_preview
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND (
    -- Clear old schema versions
    schema_version = 'stage1'
    -- Or clear jobs older than 7 days (optional - uncomment if desired)
    -- OR created_at < NOW() - INTERVAL '7 days'
  )
ORDER BY created_at DESC;

-- ============================================================================
-- EXECUTE THE CLEANUP
-- ============================================================================
-- Uncomment the DELETE statement below after reviewing the preview above

/*
DELETE FROM menu_extraction_jobs 
WHERE status = 'completed'
  AND (
    -- Clear old schema versions (stage1)
    schema_version = 'stage1'
    -- Or clear jobs older than 7 days (optional - uncomment if desired)
    -- OR created_at < NOW() - INTERVAL '7 days'
  );
*/

-- ============================================================================
-- ALTERNATIVE: Clear ALL completed jobs (more aggressive)
-- ============================================================================
-- Use this if you want to force re-extraction for all cached images
-- Uncomment the DELETE statement below to execute

/*
DELETE FROM menu_extraction_jobs 
WHERE status = 'completed';
*/

-- ============================================================================
-- Verify the cleanup (run after deletion)
-- ============================================================================

SELECT 
    'After cleanup summary' as info,
    status,
    schema_version,
    COUNT(*) as count
FROM menu_extraction_jobs
GROUP BY status, schema_version
ORDER BY status, schema_version;
