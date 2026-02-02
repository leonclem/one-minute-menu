# Railway Workers - Export Job Processing

Dedicated worker service for processing PDF and image export jobs asynchronously, offloading heavy rendering tasks from Vercel serverless functions to Railway-hosted workers.

## 📚 Documentation

**👉 New to Railway Workers? Start here: [INDEX.md](./INDEX.md) - Complete documentation guide**

**👉 Quick answer to "What order?": [ANSWER_TO_YOUR_QUESTION.md](./ANSWER_TO_YOUR_QUESTION.md)**

### Setup Guides

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Overview and what you need to know 🎯
- **[QUICK_START.md](./QUICK_START.md)** - Get running in 10 minutes ⚡
- **[SETUP_FLOW.md](./SETUP_FLOW.md)** - Visual setup flow diagram 📊
- **[LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md)** - Detailed step-by-step local setup 📖
- **[SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md)** - Track your setup progress ☑️

### Reference Documentation

- **[API.md](./API.md)** - API documentation and integration guide 🔌
- **[FAQ.md](./FAQ.md)** - Frequently asked questions ❓
- **[README.md](./README.md)** (this file) - Architecture, deployment, and troubleshooting 📚
- **[INDEX.md](./INDEX.md)** - Complete documentation index 📑

### Which Guide Should I Use?

| Your Situation | Recommended Guide |
|----------------|-------------------|
| "I'm new, where do I start?" | [INDEX.md](./INDEX.md) or [GETTING_STARTED.md](./GETTING_STARTED.md) |
| "What order do I do things?" | [ANSWER_TO_YOUR_QUESTION.md](./ANSWER_TO_YOUR_QUESTION.md) |
| "I just want to test this quickly" | [QUICK_START.md](./QUICK_START.md) |
| "I need to understand the setup order" | [SETUP_FLOW.md](./SETUP_FLOW.md) |
| "I want detailed instructions" | [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) |
| "I want to track my progress" | [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) |
| "I'm ready for production" | [README.md](./README.md) → Deployment |
| "I need to integrate with my app" | [API.md](./API.md) |

## Architecture Overview

The Railway Workers system implements an asynchronous job queue architecture:

1. **Vercel API** creates export jobs and returns immediately (< 100ms)
2. **Railway Workers** poll the database for pending jobs
3. **Puppeteer** renders menu HTML to PDF or image format
4. **Supabase Storage** stores the generated files
5. **Supabase Realtime** broadcasts status updates to clients
6. **SendGrid** sends completion/failure emails to users

### Key Features

- **Priority Queue**: Subscribers get faster processing (priority 100 vs 10)
- **Atomic Job Claiming**: Multiple workers coordinate via database locks
- **Automatic Retries**: Transient failures retry with exponential backoff
- **Stale Job Recovery**: Crashed workers don't lose jobs
- **Graceful Shutdown**: Workers complete current job before exiting
- **Resource Management**: Limits concurrent Puppeteer instances to prevent OOM

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Storage
STORAGE_BUCKET=export-files

# Email
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=exports@example.com

# Worker Configuration
WORKER_ID=worker-1
MAX_CONCURRENT_RENDERS=3
JOB_TIMEOUT_SECONDS=60
POLLING_INTERVAL_BUSY_MS=2000
POLLING_INTERVAL_IDLE_MS=5000
GRACEFUL_SHUTDOWN_TIMEOUT_MS=30000

# Puppeteer
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Application
NODE_ENV=production
LOG_LEVEL=info
```

### Optional Variables

```bash
# Rate Limiting
FREE_USER_HOURLY_LIMIT=10
SUBSCRIBER_HOURLY_LIMIT=50
FREE_USER_PENDING_LIMIT=5
SUBSCRIBER_PENDING_LIMIT=20

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
DATADOG_API_KEY=xxx

# Feature Flags
ENABLE_CANARY_EXPORT=true
ENABLE_CIRCUIT_BREAKER=true
```

## Deployment to Railway

### Initial Setup

1. **Create Railway Project**
   ```bash
   railway login
   railway init
   ```

2. **Set Environment Variables**
   ```bash
   railway variables set DATABASE_URL="postgresql://..."
   railway variables set SUPABASE_URL="https://..."
   railway variables set SUPABASE_SERVICE_ROLE_KEY="..."
   railway variables set STORAGE_BUCKET="export-files"
   railway variables set SENDGRID_API_KEY="SG...."
   railway variables set SENDGRID_FROM_EMAIL="exports@example.com"
   railway variables set WORKER_ID="worker-1"
   railway variables set PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"
   railway variables set NODE_ENV="production"
   railway variables set LOG_LEVEL="info"
   ```

3. **Deploy Worker**
   ```bash
   railway up
   ```

### Scaling Workers

To add more workers for increased throughput:

```bash
# Create additional service instances
railway service create worker-2
railway service create worker-3

# Set unique WORKER_ID for each
railway variables set WORKER_ID="worker-2" --service worker-2
railway variables set WORKER_ID="worker-3" --service worker-3
```

### Health Checks

Railway automatically monitors the `/health` endpoint:

```bash
curl https://your-worker.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T12:00:00.000Z",
  "checks": {
    "database": { "healthy": true, "message": "Database connection OK" },
    "storage": { "healthy": true, "message": "Storage connection OK" },
    "puppeteer": { "healthy": true, "message": "Puppeteer OK" },
    "memory": { "healthy": true, "message": "Memory usage: 45.2%" }
  }
}
```

## Monitoring and Alerting

### Logs

View worker logs in real-time:

```bash
railway logs
```

Logs are structured JSON with the following fields:
- `timestamp`: ISO 8601 timestamp
- `level`: info, warn, error
- `message`: Human-readable message
- `job_id`: Export job UUID (when applicable)
- `worker_id`: Worker instance identifier
- `duration_ms`: Job processing duration
- `error_category`: transient, permanent, resource, validation

### Metrics

The worker exposes Prometheus metrics at `/metrics`:

```bash
curl https://your-worker.railway.app/metrics
```

Key metrics:
- `export_jobs_created_total`: Total jobs created
- `export_jobs_completed_total`: Total jobs completed
- `export_jobs_failed_total`: Total jobs failed
- `export_job_duration_seconds`: Job processing duration histogram
- `export_queue_depth`: Current pending jobs count
- `export_active_renders`: Active Puppeteer instances

### Alerts

Configure alerts in your monitoring system:

1. **High Queue Depth**: Queue > 100 jobs for 5 minutes
2. **High Failure Rate**: > 10% jobs failing
3. **Worker Down**: Health check fails for 1 minute
4. **Slow Processing**: P95 duration > 45 seconds

## Troubleshooting

### Worker Not Processing Jobs

**Symptoms**: Jobs stuck in `pending` status

**Diagnosis**:
1. Check worker logs: `railway logs`
2. Verify worker is running: `railway status`
3. Check health endpoint: `curl /health`

**Solutions**:
- Restart worker: `railway restart`
- Check database connectivity
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check for memory issues (OOM kills)

### Jobs Failing with Timeout

**Symptoms**: Jobs fail with "TimeoutError" after 60 seconds

**Diagnosis**:
1. Check menu size: Large menus with many images take longer
2. Review job metadata for `file_size_bytes` and image count
3. Check worker memory usage

**Solutions**:
- Increase `JOB_TIMEOUT_SECONDS` (max 120)
- Increase worker memory in Railway settings (2GB → 4GB)
- Reduce menu complexity (fewer images, smaller HTML)

### Puppeteer Launch Failures

**Symptoms**: Jobs fail with "Failed to launch browser"

**Diagnosis**:
1. Check canary export on startup
2. Verify Chromium is installed in Docker image
3. Check `PUPPETEER_EXECUTABLE_PATH` is correct

**Solutions**:
- Rebuild Docker image with Chromium dependencies
- Verify Dockerfile includes all required libraries
- Check Railway build logs for errors

### High Memory Usage

**Symptoms**: Worker crashes with OOM errors

**Diagnosis**:
1. Check active Puppeteer instances
2. Review `MAX_CONCURRENT_RENDERS` setting
3. Monitor memory metrics

**Solutions**:
- Reduce `MAX_CONCURRENT_RENDERS` (3 → 2)
- Increase worker memory allocation
- Ensure browsers are properly closed after rendering
- Check for memory leaks in rendering code

### Stale Jobs Not Recovering

**Symptoms**: Jobs stuck in `processing` status > 5 minutes

**Diagnosis**:
1. Check stale job detection cron is running
2. Verify database indexes exist
3. Review worker logs for stale job resets

**Solutions**:
- Manually reset stale jobs:
  ```sql
  UPDATE export_jobs
  SET status = 'pending', worker_id = NULL, started_at = NULL
  WHERE status = 'processing'
  AND (NOW() - started_at) > INTERVAL '5 minutes';
  ```
- Restart stale job detection service
- Check database performance

### Storage Upload Failures

**Symptoms**: Jobs fail with "Storage upload failed"

**Diagnosis**:
1. Check Supabase Storage status
2. Verify `STORAGE_BUCKET` exists
3. Check service role key permissions

**Solutions**:
- Verify storage bucket exists in Supabase dashboard
- Check service role has storage permissions
- Review circuit breaker status (may be open after failures)
- Wait for circuit breaker cooldown (1 minute)

### Email Notifications Not Sending

**Symptoms**: Jobs complete but users don't receive emails

**Diagnosis**:
1. Check SendGrid API key is valid
2. Verify `SENDGRID_FROM_EMAIL` is verified in SendGrid
3. Review SendGrid activity logs

**Solutions**:
- Verify SendGrid API key: `curl -H "Authorization: Bearer $SENDGRID_API_KEY" https://api.sendgrid.com/v3/user/profile`
- Check from email is verified in SendGrid dashboard
- Review SendGrid bounce/spam reports
- Check email logs in worker output

### Realtime Notifications Not Working

**Symptoms**: Web clients don't receive status updates

**Diagnosis**:
1. Verify Supabase Realtime is enabled for `export_jobs` table
2. Check RLS policies allow user to see their jobs
3. Review client subscription code

**Solutions**:
- Enable Realtime in Supabase dashboard:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE export_jobs;
  ```
- Verify RLS policies:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'export_jobs';
  ```
- Check client is subscribed to correct channel

## Performance Tuning

### Polling Intervals

Adjust polling frequency based on load:

```bash
# Faster polling for high-traffic periods
railway variables set POLLING_INTERVAL_BUSY_MS=1000
railway variables set POLLING_INTERVAL_IDLE_MS=3000

# Slower polling for low-traffic periods
railway variables set POLLING_INTERVAL_BUSY_MS=5000
railway variables set POLLING_INTERVAL_IDLE_MS=10000
```

### Concurrent Renders

Balance throughput vs memory usage:

```bash
# Higher throughput (requires more memory)
railway variables set MAX_CONCURRENT_RENDERS=5

# Lower memory usage (slower throughput)
railway variables set MAX_CONCURRENT_RENDERS=2
```

### Worker Scaling

Scale horizontally for increased capacity:

- **1 worker**: ~20 jobs/minute (light load)
- **3 workers**: ~60 jobs/minute (moderate load)
- **5 workers**: ~100 jobs/minute (high load)
- **10 workers**: ~200 jobs/minute (peak load)

## Database Maintenance

### Cleanup Old Jobs

Jobs older than 30 days are automatically deleted by the cleanup cron. To manually clean up:

```sql
-- Delete completed jobs older than 30 days
DELETE FROM export_jobs
WHERE status = 'completed'
AND created_at < NOW() - INTERVAL '30 days';

-- Delete failed jobs older than 7 days
DELETE FROM export_jobs
WHERE status = 'failed'
AND created_at < NOW() - INTERVAL '7 days';
```

### Index Maintenance

Rebuild indexes periodically for optimal performance:

```sql
-- Reindex export_jobs table
REINDEX TABLE export_jobs;

-- Analyze table for query planner
ANALYZE export_jobs;
```

### Query Performance

Monitor slow queries:

```sql
-- Find slow job queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%export_jobs%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Security Best Practices

### Service Role Key Rotation

Rotate Supabase service role key quarterly:

1. Generate new key in Supabase dashboard
2. Update Railway environment variable
3. Deploy workers with new key
4. Revoke old key after 24 hours

### Network Security

Workers should only connect to:
- Supabase (database, storage, realtime)
- SendGrid (email)
- Trusted image CDNs (for menu images)

Puppeteer network requests are restricted to allowlist.

### Data Retention

- Export files: 30 days
- Job records: 30 days (completed), 7 days (failed)
- Logs: 7 days
- Metrics: 90 days

## Development

### Local Development Setup

**📖 For detailed step-by-step local setup instructions, see [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md)**

The local setup guide covers:
- ✅ Database migrations (correct order)
- ✅ Storage bucket creation
- ✅ Environment configuration
- ✅ Docker build and testing
- ✅ Troubleshooting common issues

### Quick Start (After Setup)

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   ```bash
   cd _workers
   copy .env.example .env
   # Edit .env with your local values (see LOCAL_SETUP_GUIDE.md)
   ```

3. **Build and Run Worker**
   ```bash
   # Build Docker image (from project root)
   docker build -t railway-worker .

   # Run container
   docker run -p 3000:3000 --env-file _workers/.env railway-worker

   # Check health
   curl http://localhost:3000/health
   ```

4. **Run Tests** (if implemented)
   ```bash
   npm test
   npm run test:integration
   npm run test:property
   ```

### Development Workflow

```bash
# 1. Make code changes in src/lib/worker/

# 2. Rebuild Docker image
docker build -t railway-worker .

# 3. Restart worker
docker stop railway-worker && docker rm railway-worker
docker run -d -p 3000:3000 --env-file _workers/.env --name railway-worker railway-worker

# 4. Monitor logs
docker logs -f railway-worker
```

## Architecture Decisions

### Why Database as Queue?

- **Simplicity**: No additional infrastructure (Redis, RabbitMQ)
- **Reliability**: ACID guarantees, no message loss
- **Atomicity**: `SELECT FOR UPDATE SKIP LOCKED` prevents conflicts
- **Observability**: Query job status directly in database

### Why Adaptive Polling?

- **Efficiency**: Reduce database load when idle
- **Responsiveness**: Fast processing when jobs pending
- **Cost**: Lower Railway costs during off-peak hours

### Why Exponential Backoff?

- **Transient Failures**: Give external services time to recover
- **Resource Exhaustion**: Prevent thundering herd
- **Cost**: Reduce wasted compute on failing jobs

### Why Idempotent Storage?

- **Reliability**: Tolerate duplicate processing from stale job recovery
- **Simplicity**: No need for distributed locks or deduplication
- **Correctness**: Exactly one artifact per completed job

## Support

For issues or questions:
- Check troubleshooting guide above
- Review worker logs: `railway logs`
- Check health endpoint: `/health`
- Review metrics: `/metrics`
- Contact engineering team

## License

Proprietary - Internal use only
