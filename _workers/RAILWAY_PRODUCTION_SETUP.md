# Railway Production Setup Guide

This guide walks you through the production deployment of the Railway Workers system, including Supabase migrations, environment variables, and Railway configuration.

## Prerequisites

- ✅ **Railway Account** with a project created
- ✅ **Supabase Project** (Production instance)
- ✅ **SendGrid API Key** (for production emails)
- ✅ **Git** access to the repository

## Setup Order Overview

1. **Supabase Migrations** - Apply pending database changes
2. **Supabase Storage** - Ensure required buckets exist
3. **Railway Project Setup** - Create the service and link to GitHub
4. **Environment Variables** - Configure production settings in Railway
5. **Deployment & Verification** - Deploy and test the worker

---

## Step 1: Supabase Migrations (Production)

You must ensure your production database is up to date. The Railway Workers system specifically requires migrations `036` through `044`.

### 1.1 Apply Migrations

If you use the Supabase CLI linked to production:

```bash
# Link to production (if not already)
supabase link --project-ref [YOUR-PROJECT-REF]

# Apply pending migrations
supabase db push
```

**Alternatively, manual SQL execution via Supabase Dashboard:**
Run the contents of these files in the SQL Editor in order:
- `036_create_export_jobs_table.sql`
- `037_claim_export_job_function.sql`
- `038_fix_handle_new_user_syntax.sql`
- `039_fix_generation_quota_rls.sql`
- `040_fix_signup_rls_policies.sql`
- `041_grant_auth_admin_privileges.sql`
- `042_fix_generation_quota_schema.sql`
- `043_create_export_files_bucket.sql` (This also sets up the storage bucket and RLS policies)
- `044_add_logo_url_to_menus.sql`

### 1.2 Verify Database State

Run this in the SQL Editor to confirm:

```sql
-- Check jobs table
SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'export_jobs');

-- Check claim function
SELECT pg_get_functiondef('claim_export_job(text)'::regprocedure);
```

---

## Step 2: Supabase Storage (Production)

The worker requires the `export-files` bucket to store generated PDFs and images. If you ran migration `043` in Step 1.1, this is already complete.

### 2.1 Verify or Create Bucket Manually

If you didn't run the migration or prefer the UI:

1. Go to **Supabase Dashboard** → **Storage**
2. Check if `export-files` exists. If not, create a new **Private** bucket named `export-files`.
3. Set **File size limit** to `20MB` (as per migration 043).
4. Set **Allowed MIME types** to `application/pdf`, `image/png`, `image/jpeg`.

### 2.2 Verify RLS Policies

To check if the policies were created successfully, run this in the SQL Editor:

```sql
-- Check for policies on storage.objects related to export-files
-- The simplest way to see policy names for storage objects.  Looking for "Users can upload/view/delete own exports" and "Service role can manage export files"
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';
```

---

## Step 3: Railway Project Setup

1. Log in to [Railway](https://railway.app/)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. When prompted for the root directory, ensure it's the repository root (where the `Dockerfile` is located)
5. Railway will automatically detect the `Dockerfile` and `railway.json`

---

## Step 4: Environment Variables (Railway)

In your Railway service, go to the **Variables** tab and add the following:

| Variable | Description | Example/Source |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment | `production` |
| `DATABASE_URL` | Postgres Connection String | Supabase Dashboard → Settings → Database |
| `SUPABASE_URL` | Project URL | Supabase Dashboard → Settings → API (Project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (Secret) | Supabase Dashboard → Settings → API |
| `STORAGE_BUCKET` | Storage bucket name | `export-files` |
| `SENDGRID_API_KEY` | SendGrid API Key | Your SendGrid Dashboard |
| `SENDGRID_FROM_EMAIL` | Verified Sender Email | `exports@yourdomain.com` |
| `WORKER_ID` | Unique ID for this service | `railway-worker-prod-1` |
| `LOG_LEVEL` | Logging verbosity | `info` |

### Optional Performance Tuning

| Variable | Default | Description |
| :--- | :--- | :--- |
| `MAX_CONCURRENT_RENDERS` | `3` | Max simultaneous Puppeteer instances |
| `JOB_TIMEOUT_SECONDS` | `60` | Max time per export job |
| `POLLING_INTERVAL_IDLE_MS` | `5000` | Wait time when queue is empty |

---

## Step 5: Deployment & Verification

### 5.1 Trigger Deployment

Railway will automatically deploy when you push to your main branch. You can also manually trigger a redeploy from the Railway dashboard.

### 5.2 Monitor Logs

Check the **Logs** tab in Railway. You should see:
```json
{"level":"info","message":"Worker starting","worker_id":"railway-worker-prod-1"}
{"level":"info","message":"Database connection OK"}
{"level":"info","message":"Storage connection OK"}
{"level":"info","message":"Worker ready"}
```

### 5.3 Production Test

1. Log in to your production application
2. Trigger a menu export (PDF or Image)
3. Monitor Railway logs to see the job being claimed and processed
4. Verify you receive the email notification (if enabled)
5. Verify the download link works in the app

---

## Troubleshooting Production

### Worker fails to start (Chromium issues)
The `Dockerfile` is configured to install Chromium. If Puppeteer fails, ensure `PUPPETEER_EXECUTABLE_PATH` is set to `/usr/bin/chromium` (default in `railway.json`).

### Database Connection Refused
Ensure your Supabase project allows connections from Railway's IP ranges, or use the **Connection Pooler** (port 6543) instead of the direct connection (port 5432).

### Storage Upload Errors
Double check that `SUPABASE_SERVICE_ROLE_KEY` is the **service_role** key and NOT the **anon** key. RLS policies for the `export-files` bucket must allow `service_role` access.

---

## Maintenance

### Updating the Worker
When you update the worker code in `src/lib/worker/`, simply commit and push. Railway will rebuild the Docker image and perform a zero-downtime deployment.

### Database Schema Changes
Always run new migrations on Supabase **before** deploying worker code that depends on those changes.
