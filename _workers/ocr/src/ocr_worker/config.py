import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv


# Load .env from current working directory (if present)
load_dotenv()
# Also load .env explicitly from the worker root (workers/ocr/.env),
# so running from any directory still picks it up.
_WORKER_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
if _WORKER_ROOT_ENV.exists():
    # Force override so .env values win in local dev
    load_dotenv(dotenv_path=_WORKER_ROOT_ENV, override=True)


def _get_int(env_key: str, default: int) -> int:
    try:
        return int(os.getenv(env_key, str(default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class WorkerConfig:
    database_url: str
    poll_interval_ms: int
    max_retries: int
    processing_timeout_ms: int
    use_notify: bool


def load_config() -> WorkerConfig:
    database_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or os.getenv("POSTGRES_URL")
        or ""
    )
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for OCR worker")

    return WorkerConfig(
        database_url=database_url,
        poll_interval_ms=_get_int("WORKER_POLL_INTERVAL_MS", 5000),
        max_retries=_get_int("WORKER_MAX_RETRIES", 3),
        processing_timeout_ms=_get_int("WORKER_PROCESSING_TIMEOUT_MS", 60_000),
        use_notify=os.getenv("WORKER_USE_NOTIFY", "0") in ("1", "true", "TRUE", "yes", "YES"),
    )




