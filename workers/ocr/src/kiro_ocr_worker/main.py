import sys
import time
from .config import load_config
from . import db as dbops
from . import ocr as ocrops


def process_once(conn, cfg) -> bool:
    job = dbops.try_claim_queued_job(conn)
    if not job:
        return False
    start = int(time.time() * 1000)
    try:
        img = ocrops.fetch_image_bytes(job.image_url, cfg.processing_timeout_ms)
        text, conf = ocrops.run_document_text_detection(img)
        elapsed = int(time.time() * 1000) - start
        dbops.mark_completed(conn, job.id, text, elapsed, conf)
        conn.commit()
    except Exception as e:
        # Rollback the processing attempt
        conn.rollback()
        try:
            # Increment retry count and decide whether to requeue or fail
            new_count = dbops.increment_retry(conn, job.id)
            if new_count >= cfg.max_retries:
                dbops.mark_failed(conn, job.id, str(e))
            else:
                dbops.requeue_job(conn, job.id)
            conn.commit()
        except Exception:
            conn.rollback()
    return True


def run() -> int:
    cfg = load_config()
    conn = dbops.connect(cfg.database_url)
    try:
        while True:
            processed = True
            # Drain the queue while there are jobs
            while processed:
                processed = process_once(conn, cfg)
            # Wait for notifications or timeout
            dbops.listen_for_jobs(conn, cfg.poll_interval_ms)
    except KeyboardInterrupt:
        return 0
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(run())


