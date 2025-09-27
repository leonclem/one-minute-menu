import pytest
from ocr_worker.ocr import run_document_text_detection


def test_dummy_import():
    # Smoke test to ensure module imports; Vision client will be mocked in further tests
    assert callable(run_document_text_detection)


