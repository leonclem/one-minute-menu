import os
from ocr_worker.config import load_config


def test_load_config_defaults(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h:5432/db")
    cfg = load_config()
    assert cfg.database_url.startswith("postgresql://")
    assert cfg.poll_interval_ms == 5000
    assert cfg.max_retries == 3
    assert cfg.processing_timeout_ms == 60000

