# Vision-LLM Extraction Migration

## Overview

This migration (010_vision_llm_extraction.sql) transforms the existing OCR-based extraction system into a vision-LLM extraction system. It renames the `ocr_jobs` table to `menu_extraction_jobs` and adds comprehensive tracking for schema versions, prompt versions, confidence scores, and user feedback.

## Changes Made

### 1. Table Rename
- `ocr_jobs` → `menu_extraction_jobs`
- All related indexes, triggers, and functions renamed accordingly

### 2. New Columns Added to menu_extraction_jobs
- `schema_version` (VARCHAR(20)): Tracks whether Stage 1 or Stage 2 schema was used
- `prompt_version` (VARCHAR(50)): Enables A/B testing and prompt iteration
- `token_usage` (JSONB): Stores input/output tokens and estimated cost
- `confidence` (REAL): Overall confidence score (0.0-1.0)
- `uncertain_items` (JSONB): Items that need manual review
- `superfluous_text` (JSONB): Decorative text filtered out

### 3. New Tables Created

#### extraction_prompt_metrics
Tracks aggregated performance metrics for each prompt version:
- Total extractions
- Average confidence
- Average processing time
- Average token usage and cost
- Manual correction rate

#### extraction_feedback
Stores user feedback on extraction quality:
- Feedback type (system_error, menu_unclear, excellent, needs_improvement)
- Item-specific corrections
- User comments for continuous improvement

### 4. Indexes Created
- `idx_menu_extraction_jobs_prompt_version`: For prompt performance analysis
- `idx_menu_extraction_jobs_schema_version`: For schema version tracking
- `idx_extraction_feedback_job_id`: For feedback lookup
- `idx_extraction_feedback_user_id`: For user feedback queries
- `idx_extraction_feedback_type`: For feedback type filtering
- `idx_extraction_prompt_metrics_date`: For time-series analysis

### 5. Row Level Security (RLS)
- All new tables have RLS enabled
- Users can only view/manage their own feedback
- Prompt metrics are viewable by authenticated users
- Service role can manage metrics

## How to Apply

### Option 1: Using Supabase CLI (Recommended for Local Development)

```bash
# Apply the migration to local database
supabase db reset

# Or apply just this migration
supabase migration up
```

### Option 2: Using Supabase Dashboard (Production)

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `010_vision_llm_extraction.sql`
4. Paste and execute the SQL

### Option 3: Using the Setup Script

```bash
# If you have a custom migration runner
node scripts/apply-migration.js 010_vision_llm_extraction.sql
```

## Rollback

If you need to revert this migration:

```bash
# Using Supabase CLI
supabase db reset --version 009

# Or manually apply the rollback script
psql -f supabase/migrations/010_vision_llm_extraction_rollback.sql
```

Or execute `010_vision_llm_extraction_rollback.sql` in the Supabase SQL Editor.

## Verification

After applying the migration, verify the changes:

```sql
-- Check that menu_extraction_jobs exists
SELECT tablename FROM pg_tables 
WHERE tablename = 'menu_extraction_jobs' AND schemaname = 'public';

-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_extraction_jobs' 
  AND column_name IN ('schema_version', 'prompt_version', 'token_usage', 'confidence');

-- Check new tables exist
SELECT tablename FROM pg_tables 
WHERE tablename IN ('extraction_prompt_metrics', 'extraction_feedback') 
  AND schemaname = 'public';

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'menu_extraction_jobs' 
  AND indexname LIKE '%prompt_version%';
```

## Impact on Existing Code

### Code Changes Required

1. **Update table references**: Change all references from `ocr_jobs` to `menu_extraction_jobs`
2. **Update notification channel**: Change from `ocr_jobs` to `menu_extraction_jobs`
3. **Update TypeScript types**: Add new fields to job interface
4. **Update API routes**: Handle new fields in request/response

### Example Code Updates

```typescript
// Before
const { data } = await supabase
  .from('ocr_jobs')
  .select('*')
  .eq('id', jobId)

// After
const { data } = await supabase
  .from('menu_extraction_jobs')
  .select('*')
  .eq('id', jobId)
```

### Backward Compatibility

- Existing data in the renamed table is preserved
- New columns have default values, so existing rows work without modification
- The `result` JSONB column remains unchanged for backward compatibility

## Testing

After migration, test the following:

1. ✅ Create a new extraction job
2. ✅ Query existing extraction jobs
3. ✅ Update job status
4. ✅ Receive notifications via LISTEN/NOTIFY
5. ✅ Submit user feedback
6. ✅ Query prompt metrics

## Requirements Satisfied

This migration satisfies the following requirements from the spec:

- **Requirement 15.1**: Rename ocr_jobs to menu_extraction_jobs ✅
- **Requirement 15.2**: Maintain job queue mechanism (LISTEN/NOTIFY) ✅
- **Requirement 8.1**: Log token usage and costs ✅
- **Requirement 14.1**: User feedback collection ✅

## Next Steps

After applying this migration:

1. Update application code to use `menu_extraction_jobs` table
2. Implement the MenuExtractionService with vision-LLM integration
3. Create API routes for extraction submission and status
4. Build the extraction review UI components
5. Implement metrics collection and monitoring

## Support

If you encounter issues with this migration:

1. Check the Supabase logs for error messages
2. Verify your database version supports all features (PostgreSQL 15+)
3. Ensure you have sufficient permissions to alter tables
4. Review the rollback script if you need to revert changes
