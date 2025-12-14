-- ============================================================================
-- Diagnose Extraction Results
-- ============================================================================
-- This script helps diagnose issues with extraction results stored in the database
-- ============================================================================

-- Check the structure of recent extraction results
SELECT 
    id,
    status,
    schema_version,
    created_at,
    -- Check if result exists and has expected structure
    result IS NOT NULL as has_result,
    result->'menu' IS NOT NULL as has_menu,
    result->'menu'->'categories' IS NOT NULL as has_categories,
    jsonb_array_length(result->'menu'->'categories') as categories_count,
    -- Check first category
    result->'menu'->'categories'->0->>'name' as first_category_name,
    result->'menu'->'categories'->0->'items' IS NOT NULL as first_category_has_items,
    jsonb_array_length(result->'menu'->'categories'->0->'items') as first_category_items_count,
    -- Check result size
    pg_column_size(result) as result_size_bytes,
    pg_column_size(result) / 1024 as result_size_kb
FROM menu_extraction_jobs
WHERE status = 'completed'
ORDER BY created_at DESC
LIMIT 10;

-- Show a sample result structure (first completed job)
SELECT 
    'Sample extraction result structure' as info,
    id,
    jsonb_pretty(result) as result_json
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND result IS NOT NULL
ORDER BY created_at DESC
LIMIT 1;

-- Check for results with empty categories
SELECT 
    'Jobs with empty categories' as info,
    id,
    created_at,
    schema_version,
    jsonb_array_length(result->'menu'->'categories') as categories_count,
    result->'menu'->'categories' as categories
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND result->'menu'->'categories' IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(result->'menu'->'categories') as cat
    WHERE jsonb_array_length(cat->'items') = 0
  )
ORDER BY created_at DESC
LIMIT 5;

-- Count total items across all categories for each job
SELECT 
    id,
    created_at,
    schema_version,
    jsonb_array_length(result->'menu'->'categories') as categories_count,
    (
      SELECT SUM(jsonb_array_length(cat->'items'))
      FROM jsonb_array_elements(result->'menu'->'categories') as cat
    ) as total_items_count
FROM menu_extraction_jobs
WHERE status = 'completed'
  AND result->'menu'->'categories' IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
