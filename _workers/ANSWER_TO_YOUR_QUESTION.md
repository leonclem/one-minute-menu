# Answer to Your Question

> "Do I run the Docker Build steps, then run Supabase migrations? Is that the correct order. What else? Do I need to configure Railway for local testing? Is there a different configuration for Prod?"

## Short Answer

**For Local Testing:**
1. ✅ Run Supabase migrations FIRST
2. ✅ Create storage bucket
3. ✅ Configure environment file
4. ✅ THEN run Docker build
5. ✅ THEN run the worker
6. ❌ NO Railway needed for local testing

**For Production:**
1. ✅ Test locally first (above steps)
2. ✅ Apply migrations to production database
3. ✅ Create production storage bucket
4. ✅ Configure Railway with production credentials
5. ✅ Deploy to Railway

---

## Detailed Answer

### Correct Order for Local Testing

```
Step 1: Database Setup (Migrations)
├─ Run: supabase/migrations/036_create_export_jobs_table.sql
└─ Run: supabase/migrations/037_claim_export_job_function.sql

Step 2: Storage Setup
└─ Create "export-files" bucket in Supabase Storage

Step 3: Environment Configuration
├─ Copy: _workers/.env.example → _workers/.env
└─ Edit: Fill in your local/dev credentials

Step 4: Docker Build
└─ Run: docker build -t railway-worker .

Step 5: Run Worker
└─ Run: docker run -p 3000:3000 --env-file _workers/.env railway-worker

Step 6: Test
└─ Create a test export job and verify it processes
```

**Why this order?**
- Migrations must run first because the worker needs the `export_jobs` table to exist
- Storage bucket must exist before worker tries to upload files
- Environment file must exist before Docker can use it
- Docker build must complete before you can run the worker

---

## Do You Need Railway for Local Testing?

**NO!**

Railway is only for production deployment. For local testing:

| Component | Local Testing | Production |
|-----------|---------------|------------|
| **Worker runs on** | Your computer (Docker) | Railway cloud |
| **Database** | Local/dev Supabase | Production Supabase |
| **Storage** | Dev storage bucket | Production storage bucket |
| **Cost** | Free | ~$5-10/month |
| **Setup needed** | Docker only | Railway account + config |

---

## Configuration Differences: Local vs Production

### Important: Environment Variable Naming

**SUPABASE_URL vs NEXT_PUBLIC_SUPABASE_URL**

Your project uses both:
- **`NEXT_PUBLIC_SUPABASE_URL`** - For Next.js frontend (browser-side)
- **`SUPABASE_URL`** - For server-side code and Railway worker

**Why both?**
- Next.js prefixes client-side env vars with `NEXT_PUBLIC_`
- The Railway worker is a separate Node.js process (not Next.js)
- It needs `SUPABASE_URL` without the prefix

**Solution**: Set both to the same value:
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321  # For Next.js frontend
SUPABASE_URL=http://localhost:54321              # For Railway worker
```

### Local Configuration (`root .env.local` or `_workers/.env`)

```bash
# Local/Dev Supabase
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
# OR your dev Supabase instance:
# DATABASE_URL=postgresql://postgres:password@db.dev-project.supabase.co:5432/postgres

SUPABASE_URL=http://localhost:54321
# OR: https://dev-project.supabase.co

SUPABASE_SERVICE_ROLE_KEY=eyJ... # Dev service role key

# Can disable email for testing
SENDGRID_API_KEY=disabled
SENDGRID_FROM_EMAIL=test@example.com

# Development settings
WORKER_ID=local-worker-1
NODE_ENV=development
LOG_LEVEL=debug
POLLING_INTERVAL_BUSY_MS=1000
ENABLE_CANARY_EXPORT=false
```

### Production Configuration (Railway Environment Variables)

```bash
# Production Supabase
DATABASE_URL=postgresql://postgres:PROD_PASSWORD@db.prod-project.supabase.co:5432/postgres

SUPABASE_URL=https://prod-project.supabase.co

SUPABASE_SERVICE_ROLE_KEY=eyJ... # DIFFERENT production key!

# Real email
SENDGRID_API_KEY=SG.real_production_key
SENDGRID_FROM_EMAIL=exports@yourdomain.com

# Production settings
WORKER_ID=worker-1
NODE_ENV=production
LOG_LEVEL=info
POLLING_INTERVAL_BUSY_MS=2000
ENABLE_CANARY_EXPORT=true
```

**Key Differences:**
- ✅ Different database URLs (local vs production)
- ✅ Different Supabase service role keys (dev vs prod)
- ✅ Different SendGrid keys (or disabled vs real)
- ✅ Different worker IDs
- ✅ Different log levels (debug vs info)

---

## What Else Do You Need?

### Prerequisites

Before starting, make sure you have:

1. **Docker Desktop** installed and running
   - Download: https://www.docker.com/products/docker-desktop
   - Verify: `docker --version`

2. **Supabase project** (local or remote)
   - Local: `supabase start`
   - Remote: Create project at https://supabase.com

3. **Supabase CLI** (optional but helpful)
   - Install: `npm install -g supabase`
   - Verify: `supabase --version`

4. **SendGrid account** (optional for local testing)
   - Can set `SENDGRID_API_KEY=disabled` for testing
   - For production: Sign up at https://sendgrid.com

### Files You Need

All these files should already exist in your project:

- ✅ `Dockerfile` (root directory)
- ✅ `_workers/.env.example` (template)
- ✅ `supabase/migrations/036_create_export_jobs_table.sql`
- ✅ `supabase/migrations/037_claim_export_job_function.sql`
- ✅ `src/lib/worker/index.ts` (worker code)

You need to create:
- ❌ `_workers/.env` (copy from `.env.example`)

---

## Step-by-Step: What to Do Right Now

### Phase 1: Local Testing (Start Here!)

**1. Apply Database Migrations**

Option A - Using Supabase CLI (easiest):
```bash
supabase db reset
```

Option B - Using Supabase Dashboard:
- Open Supabase Dashboard → SQL Editor
- Copy/paste contents of `036_create_export_jobs_table.sql`
- Click "Run"
- Copy/paste contents of `037_claim_export_job_function.sql`
- Click "Run"

**2. Create Storage Bucket**

- Open Supabase Dashboard → Storage
- Click "New bucket"
- Name: `export-files`
- Public: ❌ No (private)
- File size limit: 10MB
- Allowed types: PDF, PNG, JPEG (application/pdf, image/png, image/jpeg)
- Click "Create"

**3. Configure Environment**

**Option A: Add to Root `.env.local` (Recommended)**

If you already have a root `.env.local` file with Supabase and SendGrid configured, just add these Railway-specific variables:

```bash
# Add these to your root .env.local file:

# Supabase URL (without NEXT_PUBLIC_ prefix - for server-side/worker use)
SUPABASE_URL=http://localhost:54321  # Same as NEXT_PUBLIC_SUPABASE_URL

# Railway Workers Configuration
STORAGE_BUCKET=export-files
SENDGRID_FROM_EMAIL=exports@gridmenu.ai  # Or your preferred sender email
WORKER_ID=local-worker-1
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
NODE_ENV=development
LOG_LEVEL=debug
```

**Note**: You likely already have these (no need to duplicate):
- ✅ `DATABASE_URL` - Already configured
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Already configured
- ✅ `SENDGRID_API_KEY` - Already configured

**Option B: Separate `_workers/.env` File**

If you prefer to keep worker config separate:

```bash
cd _workers
copy .env.example .env
notepad .env
```

Edit these required values:
- `DATABASE_URL` - Copy from root `.env.local`
- `SUPABASE_URL` - Same as `NEXT_PUBLIC_SUPABASE_URL` (without the prefix)
- `SUPABASE_SERVICE_ROLE_KEY` - Copy from root `.env.local`
- `STORAGE_BUCKET=export-files`
- `SENDGRID_API_KEY` - Copy from root `.env.local`
- `SENDGRID_FROM_EMAIL=exports@gridmenu.ai`
- `WORKER_ID=local-worker-1`

**4. Build Docker Image**

```bash
# From project root
docker build -t railway-worker .
```

This takes 5-10 minutes the first time.

**5. Run Worker**

```bash
# If using root .env.local:
docker run -p 3000:3000 --env-file .env.local railway-worker

# If using separate _workers/.env:
docker run -p 3000:3000 --env-file _workers/.env railway-worker
```

You should see:
```json
{"level":"info","message":"Worker starting","worker_id":"local-worker-1"}
{"level":"info","message":"Database connection OK"}
{"level":"info","message":"Storage connection OK"}
{"level":"info","message":"Worker ready"}
```

**6. Test It**

Open another terminal:
```bash
# Check health
curl http://localhost:3000/health
```

Create a test job in Supabase SQL Editor:
```sql
INSERT INTO export_jobs (user_id, menu_id, export_type, status)
VALUES (
  (SELECT id FROM profiles LIMIT 1),
  (SELECT id FROM menus LIMIT 1),
  'pdf',
  'pending'
);
```

Watch the worker logs - it should process the job!

### Phase 2: Production Deployment (After Local Works!)

**1. Apply Migrations to Production**

Same migrations, but run them on your production Supabase:
- Open production Supabase Dashboard → SQL Editor
- Run `036_create_export_jobs_table.sql`
- Run `037_claim_export_job_function.sql`

**2. Create Production Storage Bucket**

Same as local, but in production Supabase:
- Name: `export-files`
- Private, 10MB, PDF/PNG/JPEG

**3. Set Up Railway**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init
```

**4. Configure Railway Environment Variables**

```bash
railway variables set DATABASE_URL="postgresql://postgres:PROD_PASSWORD@db.prod-project.supabase.co:5432/postgres"
railway variables set SUPABASE_URL="https://prod-project.supabase.co"
railway variables set SUPABASE_SERVICE_ROLE_KEY="eyJ..."
railway variables set STORAGE_BUCKET="export-files"
railway variables set SENDGRID_API_KEY="SG.real_key"
railway variables set SENDGRID_FROM_EMAIL="exports@yourdomain.com"
railway variables set WORKER_ID="worker-1"
railway variables set NODE_ENV="production"
railway variables set LOG_LEVEL="info"
railway variables set PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
```

**5. Deploy**

```bash
railway up
```

**6. Verify**

```bash
# Check logs
railway logs

# Check health (get URL from Railway dashboard)
curl https://your-worker.railway.app/health
```

**7. Test in Production**

Use your actual application to create an export job. The Railway worker should process it!

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Running Docker build before migrations
**Problem**: Worker starts but can't find `export_jobs` table

**Solution**: Run migrations FIRST, then Docker build

### ❌ Mistake 2: Using production credentials locally
**Problem**: Local testing affects production data

**Solution**: Use separate dev/local Supabase instance for testing

### ❌ Mistake 3: Forgetting to create storage bucket
**Problem**: Worker fails with "Bucket not found"

**Solution**: Create `export-files` bucket BEFORE running worker

### ❌ Mistake 4: Using anon key instead of service role key
**Problem**: Worker can't access database/storage

**Solution**: Use SERVICE ROLE key from Supabase Dashboard → Settings → API

### ❌ Mistake 5: Wrong .env file location
**Problem**: Docker can't find environment file

**Solution**: `.env` goes in `_workers/` directory, use `--env-file _workers/.env`

---

## Quick Reference

### Essential Commands

```bash
# Migrations
supabase db reset                    # Apply all migrations

# Docker
docker build -t railway-worker .     # Build image
docker run -p 3000:3000 --env-file _workers/.env railway-worker  # Run
docker logs -f railway-worker        # View logs
docker stop railway-worker           # Stop

# Railway (production only)
railway login                        # Login
railway up                           # Deploy
railway logs                         # View logs
railway restart                      # Restart
```

### Essential Files

```
Project Root/
├── Dockerfile                       # Worker container definition
├── _workers/
│   ├── .env.example                 # Template (copy to .env)
│   ├── .env                         # Your config (create this!)
│   └── README.md                    # Main documentation
├── supabase/migrations/
│   ├── 036_create_export_jobs_table.sql    # Run first
│   └── 037_claim_export_job_function.sql   # Run second
└── src/lib/worker/
    └── index.ts                     # Worker code
```

---

## Docker Build Status

✅ **FIXED!** The Docker build is now working successfully. All TypeScript path aliases have been resolved correctly.

**What was fixed:**
- Created `fix-paths.js` script to resolve `@/` imports post-compilation
- Updated Dockerfile to run path fixing after TypeScript compilation
- Verified all modules load correctly

**See**: [DOCKER_BUILD_SUCCESS.md](./DOCKER_BUILD_SUCCESS.md) for detailed verification results and deployment instructions.

---

## Summary

**Your Question**: "Do I run Docker Build steps, then run Supabase migrations?"

**Answer**: No, opposite order!

1. ✅ Supabase migrations FIRST
2. ✅ Storage bucket
3. ✅ Environment file
4. ✅ Docker build
5. ✅ Run worker

**Your Question**: "Do I need to configure Railway for local testing?"

**Answer**: No! Railway is only for production. For local testing, just use Docker.

**Your Question**: "Is there a different configuration for Prod?"

**Answer**: Yes! Different credentials:
- Different database URL
- Different Supabase service role key
- Different SendGrid key
- Different worker ID
- Different log level

---

## Next Steps

1. **Read**: [GETTING_STARTED.md](./GETTING_STARTED.md) - Overview
2. **Follow**: [QUICK_START.md](./QUICK_START.md) - 10-minute setup
3. **Reference**: [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) - Detailed guide
4. **Track**: [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - Checklist

---

**Still confused?** Check [SETUP_FLOW.md](./SETUP_FLOW.md) for a visual diagram!
