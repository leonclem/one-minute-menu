# Railway Workers - Local Setup Guide

This guide walks you through setting up and testing the Railway Workers system locally before deploying to production.

## Prerequisites

Before starting, ensure you have:

- ✅ **Node.js 20+** installed
- ✅ **Docker Desktop** installed and running
- ✅ **Supabase CLI** installed (`npm install -g supabase`)
- ✅ **PostgreSQL client** (optional, for manual database queries)
- ✅ **SendGrid account** (or disable email for local testing)

## Setup Order Overview

Here's the correct order for local setup:

1. **Database Setup** - Run migrations to create `export_jobs` table
2. **Storage Setup** - Create the `export-files` bucket
3. **Environment Configuration** - Set up local `.env` file
4. **Docker Build** - Build the worker Docker image
5. **Local Testing** - Run worker and test with sample jobs
6. **Production Deployment** - Deploy to Railway (separate guide)

---

## Step 1: Database Setup (Migrations)

The Railway Workers feature requires two new database migrations:
- `036_create_export_jobs_table.sql` - Creates the jobs table
- `037_claim_export_job_function.sql` - Creates atomic job claiming function

### Option A: Using Supabase CLI (Recommended)

If you're using local Supabase:

```bash
# Start local Supabase (if not already running)
supabase start

# Apply migrations
supabase db reset

# Or apply specific migrations
supabase migration up
```

### Option B: Manual SQL Execution

If you're testing against a remote Supabase instance:

1. **Open Supabase Dashboard** → Your Project → SQL Editor

2. **Run Migration 036** (create table):
   - Copy contents of `supabase/migrations/036_create_export_jobs_table.sql`
   - Paste into SQL Editor
   - Click "Run"

3. **Run Migration 037** (create function):
   - Copy contents of `supabase/migrations/037_claim_export_job_function.sql`
   - Paste into SQL Editor
   - Click "Run"

4. **Verify Setup**:
   ```sql
   -- Check table exists
   SELECT * FROM export_jobs LIMIT 1;
   
   -- Check function exists
   SELECT claim_export_job('test-worker');
   
   -- Check realtime is enabled
   SELECT * FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime' 
   AND tablename = 'export_jobs';
   ```

---

## Step 2: Storage Setup

Create the storage bucket for export files.

### Option A: Using Supabase Dashboard (Easiest)

1. Open **Supabase Dashboard** → Your Project → **Storage**
2. Click **"New bucket"**
3. Configure:
   - **Name**: `export-files`
   - **Public**: ❌ No (private bucket)
   - **File size limit**: `10 MB` (10485760 bytes)
   - **Allowed MIME types**: `application/pdf`, `image/png`, `image/jpeg`
4. Click **"Create bucket"**

### Option B: Using SQL

Run this in SQL Editor:

```sql
-- Create export-files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'export-files',
  'export-files',
  false, -- Private bucket
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for service role access
CREATE POLICY "Service role can manage export files"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'export-files')
WITH CHECK (bucket_id = 'export-files');

-- Create RLS policy for users to read their own exports
CREATE POLICY "Users can read own export files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'export-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

### Verify Storage Setup

```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'export-files';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%export%';
```

---

## Step 3: Environment Configuration

Create your local environment file:

```bash
# Navigate to _workers directory
cd _workers

# Copy example environment file
copy .env.example .env

# Edit .env with your values
notepad .env
```

### Required Configuration for Local Testing

Edit `_workers/.env` with these values:

```bash
# ============================================================================
# LOCAL DEVELOPMENT CONFIGURATION
# ============================================================================

# Database Configuration
# Get from Supabase Dashboard → Settings → Database → Connection String
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres

# Supabase Configuration
# Get from Supabase Dashboard → Settings → API
SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Service role key (keep secret!)

# Storage Configuration
STORAGE_BUCKET=export-files

# Email Configuration (Option 1: Real SendGrid)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=exports@yourdomain.com

# Email Configuration (Option 2: Disable for local testing)
# SENDGRID_API_KEY=disabled
# SENDGRID_FROM_EMAIL=test@example.com

# Worker Configuration
WORKER_ID=local-worker-1
NODE_ENV=development
LOG_LEVEL=debug

# Puppeteer Configuration
# For local testing without Docker, use your system Chrome:
# Windows: C:/Program Files/Google/Chrome/Application/chrome.exe
# Mac: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
# Linux: /usr/bin/chromium
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Development Settings (faster feedback)
MAX_CONCURRENT_RENDERS=2
JOB_TIMEOUT_SECONDS=60
POLLING_INTERVAL_BUSY_MS=1000
POLLING_INTERVAL_IDLE_MS=2000
ENABLE_CANARY_EXPORT=false  # Disable canary test for faster startup
```

### Finding Your Supabase Credentials

1. **Supabase URL**: Dashboard → Settings → API → Project URL
2. **Service Role Key**: Dashboard → Settings → API → Service Role Key (secret)
3. **Database URL**: Dashboard → Settings → Database → Connection String (URI)

---

## Step 4: Docker Build

Build the Docker image for the worker:

```bash
# Navigate to project root (where Dockerfile is)
cd ..

# Build Docker image
docker build -t railway-worker .

# Verify image was created
docker images | findstr railway-worker
```

**Expected output:**
```
railway-worker    latest    abc123def456    2 minutes ago    1.2GB
```

### Troubleshooting Docker Build

**Issue**: Build fails with "Chromium not found"
- **Solution**: The Dockerfile installs Chromium automatically. Check Docker logs.

**Issue**: Build is very slow
- **Solution**: First build takes 5-10 minutes. Subsequent builds are faster due to layer caching.

**Issue**: Out of disk space
- **Solution**: Clean up old Docker images: `docker system prune -a`

---

## Step 5: Local Testing

Now test the worker locally using Docker:

### 5.1 Run Worker Container

```bash
# Run worker with environment file
docker run -p 3000:3000 --env-file _workers/.env railway-worker

# Or run in detached mode (background)
docker run -d -p 3000:3000 --env-file _workers/.env --name railway-worker railway-worker

# View logs (if running detached)
docker logs -f railway-worker
```

**Expected startup logs:**
```json
{"timestamp":"2026-01-31T12:00:00.000Z","level":"info","message":"Worker starting","worker_id":"local-worker-1"}
{"timestamp":"2026-01-31T12:00:01.000Z","level":"info","message":"Database connection OK"}
{"timestamp":"2026-01-31T12:00:01.000Z","level":"info","message":"Storage connection OK"}
{"timestamp":"2026-01-31T12:00:02.000Z","level":"info","message":"Worker ready","worker_id":"local-worker-1"}
{"timestamp":"2026-01-31T12:00:02.000Z","level":"info","message":"Polling for jobs..."}
```

### 5.2 Check Health Endpoint

Open another terminal and test the health endpoint:

```bash
curl http://localhost:3000/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T12:00:00.000Z",
  "checks": {
    "database": { "healthy": true, "message": "Database connection OK" },
    "storage": { "healthy": true, "message": "Storage connection OK" },
    "puppeteer": { "healthy": true, "message": "Puppeteer OK" },
    "memory": { "healthy": true, "message": "Memory usage: 25.3%" }
  }
}
```

### 5.3 Create Test Job

Create a test export job to verify the worker processes it:

**Option A: Using SQL**

```sql
-- Insert a test job
INSERT INTO export_jobs (
  user_id,
  menu_id,
  export_type,
  status,
  priority,
  metadata
)
VALUES (
  (SELECT id FROM profiles LIMIT 1), -- Use your user ID
  (SELECT id FROM menus LIMIT 1),    -- Use a real menu ID
  'pdf',
  'pending',
  10,
  '{"test": true}'::jsonb
)
RETURNING id;
```

**Option B: Using Your Application**

If you have an export button in your app, just click it! The worker will pick up the job.

### 5.4 Monitor Job Processing

Watch the worker logs to see it process the job:

```bash
# If running in foreground, logs appear automatically
# If running detached:
docker logs -f railway-worker
```

**Expected processing logs:**
```json
{"timestamp":"2026-01-31T12:01:00.000Z","level":"info","message":"Job claimed","job_id":"abc-123","export_type":"pdf"}
{"timestamp":"2026-01-31T12:01:01.000Z","level":"info","message":"Rendering started","job_id":"abc-123"}
{"timestamp":"2026-01-31T12:01:05.000Z","level":"info","message":"Rendering completed","job_id":"abc-123","duration_ms":4200}
{"timestamp":"2026-01-31T12:01:06.000Z","level":"info","message":"Upload completed","job_id":"abc-123","storage_path":"user-id/menu-id/export.pdf"}
{"timestamp":"2026-01-31T12:01:06.000Z","level":"info","message":"Job completed","job_id":"abc-123","total_duration_ms":6100}
```

### 5.5 Verify Job Completion

Check the job status in the database:

```sql
-- Check job status
SELECT id, status, file_url, error_message, completed_at
FROM export_jobs
ORDER BY created_at DESC
LIMIT 5;
```

**Expected result:**
- `status`: `completed`
- `file_url`: `https://[project].supabase.co/storage/v1/object/sign/export-files/...`
- `error_message`: `NULL`
- `completed_at`: Recent timestamp

### 5.6 Download and Verify Export

Copy the `file_url` from the database and open it in your browser. You should see:
- **PDF exports**: A properly formatted PDF of the menu
- **Image exports**: A PNG/JPEG image of the menu

---

## Step 6: Testing Failure Scenarios

Test that the worker handles failures gracefully:

### Test 1: Invalid Menu ID

```sql
INSERT INTO export_jobs (user_id, menu_id, export_type, status)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  '00000000-0000-0000-0000-000000000000', -- Invalid menu ID
  'pdf',
  'pending'
);
```

**Expected**: Job fails with error message, status = `failed`

### Test 2: Timeout

Set a very short timeout and create a job with a large menu:

```bash
# Stop current worker
docker stop railway-worker

# Restart with short timeout
docker run -p 3000:3000 --env-file _workers/.env -e JOB_TIMEOUT_SECONDS=5 railway-worker
```

**Expected**: Job fails with "TimeoutError" after 5 seconds

### Test 3: Storage Failure

Temporarily use an invalid storage bucket:

```bash
docker run -p 3000:3000 --env-file _workers/.env -e STORAGE_BUCKET=invalid-bucket railway-worker
```

**Expected**: Job fails with storage error, retries with backoff

---

## Step 7: Cleanup

When done testing:

```bash
# Stop worker container
docker stop railway-worker

# Remove container
docker rm railway-worker

# (Optional) Remove image
docker rmi railway-worker

# Clean up test jobs
# Run in Supabase SQL Editor:
DELETE FROM export_jobs WHERE metadata->>'test' = 'true';
```

---

## Common Issues and Solutions

### Issue: Worker can't connect to database

**Symptoms**: `Database connection failed` in logs

**Solutions**:
1. Verify `DATABASE_URL` is correct (check Supabase dashboard)
2. Check your IP is allowed in Supabase → Settings → Database → Connection Pooling
3. Try using connection pooler URL instead of direct connection

### Issue: Worker can't access storage

**Symptoms**: `Storage upload failed` in logs

**Solutions**:
1. Verify `export-files` bucket exists in Supabase Storage
2. Check `SUPABASE_SERVICE_ROLE_KEY` is correct (not anon key!)
3. Verify RLS policies allow service role access

### Issue: Puppeteer fails to launch

**Symptoms**: `Failed to launch browser` in logs

**Solutions**:
1. Ensure Docker has enough memory (increase to 4GB in Docker Desktop settings)
2. Check Chromium is installed in Docker image (rebuild if needed)
3. Try running with `--no-sandbox` flag (security risk, dev only)

### Issue: Jobs stuck in "pending"

**Symptoms**: Jobs never get processed

**Solutions**:
1. Check worker is running: `docker ps`
2. Check worker logs: `docker logs railway-worker`
3. Verify `available_at` timestamp is in the past:
   ```sql
   SELECT id, status, available_at FROM export_jobs WHERE status = 'pending';
   ```

### Issue: Email notifications not sending

**Symptoms**: Jobs complete but no email received

**Solutions**:
1. Check `SENDGRID_API_KEY` is valid
2. Verify `SENDGRID_FROM_EMAIL` is verified in SendGrid dashboard
3. For local testing, set `SENDGRID_API_KEY=disabled` to skip emails

---

## Next Steps

Once local testing is successful:

1. ✅ **Review logs** - Ensure no errors or warnings
2. ✅ **Test multiple jobs** - Create 5-10 jobs and verify all complete
3. ✅ **Test concurrent processing** - Create jobs while worker is busy
4. ✅ **Test retry logic** - Simulate failures and verify retries work
5. ✅ **Review performance** - Check job duration and memory usage

Then proceed to **Production Deployment** (see Railway deployment section in main README.md).

---

## Development Workflow

For ongoing development:

```bash
# 1. Make code changes in src/lib/worker/

# 2. Rebuild Docker image
docker build -t railway-worker .

# 3. Restart worker
docker stop railway-worker
docker rm railway-worker
docker run -d -p 3000:3000 --env-file _workers/.env --name railway-worker railway-worker

# 4. Test changes
docker logs -f railway-worker
```

---

## Useful Commands Reference

```bash
# Docker
docker build -t railway-worker .                    # Build image
docker run -p 3000:3000 --env-file _workers/.env railway-worker  # Run worker
docker ps                                           # List running containers
docker logs -f railway-worker                       # View logs
docker stop railway-worker                          # Stop worker
docker rm railway-worker                            # Remove container
docker system prune -a                              # Clean up Docker

# Health Check
curl http://localhost:3000/health                   # Check worker health

# Database
supabase db reset                                   # Reset local database
supabase migration up                               # Apply migrations
supabase db diff                                    # Check for schema changes

# Logs
docker logs railway-worker                          # View all logs
docker logs -f railway-worker                       # Follow logs (live)
docker logs --tail 50 railway-worker                # Last 50 lines
```

---

## Support

If you encounter issues not covered here:

1. Check worker logs: `docker logs railway-worker`
2. Check health endpoint: `curl http://localhost:3000/health`
3. Review database logs in Supabase Dashboard → Logs
4. Check storage logs in Supabase Dashboard → Storage → Logs
5. Review main README.md troubleshooting section

---

**Ready for Production?** See the main README.md "Deployment to Railway" section.
