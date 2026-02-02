# Getting Started with Railway Workers

Welcome! This guide helps you understand what you need to do to get the Railway Workers system running.

## What is Railway Workers?

Railway Workers is a background job processing system that:
- Takes PDF/image export requests from your Next.js app
- Processes them asynchronously using Puppeteer (headless Chrome)
- Uploads the results to Supabase Storage
- Notifies users when complete

**Why?** Vercel serverless functions have a 10-second timeout. Large menu exports can take 30+ seconds, so we offload them to Railway workers that can run longer.

---

## The Big Picture

```
Your Next.js App (Vercel)
    ↓
Creates export job in database
    ↓
Returns immediately to user (< 100ms)
    ↓
Railway Worker picks up job
    ↓
Renders PDF/image with Puppeteer
    ↓
Uploads to Supabase Storage
    ↓
Updates job status to "completed"
    ↓
User gets notification + download link
```

---

## What You Need to Set Up

### 1. Database (Supabase)
- **What**: Two new database migrations
- **Why**: Creates the `export_jobs` table and job claiming function
- **Files**: 
  - `supabase/migrations/036_create_export_jobs_table.sql`
  - `supabase/migrations/037_claim_export_job_function.sql`

### 2. Storage (Supabase)
- **What**: A new storage bucket called `export-files`
- **Why**: Stores the generated PDF and image files
- **Config**: Private bucket, 10MB limit, PDF/PNG/JPEG allowed

### 3. Environment Variables
- **What**: Configuration file with credentials
- **Why**: Worker needs to connect to your database and storage
- **File**: `_workers/.env` (copy from `.env.example`)

### 4. Docker Image
- **What**: A containerized version of the worker
- **Why**: Includes Node.js, Chromium, and your worker code
- **Command**: `docker build -t railway-worker .`

### 5. Worker Process
- **What**: The actual worker running and polling for jobs
- **Why**: This is what processes the export jobs
- **Command**: `docker run -p 3000:3000 --env-file _workers/.env railway-worker`

---

## Setup Order (The Answer to Your Question!)

Here's the correct order:

### For Local Testing:

1. **Database migrations** → Creates tables
2. **Storage bucket** → Creates storage
3. **Environment file** → Configures worker
4. **Docker build** → Builds worker image
5. **Run worker** → Starts processing jobs
6. **Test** → Create a job and verify it works

### For Production:

1. **Apply migrations to production database** → Same migrations, production DB
2. **Create production storage bucket** → Same bucket, production storage
3. **Set up Railway project** → Create Railway account and project
4. **Configure Railway environment variables** → Production credentials
5. **Deploy to Railway** → `railway up`
6. **Test in production** → Create real export job

---

## Local vs Production: What's Different?

| Aspect | Local | Production |
|--------|-------|------------|
| **Database** | Local Supabase or dev instance | Production Supabase |
| **Storage** | Dev storage bucket | Production storage bucket |
| **Credentials** | Dev keys | Production keys (different!) |
| **Worker runs on** | Your computer (Docker) | Railway cloud servers |
| **Cost** | Free | ~$5-10/month per worker |
| **Always running?** | No (you start/stop it) | Yes (24/7) |
| **Accessible to app?** | No (localhost only) | Yes (public endpoint) |

**Important**: You MUST test locally first before deploying to production!

---

## Do I Need Railway for Local Testing?

**No!** For local testing:
- ✅ You need Docker (to run the worker)
- ✅ You need Supabase (database + storage)
- ❌ You DON'T need Railway

Railway is only for production deployment. For local testing, you run the worker in Docker on your own computer.

---

## Configuration: Local vs Production

### Local Configuration (`_workers/.env`)
```bash
# Use local or dev Supabase
DATABASE_URL=postgresql://postgres:password@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Dev key

# Can disable email for testing
SENDGRID_API_KEY=disabled

# Development settings
NODE_ENV=development
LOG_LEVEL=debug
WORKER_ID=local-worker-1
```

### Production Configuration (Railway)
```bash
# Use production Supabase
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Production key (different!)

# Real email
SENDGRID_API_KEY=SG.real_key_here

# Production settings
NODE_ENV=production
LOG_LEVEL=info
WORKER_ID=worker-1
```

**Critical**: Never use production credentials for local testing!

---

## Step-by-Step: What to Do Now

### Phase 1: Local Testing (Do This First!)

1. **Read the Quick Start** → [QUICK_START.md](./QUICK_START.md)
   - 10-minute overview
   - Gets you running quickly

2. **Follow the Setup Flow** → [SETUP_FLOW.md](./SETUP_FLOW.md)
   - Visual diagram of the process
   - Shows the correct order

3. **Use the Detailed Guide** → [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md)
   - Step-by-step instructions
   - Troubleshooting for each step

4. **Track Your Progress** → [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)
   - Checkbox list
   - Don't miss any steps

### Phase 2: Production Deployment (After Local Works!)

1. **Apply Migrations to Production**
   - Same migrations, production database
   - Use Supabase Dashboard SQL Editor

2. **Create Production Storage**
   - Same bucket name: `export-files`
   - Production Supabase project

3. **Set Up Railway**
   - Create Railway account
   - Create new project
   - Set environment variables (production credentials!)

4. **Deploy**
   - `railway up`
   - Monitor logs
   - Test with real export job

5. **Scale (Optional)**
   - Add more workers if needed
   - Each worker needs unique `WORKER_ID`

---

## Common Questions

### Q: Do I run migrations before or after Docker build?
**A**: Before! Migrations create the database tables. The worker needs those tables to exist.

### Q: Can I test without Docker?
**A**: Technically yes (run `node dist/lib/worker/index.js`), but Docker is recommended because:
- Ensures consistent environment
- Includes Chromium automatically
- Matches production setup

### Q: Do I need SendGrid for local testing?
**A**: No! Set `SENDGRID_API_KEY=disabled` in your local `.env` file. The worker will skip sending emails.

### Q: How do I know if it's working?
**A**: 
1. Health check returns healthy: `curl http://localhost:3000/health`
2. Worker logs show "Worker ready"
3. Create a test job → Worker processes it → Job status becomes "completed"

### Q: What if something goes wrong?
**A**: Check the troubleshooting sections in:
- [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) → Common Issues
- [SETUP_FLOW.md](./SETUP_FLOW.md) → Troubleshooting Decision Tree
- [README.md](./README.md) → Troubleshooting

### Q: How long does setup take?
**A**: 
- Local setup: 15-30 minutes (first time)
- Production deployment: 10-15 minutes (after local works)

### Q: Can I skip local testing and go straight to production?
**A**: **No!** Always test locally first. It's much easier to debug issues locally than in production.

---

## Your Next Step

**Start here**: [QUICK_START.md](./QUICK_START.md)

This will get you running in 10 minutes and help you understand if everything is set up correctly.

---

## Need Help?

1. **Quick questions**: Check [QUICK_START.md](./QUICK_START.md)
2. **Setup issues**: Check [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) → Common Issues
3. **Order confusion**: Check [SETUP_FLOW.md](./SETUP_FLOW.md)
4. **Production issues**: Check [README.md](./README.md) → Troubleshooting

---

**Ready?** Let's go! → [QUICK_START.md](./QUICK_START.md)
