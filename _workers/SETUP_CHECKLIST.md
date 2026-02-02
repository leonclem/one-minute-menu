# Railway Workers Setup Checklist

Use this checklist to track your setup progress.

## Local Testing Setup

### Prerequisites
- [ ] Node.js 20+ installed
- [ ] Docker Desktop installed and running
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Supabase project created (or local instance running)

### Database Setup
- [ ] Migration 036 applied (`export_jobs` table created)
- [ ] Migration 037 applied (`claim_export_job` function created)
- [ ] Verified table exists: `SELECT * FROM export_jobs LIMIT 1;`
- [ ] Verified function exists: `SELECT claim_export_job('test');`
- [ ] Verified realtime enabled for `export_jobs` table

### Storage Setup
- [ ] `export-files` bucket created in Supabase Storage
- [ ] Bucket configured as private (not public)
- [ ] File size limit set to 10MB
- [ ] Allowed MIME types configured (pdf, png, jpeg)
- [ ] RLS policies created for service role access
- [ ] Verified bucket exists: `SELECT * FROM storage.buckets WHERE id = 'export-files';`

### Environment Configuration
- [ ] Copied `_workers/.env.example` to `_workers/.env`
- [ ] Set `DATABASE_URL` (from Supabase Dashboard → Settings → Database)
- [ ] Set `SUPABASE_URL` (from Supabase Dashboard → Settings → API)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` (from Supabase Dashboard → Settings → API)
- [ ] Set `STORAGE_BUCKET=export-files`
- [ ] Set `SENDGRID_API_KEY` (or set to `disabled` for testing)
- [ ] Set `SENDGRID_FROM_EMAIL`
- [ ] Set `WORKER_ID=local-worker-1`
- [ ] Set `NODE_ENV=development`
- [ ] Set `LOG_LEVEL=debug`

### Docker Build
- [ ] Built Docker image: `docker build -t railway-worker .`
- [ ] Verified image created: `docker images | findstr railway-worker`
- [ ] Image size reasonable (~1-2GB)

### Local Testing
- [ ] Started worker container: `docker run -p 3000:3000 --env-file _workers/.env railway-worker`
- [ ] Worker started without errors
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] Database connection healthy
- [ ] Storage connection healthy
- [ ] Puppeteer connection healthy

### Functional Testing
- [ ] Created test export job (via SQL or app)
- [ ] Worker claimed and processed job
- [ ] Job status changed to `completed`
- [ ] Export file uploaded to storage
- [ ] `file_url` generated and accessible
- [ ] Downloaded export file and verified content
- [ ] Email notification sent (if enabled)

### Failure Testing
- [ ] Tested invalid menu ID (job fails gracefully)
- [ ] Tested timeout scenario (job fails with timeout error)
- [ ] Tested storage failure (job retries with backoff)
- [ ] Verified error messages are descriptive
- [ ] Verified failed jobs don't crash worker

### Performance Testing
- [ ] Created 5-10 jobs simultaneously
- [ ] All jobs processed successfully
- [ ] No memory leaks observed
- [ ] Job duration reasonable (< 30 seconds for typical menu)
- [ ] Worker handles concurrent jobs correctly

### Cleanup
- [ ] Stopped worker: `docker stop railway-worker`
- [ ] Removed container: `docker rm railway-worker`
- [ ] Cleaned up test jobs from database
- [ ] Reviewed logs for any warnings or errors

---

## Production Deployment Setup

### Railway Project Setup
- [ ] Created Railway account
- [ ] Created new Railway project
- [ ] Linked GitHub repository (optional)
- [ ] Configured Railway CLI: `railway login`

### Environment Variables (Railway)
- [ ] Set `DATABASE_URL` (production Supabase)
- [ ] Set `SUPABASE_URL` (production)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` (production)
- [ ] Set `STORAGE_BUCKET=export-files`
- [ ] Set `SENDGRID_API_KEY` (production key)
- [ ] Set `SENDGRID_FROM_EMAIL` (verified sender)
- [ ] Set `WORKER_ID=worker-1` (unique per instance)
- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_LEVEL=info`
- [ ] Set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

### Production Database
- [ ] Applied migration 036 to production database
- [ ] Applied migration 037 to production database
- [ ] Verified migrations with `supabase db diff`
- [ ] Created `export-files` bucket in production storage
- [ ] Configured RLS policies for production

### Railway Deployment
- [ ] Deployed worker to Railway: `railway up`
- [ ] Deployment successful (no build errors)
- [ ] Worker started successfully
- [ ] Health check endpoint accessible
- [ ] Reviewed Railway logs for startup errors

### Production Testing
- [ ] Created test export job in production
- [ ] Worker processed job successfully
- [ ] Export file accessible via signed URL
- [ ] Email notification received
- [ ] Verified job appears in user's export history

### Monitoring Setup
- [ ] Configured Railway alerts for worker downtime
- [ ] Set up log aggregation (optional: Datadog, Sentry)
- [ ] Configured metrics dashboard (optional)
- [ ] Set up alerts for high queue depth
- [ ] Set up alerts for high failure rate

### Scaling (Optional)
- [ ] Created additional worker instances (worker-2, worker-3)
- [ ] Set unique `WORKER_ID` for each instance
- [ ] Verified workers coordinate via database locks
- [ ] Tested load balancing across workers
- [ ] Monitored resource usage (CPU, memory)

### Documentation
- [ ] Updated team documentation with deployment process
- [ ] Documented environment variables
- [ ] Documented troubleshooting procedures
- [ ] Documented scaling procedures
- [ ] Documented rollback procedures

---

## Maintenance Checklist (Ongoing)

### Weekly
- [ ] Review Railway logs for errors
- [ ] Check queue depth metrics
- [ ] Review job failure rate
- [ ] Check worker memory usage
- [ ] Verify storage bucket size

### Monthly
- [ ] Review and clean up old export files (30+ days)
- [ ] Review and clean up old job records
- [ ] Check database performance (slow queries)
- [ ] Review SendGrid email delivery rates
- [ ] Update dependencies (security patches)

### Quarterly
- [ ] Rotate Supabase service role key
- [ ] Review and optimize database indexes
- [ ] Review worker resource allocation
- [ ] Load test with peak traffic simulation
- [ ] Review and update documentation

---

## Quick Reference

### Essential Commands

```bash
# Local Testing
docker build -t railway-worker .
docker run -p 3000:3000 --env-file _workers/.env railway-worker
curl http://localhost:3000/health
docker logs -f railway-worker

# Railway Deployment
railway login
railway init
railway up
railway logs
railway restart

# Database
supabase db reset
supabase migration up
supabase db diff

# Cleanup
docker stop railway-worker && docker rm railway-worker
docker system prune -a
```

### Essential SQL Queries

```sql
-- Check pending jobs
SELECT COUNT(*) FROM export_jobs WHERE status = 'pending';

-- Check recent jobs
SELECT id, status, export_type, created_at, completed_at 
FROM export_jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Check failed jobs
SELECT id, error_message, retry_count, created_at 
FROM export_jobs 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;

-- Reset stale jobs
UPDATE export_jobs 
SET status = 'pending', worker_id = NULL, started_at = NULL 
WHERE status = 'processing' 
AND (NOW() - started_at) > INTERVAL '5 minutes';

-- Clean up old test jobs
DELETE FROM export_jobs 
WHERE metadata->>'test' = 'true';
```

---

## Troubleshooting Quick Links

- **Local Setup Issues**: See [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) → Common Issues
- **Production Issues**: See [README.md](./README.md) → Troubleshooting
- **API Documentation**: See [API.md](./API.md)
- **Database Schema**: See `supabase/migrations/036_*.sql`

---

**Status**: ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Last Updated**: _________

**Notes**:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
