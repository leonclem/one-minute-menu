# Docker Quick Reference

## Build & Run Commands

### Build Image
```bash
docker build -t railway-worker .
```

### Run Locally (with root .env.local)
```bash
docker run --rm -p 3001:3000 --add-host=host.docker.internal:host-gateway --env-file .env.local railway-worker
```

### Run Locally (with _workers/.env)
```bash
docker run --rm -p 3001:3000 --add-host=host.docker.internal:host-gateway --env-file _workers/.env railway-worker
```

### Run with Individual Environment Variables
```bash
docker run --rm -p 3001:3000 \
  -e SUPABASE_URL=http://localhost:54321 \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e STORAGE_BUCKET=export-files \
  -e WORKER_ID=local-worker-1 \
  railway-worker
```

### Run in Background
```bash
docker run -d --name railway-worker -p 3000:3000 --env-file .env.local railway-worker
```

### View Logs
```bash
docker logs -f railway-worker
```

### Stop Container
```bash
docker stop railway-worker
```

### Remove Container
```bash
docker rm railway-worker
```

## Testing Commands

### Check Health
```bash
curl http://localhost:3001/health
```

### Check Metrics
```bash
curl http://localhost:3001/metrics
```

### Test with Local Supabase
```bash
# Make sure Supabase is running
supabase status

# Run worker
docker run --rm -p 3001:3000 \
  --add-host=host.docker.internal:host-gateway \
  --env-file .env.local \
  railway-worker
```

## Debugging Commands

### Inspect Compiled Files
```bash
# List compiled files
docker run --rm railway-worker ls -la dist/lib/worker/

# Check a specific file
docker run --rm railway-worker cat dist/lib/worker/index.js

# Search for imports
docker run --rm railway-worker sh -c "grep -r 'require' dist/lib/worker/ | head -20"
```

### Check Environment Variables
```bash
docker run --rm --env-file .env.local railway-worker env | grep SUPABASE
```

### Interactive Shell
```bash
docker run --rm -it --env-file .env.local railway-worker sh
```

### Test Node.js
```bash
docker run --rm railway-worker node --version
```

### Test Chromium
```bash
docker run --rm railway-worker chromium --version
```

## Build Troubleshooting

### Clear Build Cache
```bash
docker build --no-cache -t railway-worker .
```

### Build with Progress
```bash
docker build --progress=plain -t railway-worker .
```

### Build Specific Stage
```bash
# If using multi-stage build
docker build --target builder -t railway-worker-builder .
```

### Check Image Size
```bash
docker images railway-worker
```

### Inspect Image Layers
```bash
docker history railway-worker
```

## Production Deployment

### Tag for Registry
```bash
# Docker Hub
docker tag railway-worker yourusername/railway-worker:latest

# GitHub Container Registry
docker tag railway-worker ghcr.io/yourusername/railway-worker:latest
```

### Push to Registry
```bash
# Docker Hub
docker push yourusername/railway-worker:latest

# GitHub Container Registry
docker push ghcr.io/yourusername/railway-worker:latest
```

### Pull from Registry
```bash
# Docker Hub
docker pull yourusername/railway-worker:latest

# GitHub Container Registry
docker pull ghcr.io/yourusername/railway-worker:latest
```

## Common Issues

### Issue: "Cannot find module"
**Solution**: Check if module is included in `tsconfig.worker.json`

### Issue: "Invalid Supabase URL"
**Solution**: Verify `SUPABASE_URL` is set and is a valid HTTPS URL

### Issue: "Bucket not found"
**Solution**: Create `export-files` bucket in Supabase Storage

### Issue: "Permission denied"
**Solution**: Check `SUPABASE_SERVICE_ROLE_KEY` has correct permissions

### Issue: "Chromium not found"
**Solution**: Verify `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`

### Issue: "fetch failed" or "ECONNREFUSED" when connecting to local Supabase
**Solution**: Ensure you are using `--add-host=host.docker.internal:host-gateway` in your `docker run` command and that `SUPABASE_URL` is set to `http://host.docker.internal:54321` in `.env.local`.

### Issue: "Port already in use"
**Solution**: Change port mapping: `-p 3001:3000` (especially if your main web app is on 3000) or stop other container.

## Environment Variables Reference

### Required
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STORAGE_BUCKET=export-files
```

### Optional (with defaults)
```bash
WORKER_ID=worker-1                    # Default: worker-{pid}
MAX_CONCURRENT_RENDERS=3              # Default: 3
JOB_TIMEOUT_SECONDS=60                # Default: 60
POLLING_INTERVAL_BUSY_MS=2000         # Default: 2000
POLLING_INTERVAL_IDLE_MS=5000         # Default: 5000
HEALTH_CHECK_PORT=3000                # Default: 3000
METRICS_PORT=9090                     # Default: 9090
ENABLE_CANARY_EXPORT=true             # Default: true
LOG_LEVEL=info                        # Default: info
NODE_ENV=production                   # Default: development
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

## File Structure

```
Project Root/
├── Dockerfile                        # Container definition
├── fix-paths.js                      # Path alias resolver
├── .dockerignore                     # Files to exclude
├── package.json                      # Dependencies
├── tsconfig.json                     # Base TypeScript config
├── .env.local                        # Local environment (root)
├── _workers/
│   └── .env                          # Worker environment (optional)
└── src/lib/worker/
    ├── index.ts                      # Worker entry point
    ├── database-client.ts            # Database operations
    ├── storage-client.ts             # Storage operations
    ├── job-processor.ts              # Job processing logic
    ├── job-poller.ts                 # Job polling logic
    ├── puppeteer-renderer.ts         # PDF/image rendering
    └── ...                           # Other worker modules
```

## Quick Start Checklist

- [ ] Supabase migrations applied
- [ ] Storage bucket created (`export-files`)
- [ ] Environment file configured (`.env.local` or `_workers/.env`)
- [ ] Docker Desktop running
- [ ] Build image: `docker build -t railway-worker .`
- [ ] Run worker: `docker run -p 3001:3000 --add-host=host.docker.internal:host-gateway --env-file .env.local railway-worker`
- [ ] Test health: `curl http://localhost:3001/health`
- [ ] Create test job in Supabase
- [ ] Verify job processes

## Related Documentation

- [DOCKER_BUILD_SUCCESS.md](./DOCKER_BUILD_SUCCESS.md) - Build verification and deployment guide
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Overview and setup
- [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) - Detailed local setup
- [FAQ.md](./FAQ.md) - Frequently asked questions

---

**Status**: ✅ Docker build working  
**Last Updated**: 2026-01-31
