import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


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


def load_config() -> WorkerConfig:
    database_url = os.getenv("DATABASE_URL", "")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for OCR worker")

    return WorkerConfig(
        database_url=database_url,
        poll_interval_ms=_get_int("WORKER_POLL_INTERVAL_MS", 5000),
        max_retries=_get_int("WORKER_MAX_RETRIES", 3),
        processing_timeout_ms=_get_int("WORKER_PROCESSING_TIMEOUT_MS", 60_000),
    )


