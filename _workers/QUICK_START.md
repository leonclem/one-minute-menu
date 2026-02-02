# Railway Workers - Quick Start

**TL;DR**: Get the Railway Workers running locally in 10 minutes.

## Prerequisites

- Docker Desktop running
- Supabase project (local or remote)
- 10 minutes

## Step-by-Step

### 1. Database Setup (2 minutes)

Run these two migrations in Supabase SQL Editor:

```bash
# Copy and paste into SQL Editor:
supabase/migrations/036_create_export_jobs_table.sql
supabase/migrations/037_claim_export_job_function.sql
```

Or use CLI:
```bash
supabase db reset
```

### 2. Storage Setup (1 minute)

In Supabase Dashboard → Storage → New Bucket:
- Name: `export-files`
- Public: ❌ No
- Size limit: 10MB

### 3. Environment Setup (2 minutes)

**Option A: Add to root `.env.local` (if you already have one)**

```bash
# Add these to your existing .env.local:
SUPABASE_URL=http://localhost:54321  # Same as NEXT_PUBLIC_SUPABASE_URL
STORAGE_BUCKET=export-files
SENDGRID_FROM_EMAIL=exports@gridmenu.ai
WORKER_ID=local-worker-1
```

**Option B: Create separate `_workers/.env`**

```bash
cd _workers
copy .env.example .env
notepad .env
```

Edit these required values:
```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT].supabase.co  # Without NEXT_PUBLIC_ prefix
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
STORAGE_BUCKET=export-files
SENDGRID_API_KEY=disabled  # For testing
SENDGRID_FROM_EMAIL=test@example.com
WORKER_ID=local-worker-1
```

Get credentials from: Supabase Dashboard → Settings → API

### 4. Build & Run (5 minutes)

```bash
# Build (from project root)
docker build -t railway-worker .

# Run (choose based on your env file location)
# If using root .env.local:
docker run -p 3000:3000 --env-file .env.local railway-worker

# If using _workers/.env:
docker run -p 3000:3000 --env-file _workers/.env railway-worker
```

### 5. Test (1 minute)

```bash
# Check health
curl http://localhost:3000/health

# Create test job (in Supabase SQL Editor)
INSERT INTO export_jobs (user_id, menu_id, export_type, status)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM menus LIMIT 1),
  'pdf',
  'pending'
);
```

Watch the worker logs - you should see it process the job!

## Expected Output

```json
{"level":"info","message":"Worker starting","worker_id":"local-worker-1"}
{"level":"info","message":"Database connection OK"}
{"level":"info","message":"Storage connection OK"}
{"level":"info","message":"Worker ready"}
{"level":"info","message":"Job claimed","job_id":"abc-123"}
{"level":"info","message":"Job completed","job_id":"abc-123"}
```

## Troubleshooting

**Worker won't start?**
- Check Docker is running: `docker ps`
- Check `.env` file exists: `dir _workers\.env`
- Check credentials are correct

**Can't connect to database?**
- Verify `DATABASE_URL` in Supabase Dashboard → Settings → Database
- Check your IP is allowed in Supabase settings

**Jobs not processing?**
- Check migrations ran: `SELECT * FROM export_jobs LIMIT 1;`
- Check bucket exists: Supabase Dashboard → Storage
- Check worker logs: `docker logs railway-worker`

## Next Steps

✅ **Working?** See [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) for detailed testing

✅ **Ready for production?** See [README.md](./README.md) → Deployment to Railway

✅ **Need help?** See [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) for comprehensive checklist

## Common Commands

```bash
# View logs
docker logs -f railway-worker

# Stop worker
docker stop railway-worker

# Restart worker
docker restart railway-worker

# Rebuild after code changes
docker build -t railway-worker . && docker restart railway-worker
```

---

**Still stuck?** Check the full [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) for detailed troubleshooting.
