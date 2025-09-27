from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional, Tuple
import json
import time
import psycopg


@dataclass
class OCRJobRow:
    id: str
    user_id: str
    image_url: str
    image_hash: str
    status: str
    retry_count: int


def connect(database_url: str) -> psycopg.Connection:
    return psycopg.connect(database_url, autocommit=False)


@contextmanager
def tx(conn: psycopg.Connection):
    with conn.transaction():
        yield


def try_claim_queued_job(conn: psycopg.Connection) -> Optional[OCRJobRow]:
    # Claim one queued job atomically
    row = conn.execute(
        """
        UPDATE ocr_jobs
        SET status = 'processing'
        WHERE id = (
          SELECT id FROM ocr_jobs
          WHERE status = 'queued'
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id, user_id, image_url, image_hash, status, COALESCE(retry_count, 0);
        """
    ).fetchone()
    if not row:
        return None
    return OCRJobRow(
        id=row[0],
        user_id=row[1],
        image_url=row[2],
        image_hash=row[3],
        status=row[4],
        retry_count=row[5] or 0,
    )


def mark_completed(conn: psycopg.Connection, job_id: str, ocr_text: str, processing_ms: int, confidence: float):
    result = {
        "ocrText": ocr_text,
        "extractedItems": [],
        "confidence": float(confidence),
        "flaggedFields": [],
        "processingTime": processing_ms,
        "aiParsingUsed": False,
    }
    conn.execute(
        """
        UPDATE ocr_jobs
        SET status='completed', result=%s, processing_time=%s, completed_at=NOW()
        WHERE id=%s
        """,
        (json.dumps(result), processing_ms, job_id),
    )


def mark_failed(conn: psycopg.Connection, job_id: str, error_message: str):
    conn.execute(
        """
        UPDATE ocr_jobs SET status='failed', error_message=%s WHERE id=%s
        """,
        (error_message[:2000], job_id),
    )


def increment_retry(conn: psycopg.Connection, job_id: str) -> int:
    row = conn.execute(
        """
        UPDATE ocr_jobs
        SET retry_count = COALESCE(retry_count, 0) + 1
        WHERE id = %s
        RETURNING retry_count
        """,
        (job_id,),
    ).fetchone()
    return int(row[0]) if row and row[0] is not None else 0


def requeue_job(conn: psycopg.Connection, job_id: str) -> None:
    conn.execute(
        """
        UPDATE ocr_jobs SET status='queued' WHERE id=%s
        """,
        (job_id,),
    )


def listen_for_jobs(conn: psycopg.Connection, poll_interval_ms: int, use_notify: bool) -> None:
    if use_notify:
        # Try LISTEN/NOTIFY using PQ socket + WAIT on notifications.
        # psycopg3 provides a simple notifications API via connection.notifies.
        try:
            conn.execute("LISTEN ocr_jobs;")
            # Block up to poll_interval_ms waiting for a notify
            timeout = max(poll_interval_ms, 250) / 1000.0
            notify = conn.notifies.get(timeout=timeout)
            # We don't need payload here; the presence of a notify is enough
            return
        except Exception:
            # Fallback to sleep if LISTEN/NOTIFY not available in this env
            pass
    # Sleep-based polling fallback
    time.sleep(max(poll_interval_ms, 250) / 1000.0)




