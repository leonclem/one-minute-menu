## OCR Worker (Python)

Python worker that processes `ocr_jobs` from PostgreSQL using LISTEN/NOTIFY and Google Vision.

### Prerequisites
- Python 3.10+
- Google Cloud Vision credentials (`GOOGLE_APPLICATION_CREDENTIALS`)
- PostgreSQL connection with access to `ocr_jobs` (ideally service role)

### Setup
```bash
python -m venv .venv
. .venv/bin/activate  # or .venv\\Scripts\\activate on Windows
pip install -r requirements.txt
cp .env.example .env  # then edit values
```

### Run
```bash
python -m kiro_ocr_worker.main
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

