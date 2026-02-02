# Railway Workers - Frequently Asked Questions

Common questions and answers about Railway Workers setup and configuration.

---

## Environment Variables

### Q: Do I need both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL?

**A: Yes, but they serve different purposes:**

- **`NEXT_PUBLIC_SUPABASE_URL`** - Used by your Next.js frontend (browser-side code)
- **`SUPABASE_URL`** - Used by server-side code and the Railway worker

**Why?**
- Next.js requires the `NEXT_PUBLIC_` prefix for client-side environment variables
- The Railway worker is a separate Node.js process (not Next.js) and doesn't use this convention
- Both should have the same value

**Example:**
```bash
# In your .env.local:
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321  # For Next.js frontend
SUPABASE_URL=http://localhost:54321              # For Railway worker (same value!)
```

---

### Q: Should I use a separate _workers/.env file or add to root .env.local?

**A: Either works, but adding to root `.env.local` is simpler:**

**Option A: Root `.env.local` (Recommended)**
- ✅ All config in one place
- ✅ No duplication of DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
- ✅ Easier to maintain
- ✅ Run worker with: `docker run --env-file .env.local railway-worker`

**Option B: Separate `_workers/.env`**
- ✅ Keeps worker config isolated
- ✅ Easier to see what the worker needs
- ❌ Requires duplicating some variables
- ✅ Run worker with: `docker run --env-file _workers/.env railway-worker`

**Recommendation**: If you already have a root `.env.local` with Supabase and SendGrid configured, just add the Railway-specific variables to it.

---

### Q: What email address should I use for SENDGRID_FROM_EMAIL?

**A: Use a domain-specific email that makes sense for your app:**

**Good examples:**
- `exports@gridmenu.ai` ✅ (domain-specific, descriptive)
- `notifications@gridmenu.ai` ✅ (if used for multiple features)
- `noreply@gridmenu.ai` ✅ (if you don't want replies)

**Avoid:**
- `exports@yourdomain.com` ❌ (placeholder, not real)
- `test@example.com` ❌ (only for local testing)

**Important**: The email address must be verified in SendGrid before it can send emails in production.

**For local testing**: You can set `SENDGRID_API_KEY=disabled` and use any email address.

---

### Q: I already have DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SENDGRID_API_KEY configured. Do I need to duplicate them?

**A: No! If they're in your root `.env.local`, the worker will use them:**

Just add the Railway-specific variables:
```bash
# Already have these? Great, no need to duplicate!
# DATABASE_URL=...
# SUPABASE_SERVICE_ROLE_KEY=...
# SENDGRID_API_KEY=...

# Just add these new ones:
SUPABASE_URL=http://localhost:54321  # Add this (same as NEXT_PUBLIC_SUPABASE_URL)
STORAGE_BUCKET=export-files
SENDGRID_FROM_EMAIL=exports@gridmenu.ai
WORKER_ID=local-worker-1
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Setup and Configuration

### Q: What's the correct order for local setup?

**A: Follow this order:**

1. ✅ Run Supabase migrations (creates database tables)
2. ✅ Create storage bucket (creates storage)
3. ✅ Configure environment variables (tells worker how to connect)
4. ✅ Build Docker image (packages the worker)
5. ✅ Run worker (starts processing jobs)
6. ✅ Test (verify it works)

**Why this order?**
- Worker needs the database tables to exist (migrations first)
- Worker needs the storage bucket to exist (bucket before running)
- Docker needs the environment file to exist (config before build)

---

### Q: Do I need Railway for local testing?

**A: No! Railway is only for production deployment.**

For local testing:
- ✅ Use Docker on your computer
- ✅ Use local or dev Supabase
- ❌ No Railway account needed
- ❌ No Railway CLI needed

Railway is only needed when you're ready to deploy to production.

---

### Q: Can I test without Docker?

**A: Technically yes, but Docker is strongly recommended:**

**Without Docker:**
```bash
# Build TypeScript
npm run build:worker

# Run worker
node dist/lib/worker/index.js
```

**Problems:**
- ❌ Need to install Chromium manually
- ❌ Different environment than production
- ❌ Harder to troubleshoot
- ❌ Platform-specific issues (Windows vs Linux)

**With Docker:**
- ✅ Chromium included automatically
- ✅ Same environment as production
- ✅ Easier to troubleshoot
- ✅ Works the same on all platforms

**Recommendation**: Use Docker for local testing.

---

### Q: How do I know if it's working?

**A: Check these indicators:**

1. **Health check passes:**
   ```bash
   curl http://localhost:3000/health
   # Should return: {"status":"healthy",...}
   ```

2. **Worker logs show "ready":**
   ```json
   {"level":"info","message":"Worker starting"}
   {"level":"info","message":"Database connection OK"}
   {"level":"info","message":"Storage connection OK"}
   {"level":"info","message":"Worker ready"}
   ```

3. **Test job processes successfully:**
   - Create a test job in database
   - Worker claims it
   - Job status changes to "completed"
   - Export file appears in storage

---

## Troubleshooting

### Q: Worker won't start - "Cannot find module"

**A: Rebuild the Docker image:**

```bash
docker build -t railway-worker .
```

This happens when:
- You updated the code but didn't rebuild
- Docker cache is stale
- Dependencies changed

---

### Q: Worker starts but can't connect to database

**A: Check these:**

1. **DATABASE_URL is correct:**
   - For local Supabase: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
   - For remote Supabase: Get from Dashboard → Settings → Database

2. **Supabase is running:**
   ```bash
   # For local Supabase:
   supabase status
   ```

3. **Service role key is correct:**
   - Must be SERVICE ROLE key (not anon key)
   - Get from Dashboard → Settings → API

---

### Q: Worker connects but jobs don't process

**A: Check these:**

1. **Migrations ran successfully:**
   ```sql
   SELECT * FROM export_jobs LIMIT 1;
   -- Should not error
   ```

2. **Jobs exist and are available:**
   ```sql
   SELECT id, status, available_at 
   FROM export_jobs 
   WHERE status = 'pending' 
   AND available_at <= NOW();
   ```

3. **Worker is polling:**
   - Check logs for "Polling for jobs..."
   - Should appear every few seconds

---

### Q: Jobs fail with "Bucket not found"

**A: Create the storage bucket:**

1. Open Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `export-files`
4. Public: ❌ No (private)
5. File size limit: 10MB
6. Allowed types: PDF, PNG, JPEG

Verify:
```sql
SELECT * FROM storage.buckets WHERE id = 'export-files';
```

---

### Q: Jobs fail with "Puppeteer launch failed"

**A: Increase Docker memory:**

1. Open Docker Desktop → Settings → Resources
2. Increase Memory to 4GB (from default 2GB)
3. Click "Apply & Restart"
4. Rebuild and restart worker

---

### Q: Email notifications not sending

**A: Check SendGrid configuration:**

1. **API key is valid:**
   ```bash
   curl -H "Authorization: Bearer $SENDGRID_API_KEY" \
        https://api.sendgrid.com/v3/user/profile
   ```

2. **From email is verified:**
   - Check SendGrid Dashboard → Settings → Sender Authentication
   - Verify your domain or single sender

3. **For local testing:**
   - Set `SENDGRID_API_KEY=disabled` to skip emails
   - Worker will log email content instead

---

## Production Deployment

### Q: When should I deploy to production?

**A: After local testing is successful:**

✅ **Ready for production when:**
- Local worker starts without errors
- Health check passes
- Test jobs process successfully
- Export files download correctly
- No errors in logs

❌ **Not ready if:**
- Worker crashes on startup
- Jobs fail consistently
- Storage uploads fail
- Errors in logs

---

### Q: What's different in production?

**A: Different credentials and configuration:**

| Setting | Local | Production |
|---------|-------|------------|
| Database | Local/dev Supabase | Production Supabase |
| Service role key | Dev key | Production key (different!) |
| SendGrid key | Can be disabled | Must be real |
| Worker ID | `local-worker-1` | `worker-1`, `worker-2`, etc. |
| Log level | `debug` | `info` or `warn` |
| Environment | Docker on your PC | Railway cloud |

**Important**: Never use production credentials for local testing!

---

### Q: How do I deploy to Railway?

**A: Follow these steps:**

1. **Apply migrations to production database**
2. **Create production storage bucket**
3. **Set up Railway project:**
   ```bash
   railway login
   railway init
   ```
4. **Set environment variables:**
   ```bash
   railway variables set DATABASE_URL="..."
   railway variables set SUPABASE_URL="..."
   # ... etc
   ```
5. **Deploy:**
   ```bash
   railway up
   ```

See [README.md](./README.md) → Deployment to Railway for detailed instructions.

---

### Q: How many workers do I need?

**A: Depends on your traffic:**

- **1 worker**: ~20 jobs/minute (light load, testing)
- **3 workers**: ~60 jobs/minute (moderate load, recommended start)
- **5 workers**: ~100 jobs/minute (high load)
- **10+ workers**: ~200+ jobs/minute (peak load)

**Recommendation**: Start with 1-3 workers, scale up based on queue depth.

---

### Q: How much does Railway cost?

**A: Approximately $5-10 per worker per month:**

- **Compute**: ~$5/month per worker (2GB RAM, 1 CPU)
- **Network**: Usually included in free tier
- **Total**: ~$5-10/month for 1 worker, ~$15-30/month for 3 workers

**Note**: Railway has a free trial with $5 credit. Check current pricing at railway.app/pricing.

---

## Integration

### Q: How do I create export jobs from my app?

**A: Insert a row into the export_jobs table:**

```typescript
// In your Next.js API route or server action:
const { data, error } = await supabase
  .from('export_jobs')
  .insert({
    user_id: userId,
    menu_id: menuId,
    export_type: 'pdf', // or 'image'
    status: 'pending',
    priority: isSubscriber ? 100 : 10,
    metadata: {
      template: 'elegant-dark',
      // ... other metadata
    }
  })
  .select()
  .single();

// Return job ID to client
return { jobId: data.id };
```

See [API.md](./API.md) for complete integration guide.

---

### Q: How do I show export progress to users?

**A: Use Supabase Realtime:**

```typescript
// In your React component:
useEffect(() => {
  const channel = supabase
    .channel('export-jobs')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'export_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        const job = payload.new;
        if (job.status === 'completed') {
          // Show download link
          setDownloadUrl(job.file_url);
        } else if (job.status === 'failed') {
          // Show error
          setError(job.error_message);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [jobId]);
```

---

### Q: How long do export files stay available?

**A: 30 days by default:**

- Export files are automatically deleted after 30 days
- Configurable via `FILE_CLEANUP_AGE_DAYS` environment variable
- Users should download files promptly

**Recommendation**: Show a "Download expires in X days" message to users.

---

## Performance

### Q: How long does an export take?

**A: Typically 5-30 seconds:**

- **Simple menu** (few items, no images): 5-10 seconds
- **Average menu** (20-30 items, some images): 10-20 seconds
- **Complex menu** (50+ items, many images): 20-30 seconds
- **Very large menu** (100+ items): 30-60 seconds

**Factors:**
- Number of menu items
- Number of images
- Image sizes
- Template complexity
- Worker load

---

### Q: Can I make exports faster?

**A: Yes, several options:**

1. **Increase concurrent renders:**
   ```bash
   MAX_CONCURRENT_RENDERS=5  # Default: 3
   ```

2. **Add more workers:**
   - Scale horizontally for more throughput

3. **Optimize menu data:**
   - Compress images before upload
   - Reduce number of items per page
   - Use simpler templates

4. **Increase worker resources:**
   - More RAM (4GB instead of 2GB)
   - More CPU (2 cores instead of 1)

---

### Q: What happens if a worker crashes?

**A: Jobs are automatically recovered:**

1. **Stale job detection** runs every 5 minutes
2. Jobs stuck in "processing" for >5 minutes are reset to "pending"
3. Another worker picks them up
4. No jobs are lost

**Note**: The job will retry with exponential backoff if it fails multiple times.

---

## Security

### Q: Are export files secure?

**A: Yes, several security measures:**

1. **Private storage bucket** - Not publicly accessible
2. **Signed URLs** - Temporary download links (expire after 7 days)
3. **RLS policies** - Users can only access their own exports
4. **Service role access** - Only workers can upload files

---

### Q: Should I commit .env files to git?

**A: NO! Never commit environment files:**

```bash
# Add to .gitignore:
.env
.env.local
.env.production
_workers/.env
```

**Why?**
- Contains sensitive credentials
- Service role keys have full database access
- API keys can be abused

**Instead:**
- Use `.env.example` as a template
- Document required variables
- Share credentials securely (1Password, etc.)

---

## Still Have Questions?

Check these resources:

- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Overview
- **[QUICK_START.md](./QUICK_START.md)** - Quick setup
- **[LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md)** - Detailed guide
- **[SETUP_FLOW.md](./SETUP_FLOW.md)** - Visual diagrams
- **[README.md](./README.md)** - Full documentation
- **[API.md](./API.md)** - Integration guide

---

**Last Updated**: January 31, 2026
