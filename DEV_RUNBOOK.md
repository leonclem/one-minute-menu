## Kiro Dev Runbook

This is a quick reference to start everything needed for local development and testing.

### Components
- Next.js web app (App Router)
- Supabase local stack (Postgres, Auth, Storage)
- Python OCR worker (Google Vision)

### One-time setup (per machine)
1) Prerequisites
   - Node 18+
   - Python 3.10+
   - Supabase CLI: `npm i -g supabase`
   - Google Cloud Vision service account JSON key

2) Web app deps (from repo root)
```
npm install
```

3) OCR worker deps (Windows PowerShell)
```
cd .\workers\ocr
python -m venv .venv
 .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pip install -e .
```

4) OCR worker env (create `workers/ocr/.env`)
```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
GOOGLE_APPLICATION_CREDENTIALS=C:\absolute\path\to\vision-key.json
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_RETRIES=3
WORKER_PROCESSING_TIMEOUT_MS=90000
# Enable instant wake-ups (optional; auto-falls back to sleep)
WORKER_USE_NOTIFY=1
```

Notes
- The worker reads `workers/ocr/.env`. It does not use the web app `.env.local`.
- If your Vision key path has spaces, wrap it in quotes in `.env`.

### Every development session
1) Start Supabase (repo root)
```
npx supabase start
```

2) Start the web app (repo root)
```
npm run dev
```

3) Start the OCR worker (Windows PowerShell)
```
cd .\workers\ocr
 .\.venv\Scripts\Activate.ps1
python -m ocr_worker.main
```

Optional noise reduction for Vision/gRPC warnings
```
$env:GRPC_VERBOSITY="ERROR"
python -m ocr_worker.main
```

### How to test OCR
- In the dashboard, upload a menu photo, then click "Extract Items".
- Or via API (replace `<menuId>`):
```
curl -X POST "http://localhost:3000/api/menus/<menuId>/ocr?force=1"
```

### Config reference
- Web app env: `.env.local` (Next.js)
- Worker env: `workers/ocr/.env`
- Rate limit: `OCR_RATE_LIMIT_PER_HOUR` (default 10) — set in web app env
- Worker knobs:
  - `WORKER_POLL_INTERVAL_MS` (default 5000)
  - `WORKER_MAX_RETRIES` (default 3)
  - `WORKER_PROCESSING_TIMEOUT_MS` (default 90000)
  - `WORKER_USE_NOTIFY` (0/1) — enables Postgres LISTEN/NOTIFY wake-ups

### Troubleshooting
- ModuleNotFoundError: `ocr_worker`
  - Ensure you installed editable package in the worker venv: `pip install -e .`
  - Confirm the correct venv: `python -c "import sys; print(sys.executable)"`

- `DATABASE_URL is required for OCR worker`
  - Ensure `workers/ocr/.env` exists and is ASCII (no BOM)
  - Verify: `python -c "from dotenv import dotenv_values; print(dotenv_values('.env').get('DATABASE_URL'))"`

- Vision warnings (ALTS creds ignored)
  - Harmless; set `GRPC_VERBOSITY=ERROR` to silence

- Instant wake-ups not working
  - Ensure `WORKER_USE_NOTIFY=1` in `workers/ocr/.env`
  - Trigger `003_ocr_notify.sql` is included in migrations; `npx supabase start` applies migrations
  - Worker will fall back to sleep if notify isn’t available

### Stopping services
- Stop the worker: Ctrl+C
- Stop Next.js: Ctrl+C
- Stop Supabase: `npx supabase stop`


