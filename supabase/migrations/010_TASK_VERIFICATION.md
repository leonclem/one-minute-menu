# Task 1 Verification Checklist

## Task Requirements from tasks.md

- [x] Create migration script to rename ocr_jobs table to menu_extraction_jobs
- [x] Add schema_version, prompt_version, image_hash, token_usage, confidence fields
- [x] Add uncertain_items and superfluous_text JSONB columns
- [x] Create indexes for image_hash and prompt_version
- [x] Create extraction_prompt_metrics and extraction_feedback tables
- [x] Update Row Level Security policies for new tables

## Detailed Verification

### ✅ Migration Script Created
- File: `supabase/migrations/010_vision_llm_extraction.sql`
- Rollback: `supabase/migrations/010_vision_llm_extraction_rollback.sql`
- Documentation: `supabase/migrations/010_vision_llm_extraction_README.md`

### ✅ Table Rename
- `ocr_jobs` → `menu_extraction_jobs` (Line 6)
- All indexes renamed (Lines 9-12)
- All triggers renamed (Lines 15-24)
- All functions renamed (Line 17)
- Realtime publication updated (Lines 27-28)

### ✅ New Fields Added to menu_extraction_jobs
- `schema_version` VARCHAR(20) DEFAULT 'stage1' (Line 34)
- `prompt_version` VARCHAR(50) DEFAULT 'v1.0' (Line 35)
- `token_usage` JSONB (Line 36)
- `confidence` REAL (Line 37)
- `uncertain_items` JSONB (Line 38)
- `superfluous_text` JSONB (Line 39)

**Note**: `image_hash` already exists in the original table, so it was not added again.

### ✅ Indexes Created
- `idx_menu_extraction_jobs_image_hash` - Renamed from existing index (Line 12)
- `idx_menu_extraction_jobs_prompt_version` - New index (Line 51)
- `idx_menu_extraction_jobs_schema_version` - New index (Line 55)

### ✅ extraction_prompt_metrics Table
Created with fields (Lines 59-77):
- `id` UUID PRIMARY KEY
- `prompt_version` VARCHAR(50) NOT NULL
- `schema_version` VARCHAR(20) NOT NULL
- `date` DATE NOT NULL
- `total_extractions` INTEGER
- `average_confidence` REAL
- `average_processing_time` INTEGER
- `average_token_usage` INTEGER
- `average_cost` REAL
- `manual_correction_rate` REAL
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP
- UNIQUE constraint on (prompt_version, schema_version, date)

Indexes created (Lines 145-147):
- `idx_extraction_prompt_metrics_date`
- `idx_extraction_prompt_metrics_prompt_version`
- `idx_extraction_prompt_metrics_schema_version`

### ✅ extraction_feedback Table
Created with fields (Lines 97-108):
- `id` UUID PRIMARY KEY
- `job_id` UUID REFERENCES menu_extraction_jobs(id)
- `user_id` UUID REFERENCES auth.users(id)
- `feedback_type` VARCHAR(50) with CHECK constraint
- `item_id` VARCHAR(100)
- `correction_made` TEXT
- `comment` TEXT
- `created_at` TIMESTAMP

Indexes created (Lines 138-141):
- `idx_extraction_feedback_job_id`
- `idx_extraction_feedback_user_id`
- `idx_extraction_feedback_type`
- `idx_extraction_feedback_created_at`

### ✅ Row Level Security (RLS)
**extraction_prompt_metrics** (Lines 84-93):
- RLS enabled
- Policy: Authenticated users can view metrics
- Policy: Service role can manage metrics

**extraction_feedback** (Lines 116-136):
- RLS enabled
- Policy: Users can view own feedback
- Policy: Users can submit own feedback
- Policy: Users can update own feedback
- Policy: Users can delete own feedback

### ✅ Additional Features
- Comments added for documentation (Lines 41-48, 79-81, 110-112)
- Updated notify function with new fields (Lines 149-161)
- Timestamp update trigger for metrics (Lines 164-177)
- Verification queries at end (Lines 180-187)

## Requirements Mapping

### Requirement 15.1 ✅
"WHEN implementing the vision-LLM approach THEN the system SHALL rename ocr_jobs to menu_extraction_jobs"
- **Satisfied**: Table renamed in migration script

### Requirement 15.2 ✅
"WHEN renaming tables THEN the system SHALL maintain the same job queue mechanism (LISTEN/NOTIFY pattern)"
- **Satisfied**: Triggers and notify function updated and maintained

### Requirement 8.1 ✅
"WHEN each extraction job completes THEN the system SHALL log token usage (input/output) and estimated cost"
- **Satisfied**: `token_usage` JSONB field added, `extraction_prompt_metrics` table created

### Requirement 14.1 ✅
"WHEN reviewing extracted items THEN users SHALL be able to mark corrections as 'system error' vs 'menu unclear'"
- **Satisfied**: `extraction_feedback` table created with `feedback_type` field

## Testing Recommendations

1. **Local Testing** (if using Supabase CLI):
   ```bash
   supabase db reset
   supabase migration up
   ```

2. **Manual Verification Queries**:
   ```sql
   -- Verify table exists
   SELECT * FROM menu_extraction_jobs LIMIT 1;
   
   -- Verify new columns
   SELECT schema_version, prompt_version, confidence 
   FROM menu_extraction_jobs LIMIT 1;
   
   -- Verify new tables
   SELECT * FROM extraction_prompt_metrics LIMIT 1;
   SELECT * FROM extraction_feedback LIMIT 1;
   ```

3. **Integration Testing**:
   - Test job creation with new fields
   - Test notification system still works
   - Test RLS policies for feedback submission
   - Test metrics aggregation

## Status: ✅ COMPLETE

All task requirements have been implemented and verified.
