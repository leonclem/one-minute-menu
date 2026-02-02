# Railway Workers Setup Flow

Visual guide showing the correct order for local and production setup.

## Local Testing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL TESTING SETUP                         │
└─────────────────────────────────────────────────────────────────┘

Step 1: Database Setup
┌──────────────────────────────────────┐
│  Run Supabase Migrations             │
│  ├─ 036_create_export_jobs_table.sql │
│  └─ 037_claim_export_job_function.sql│
│                                       │
│  Creates:                             │
│  • export_jobs table                  │
│  • claim_export_job() function        │
│  • RLS policies                       │
│  • Indexes                            │
└──────────────────────────────────────┘
           ↓
Step 2: Storage Setup
┌──────────────────────────────────────┐
│  Create Supabase Storage Bucket      │
│                                       │
│  Bucket: export-files                 │
│  • Private (not public)               │
│  • 10MB file size limit               │
│  • PDF, PNG, JPEG allowed             │
│  • RLS policies for service role      │
└──────────────────────────────────────┘
           ↓
Step 3: Environment Configuration
┌──────────────────────────────────────┐
│  Create _workers/.env file           │
│                                       │
│  Required:                            │
│  • DATABASE_URL                       │
│  • SUPABASE_URL                       │
│  • SUPABASE_SERVICE_ROLE_KEY          │
│  • STORAGE_BUCKET=export-files        │
│  • SENDGRID_API_KEY (or "disabled")   │
│  • WORKER_ID=local-worker-1           │
└──────────────────────────────────────┘
           ↓
Step 4: Docker Build
┌──────────────────────────────────────┐
│  Build Worker Docker Image           │
│                                       │
│  $ docker build -t railway-worker .  │
│                                       │
│  Image includes:                      │
│  • Node.js 20                         │
│  • Chromium browser                   │
│  • Worker code (compiled TypeScript)  │
│  • Dependencies                       │
└──────────────────────────────────────┘
           ↓
Step 5: Run Worker
┌──────────────────────────────────────┐
│  Start Worker Container              │
│                                       │
│  $ docker run -p 3000:3000 \         │
│    --env-file _workers/.env \        │
│    railway-worker                     │
│                                       │
│  Worker:                              │
│  • Connects to database               │
│  • Connects to storage                │
│  • Starts polling for jobs            │
│  • Exposes health endpoint :3000      │
└──────────────────────────────────────┘
           ↓
Step 6: Test
┌──────────────────────────────────────┐
│  Create Test Export Job              │
│                                       │
│  INSERT INTO export_jobs ...         │
│                                       │
│  Worker:                              │
│  • Claims job                         │
│  • Renders PDF/image                  │
│  • Uploads to storage                 │
│  • Updates job status                 │
│  • Sends notification (if enabled)    │
└──────────────────────────────────────┘
           ↓
Step 7: Verify
┌──────────────────────────────────────┐
│  Check Results                       │
│                                       │
│  • Job status = "completed"           │
│  • file_url populated                 │
│  • Export file downloadable           │
│  • No errors in logs                  │
└──────────────────────────────────────┘

✅ Local testing complete!
```

---

## Production Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  PRODUCTION DEPLOYMENT                          │
└─────────────────────────────────────────────────────────────────┘

Prerequisites: Local testing successful ✅

Step 1: Production Database
┌──────────────────────────────────────┐
│  Apply Migrations to Production      │
│                                       │
│  Option A: Supabase Dashboard        │
│  • Open SQL Editor                    │
│  • Run 036_*.sql                      │
│  • Run 037_*.sql                      │
│                                       │
│  Option B: Supabase CLI               │
│  • supabase link --project-ref XXX    │
│  • supabase db push                   │
└──────────────────────────────────────┘
           ↓
Step 2: Production Storage
┌──────────────────────────────────────┐
│  Create Production Storage Bucket    │
│                                       │
│  Same as local:                       │
│  • Bucket: export-files               │
│  • Private, 10MB limit                │
│  • RLS policies                       │
└──────────────────────────────────────┘
           ↓
Step 3: Railway Project Setup
┌──────────────────────────────────────┐
│  Create Railway Project              │
│                                       │
│  $ railway login                      │
│  $ railway init                       │
│                                       │
│  Configure:                           │
│  • Link GitHub repo (optional)        │
│  • Set region (us-west1)              │
│  • Set resources (2GB RAM, 1 CPU)     │
└──────────────────────────────────────┘
           ↓
Step 4: Railway Environment Variables
┌──────────────────────────────────────┐
│  Set Production Environment Vars     │
│                                       │
│  $ railway variables set \            │
│    DATABASE_URL="..." \               │
│    SUPABASE_URL="..." \               │
│    SUPABASE_SERVICE_ROLE_KEY="..." \  │
│    STORAGE_BUCKET="export-files" \    │
│    SENDGRID_API_KEY="..." \           │
│    WORKER_ID="worker-1" \             │
│    NODE_ENV="production"              │
│                                       │
│  ⚠️  Use PRODUCTION credentials!      │
└──────────────────────────────────────┘
           ↓
Step 5: Deploy to Railway
┌──────────────────────────────────────┐
│  Deploy Worker                       │
│                                       │
│  $ railway up                         │
│                                       │
│  Railway:                             │
│  • Builds Docker image                │
│  • Deploys to cloud                   │
│  • Starts worker                      │
│  • Exposes health endpoint            │
└──────────────────────────────────────┘
           ↓
Step 6: Verify Deployment
┌──────────────────────────────────────┐
│  Check Production Worker             │
│                                       │
│  $ railway logs                       │
│  $ curl https://worker.railway.app/health │
│                                       │
│  Verify:                              │
│  • No startup errors                  │
│  • Database connected                 │
│  • Storage connected                  │
│  • Polling for jobs                   │
└──────────────────────────────────────┘
           ↓
Step 7: Production Test
┌──────────────────────────────────────┐
│  Create Real Export Job              │
│                                       │
│  Use your application:                │
│  • Click export button                │
│  • Wait for completion                │
│  • Download export file               │
│  • Verify email received              │
└──────────────────────────────────────┘
           ↓
Step 8: Scale (Optional)
┌──────────────────────────────────────┐
│  Add More Workers                    │
│                                       │
│  $ railway service create worker-2    │
│  $ railway variables set \            │
│    WORKER_ID="worker-2" \             │
│    --service worker-2                 │
│                                       │
│  Repeat for worker-3, worker-4, etc.  │
└──────────────────────────────────────┘

✅ Production deployment complete!
```

---

## Configuration Differences: Local vs Production

| Setting | Local | Production |
|---------|-------|------------|
| **DATABASE_URL** | Local Supabase or dev instance | Production Supabase |
| **SUPABASE_URL** | `http://localhost:54321` or dev | `https://[project].supabase.co` |
| **SUPABASE_SERVICE_ROLE_KEY** | Dev key | Production key (different!) |
| **SENDGRID_API_KEY** | `disabled` (optional) | Real SendGrid key |
| **WORKER_ID** | `local-worker-1` | `worker-1`, `worker-2`, etc. |
| **NODE_ENV** | `development` | `production` |
| **LOG_LEVEL** | `debug` | `info` or `warn` |
| **POLLING_INTERVAL_BUSY_MS** | `1000` (faster) | `2000` (default) |
| **ENABLE_CANARY_EXPORT** | `false` (skip) | `true` (verify on startup) |
| **MAX_CONCURRENT_RENDERS** | `2` (lower) | `3` (default) |

---

## Railway vs Local: Key Differences

### Local Testing
- ✅ Fast iteration (rebuild in seconds)
- ✅ Easy debugging (direct log access)
- ✅ No cost
- ✅ Can disable email
- ❌ Not always running
- ❌ Not accessible to production app
- ❌ Limited resources

### Railway Production
- ✅ Always running (24/7)
- ✅ Accessible to production app
- ✅ Scalable (multiple workers)
- ✅ Automatic restarts on failure
- ✅ Health monitoring
- ❌ Slower iteration (deploy takes 2-3 min)
- ❌ Costs money (but cheap: ~$5-10/month per worker)
- ❌ Harder to debug (remote logs)

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Using Production Credentials Locally
**Problem**: Accidentally using production database/storage for local testing

**Solution**: 
- Keep separate `.env` files
- Use local Supabase instance for testing
- Never commit `.env` files to git

### ❌ Mistake 2: Skipping Migrations
**Problem**: Worker can't find `export_jobs` table

**Solution**: 
- Always run migrations FIRST
- Verify with `SELECT * FROM export_jobs;`
- Check migration history

### ❌ Mistake 3: Wrong Supabase Key
**Problem**: Using anon key instead of service role key

**Solution**: 
- Use SERVICE ROLE key (starts with `eyJhbGc...`)
- NOT the anon/public key
- Check Supabase Dashboard → Settings → API

### ❌ Mistake 4: Missing Storage Bucket
**Problem**: Worker fails with "Bucket not found"

**Solution**: 
- Create `export-files` bucket BEFORE running worker
- Verify in Supabase Dashboard → Storage
- Check bucket name matches `STORAGE_BUCKET` env var

### ❌ Mistake 5: Docker Not Running
**Problem**: `docker build` fails with connection error

**Solution**: 
- Start Docker Desktop
- Wait for it to fully start (green icon)
- Try `docker ps` to verify

### ❌ Mistake 6: Wrong Directory
**Problem**: `.env` file not found

**Solution**: 
- `.env` goes in `_workers/` directory
- Run `docker run` from project root
- Use `--env-file _workers/.env` (note the path)

---

## Troubleshooting Decision Tree

```
Worker won't start?
├─ Docker not running?
│  └─ Start Docker Desktop
├─ Image not built?
│  └─ Run: docker build -t railway-worker .
├─ .env file missing?
│  └─ Copy .env.example to .env
└─ Check logs: docker logs railway-worker

Worker starts but can't connect to database?
├─ Wrong DATABASE_URL?
│  └─ Check Supabase Dashboard → Settings → Database
├─ IP not allowed?
│  └─ Check Supabase → Settings → Database → Connection Pooling
└─ Wrong credentials?
   └─ Verify service role key, not anon key

Worker connects but jobs don't process?
├─ Migrations not run?
│  └─ Run 036 and 037 migrations
├─ No jobs in queue?
│  └─ Create test job: INSERT INTO export_jobs ...
├─ Jobs in future?
│  └─ Check available_at <= NOW()
└─ Check logs: docker logs -f railway-worker

Jobs fail with storage error?
├─ Bucket doesn't exist?
│  └─ Create export-files bucket
├─ Wrong bucket name?
│  └─ Check STORAGE_BUCKET env var
├─ Wrong credentials?
│  └─ Verify service role key
└─ RLS policies blocking?
   └─ Check storage.objects policies

Jobs fail with Puppeteer error?
├─ Out of memory?
│  └─ Increase Docker memory to 4GB
├─ Chromium not installed?
│  └─ Rebuild Docker image
└─ Invalid HTML?
   └─ Check menu data is valid
```

---

## Quick Reference: Essential Commands

### Local Development
```bash
# Build
docker build -t railway-worker .

# Run
docker run -p 3000:3000 --env-file _workers/.env railway-worker

# Run in background
docker run -d -p 3000:3000 --env-file _workers/.env --name railway-worker railway-worker

# View logs
docker logs -f railway-worker

# Stop
docker stop railway-worker

# Remove
docker rm railway-worker

# Rebuild and restart
docker build -t railway-worker . && \
docker stop railway-worker && \
docker rm railway-worker && \
docker run -d -p 3000:3000 --env-file _workers/.env --name railway-worker railway-worker
```

### Railway Production
```bash
# Login
railway login

# Initialize
railway init

# Deploy
railway up

# View logs
railway logs

# Restart
railway restart

# Set variable
railway variables set KEY=value

# Scale
railway service create worker-2
```

### Database
```bash
# Apply migrations
supabase db reset

# Check migration status
supabase migration list

# Create new migration
supabase migration new migration_name

# Push to production
supabase db push
```

---

## Next Steps

1. ✅ **Start here**: [QUICK_START.md](./QUICK_START.md) - 10 minute setup
2. 📖 **Detailed guide**: [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) - Step-by-step
3. ☑️  **Track progress**: [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - Checklist
4. 🚀 **Deploy**: [README.md](./README.md) - Production deployment
5. 📚 **API docs**: [API.md](./API.md) - Integration guide

---

**Questions?** Check the troubleshooting sections in each guide!
