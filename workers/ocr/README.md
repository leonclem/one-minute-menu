## OCR Worker (Python)

Python worker that processes `ocr_jobs` from PostgreSQL using LISTEN/NOTIFY and Google Vision.

### Prerequisites
- Python 3.10+
- Google Cloud Vision credentials (`GOOGLE_APPLICATION_CREDENTIALS`)
- PostgreSQL connection with access to `ocr_jobs` (ideally service role)

### Setup
```bash
python -m venv .venv
# Windows PowerShell
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
pip install -e .
```

### Create .env (Windows PowerShell)
The worker reads its own `.env` in `workers/ocr` (it does not use Next.js `.env.local`).

```powershell
@"
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
GOOGLE_APPLICATION_CREDENTIALS=C:\absolute\path\to\your\vision-key.json
WORKER_POLL_INTERVAL_MS=5000
WORKER_MAX_RETRIES=3
WORKER_PROCESSING_TIMEOUT_MS=90000
"@ | Set-Content -Path .\.env -Encoding UTF8
```

### Run
```bash
python -m ocr_worker.main
```

### Configuration
- `DATABASE_URL`: Postgres connection string
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Vision JSON key
- `WORKER_POLL_INTERVAL_MS`: Fallback poll interval when no notifications
- `WORKER_MAX_RETRIES`: Max attempts before marking job failed
- `WORKER_PROCESSING_TIMEOUT_MS`: HTTP fetch timeout per image

### How it works
- LISTENs on `ocr_jobs` channel (see migration `003_ocr_notify.sql`)
- Atomically claims one `queued` job at a time (UPDATE ... RETURNING)
- Downloads image bytes from `image_url`, runs Vision `document_text_detection`
- Updates job `status`, `result`, `processing_time`, and `retry_count`

