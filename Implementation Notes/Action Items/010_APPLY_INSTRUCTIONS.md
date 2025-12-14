# How to Apply Migration 010

## ✅ Migration Updated - Now Idempotent!

The migration has been updated to be **fully idempotent**, meaning:
- ✅ You can run it multiple times safely
- ✅ It checks if things exist before creating/renaming them
- ✅ It handles missing functions gracefully
- ✅ It won't fail if tables/indexes already exist

## 🚀 Apply the Migration

### Method 1: Supabase Studio (Recommended)

**Step 1:** Open Supabase Studio
```powershell
start http://127.0.0.1:54323
```

**Step 2:** Go to SQL Editor
- Click "SQL Editor" in the left sidebar
- Click "New query"

**Step 3:** Copy and Run
- Open `supabase/migrations/010_vision_llm_extraction.sql`
- Copy all contents (Ctrl+A, Ctrl+C)
- Paste into SQL Editor
- Click "Run" (or Ctrl+Enter)

**Step 4:** Verify Success
You should see output like:
```
Migration completed successfully!
menu_extraction_jobs table: menu_extraction_jobs
extraction_prompt_metrics table: extraction_prompt_metrics
extraction_feedback table: extraction_feedback
```

---

### Method 2: Command Line

```powershell
# From your project directory
cd "C:\Users\Leon Clements\OneDrive\Kiro"

# Execute the migration
supabase db execute --file supabase/migrations/010_vision_llm_extraction.sql --local
```

---

### Method 3: Node.js Script

```powershell
node scripts/apply-migration-010.js
```

---

## ✅ Verify the Migration

Run this query in Supabase Studio SQL Editor:

```sql
-- Check tables exist
SELECT tablename, schemaname 
FROM pg_tables 
WHERE tablename IN ('menu_extraction_jobs', 'extraction_prompt_metrics', 'extraction_feedback') 
  AND schemaname = 'public';

-- Check new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'menu_extraction_jobs' 
  AND column_name IN ('schema_version', 'prompt_version', 'confidence', 'token_usage', 'uncertain_items', 'superfluous_text')
ORDER BY column_name;

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'menu_extraction_jobs' 
  AND indexname LIKE '%prompt_version%' OR indexname LIKE '%schema_version%';

-- Check function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'notify_menu_extraction_jobs';
```

Expected results:
- ✅ 3 tables found
- ✅ 6 new columns found
- ✅ 2 new indexes found
- ✅ 1 function found

---

## 🔧 What Changed

The migration now:

1. **Checks before renaming**: Won't fail if `ocr_jobs` doesn't exist or `menu_extraction_jobs` already exists
2. **Handles missing functions**: Creates `notify_menu_extraction_jobs()` even if `notify_ocr_jobs()` doesn't exist
3. **Uses IF NOT EXISTS**: All CREATE statements are idempotent
4. **Drops policies before creating**: Prevents "already exists" errors
5. **Checks publication membership**: Only modifies realtime publication if needed

---

## 🐛 Troubleshooting

### Error: "function notify_ocr_jobs() does not exist"
**Fixed!** The migration now handles this case.

### Error: "relation already exists"
**Fixed!** The migration now uses `IF NOT EXISTS` everywhere.

### Error: "policy already exists"
**Fixed!** The migration now drops policies before creating them.

### Still having issues?
Run with verbose output:
```powershell
supabase db execute --file supabase/migrations/010_vision_llm_extraction.sql --local --debug
```

---

## 📝 Next Steps After Migration

1. ✅ Verify the migration succeeded (see verification queries above)
2. Update your application code to use `menu_extraction_jobs` instead of `ocr_jobs`
3. Update TypeScript types to include new fields
4. Implement the MenuExtractionService
5. Test the extraction flow

---

## 🔄 Rollback (If Needed)

If you need to revert:
```sql
-- Run the rollback script
-- File: supabase/migrations/010_vision_llm_extraction_rollback.sql
```

Or in Supabase Studio:
1. Open SQL Editor
2. Copy contents of `010_vision_llm_extraction_rollback.sql`
3. Paste and run
