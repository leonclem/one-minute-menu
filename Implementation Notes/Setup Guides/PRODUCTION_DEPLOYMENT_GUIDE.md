# Production Deployment Guide

## 🚀 Overview

This deployment includes:
1. **Task 11:** Template selection database table (`menu_template_selections`)
2. **Vision LLM:** Menu extraction updates (`menu_extraction_jobs`)
3. **User Roles:** Admin role support
4. **AI Images:** Storage bucket for AI generated images

## 📦 Untracked Migrations

The following migration files are currently untracked in git and need to be committed:
- `supabase/migrations/013_menu_template_selections.sql`
- `supabase/migrations/014_vision_llm_extraction.sql` (formerly 010)
- `supabase/migrations/015_metrics_upsert_function.sql` (formerly 011)
- `supabase/migrations/016_update_plan_limits.sql` (formerly 011)
- `supabase/migrations/017_add_user_roles.sql` (formerly 012)
- `supabase/migrations/018_fix_rls_policy.sql` (formerly 012)
- `supabase/migrations/019_add_user_roles_PRODUCTION.sql` (formerly 012)
- `supabase/migrations/021_add_extraction_method.sql`
- `supabase/migrations/022_add_menu_id_to_extraction_jobs.sql`
- `supabase/migrations/023_create_ai_images_bucket.sql`

## ⚠️ Critical: Migration History Mismatch

Because migration files were **renamed** (e.g., `010` -> `014`), your production database might have a different history than your local codebase.

### Scenario A: Fresh Deployment (Clean History)
If your production database has **NOT** run the old `010` migration yet:
1. Simply commit all files and push.
2. Supabase will apply migrations in order.

### Scenario B: Production Already Has '010' Applied
If you previously deployed the `010` migration to production:
1. Supabase will see that `010` is missing locally (because it was renamed/deleted).
2. It will see `014` as a "new" migration.
3. It might try to re-apply logic that already exists.

**Solution for Scenario B:**
You need to tell Supabase that `014` (and others) are effectively "already applied" or "replace" the old ones.

Since we made the migrations **idempotent** (using `IF NOT EXISTS`), you can safely let Supabase "replay" them. They will just skip over existing tables/columns.

 However, to fix the *history table* mismatch:

```bash
# 1. Repair the history table on production to "forget" the old renamed migrations if they cause conflicts
# (Only do this if deployment fails complaining about missing migration 010, 011, 012)
supabase migration repair --status reverted 010 011 012 --linked
```

## 🛠️ Deployment Steps

1. **Commit Changes**
   ```bash
   git add supabase/migrations/*.sql
   git commit -m "chore: add all pending migrations and rename for consistency"
   git push origin main
   ```

2. **Deploy to Production**
   Allow your CI/CD pipeline to run `supabase migration up`.
   
   *If you deploy manually:*
   ```bash
   supabase db push
   ```

3. **Verify Deployment**
   Run this SQL in Supabase Production Studio to verify everything is correct:

   ```sql
   -- 1. Check Template Selections Table
   SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'menu_template_selections');

   -- 2. Check AI Images Bucket
   SELECT * FROM storage.buckets WHERE id = 'ai-generated-images';

   -- 3. Check User Roles
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'role';
   ```

## 🔄 Rollback Plan

If something goes wrong, we have `020_vision_llm_extraction_rollback.sql` (formerly 010 rollback). 

To rollback the `menu_extraction_jobs` changes:
1. Copy content of `020_vision_llm_extraction_rollback.sql`
2. Run in Supabase SQL Editor
