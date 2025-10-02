from typing import Tuple
import requests
from google.cloud import vision


def fetch_image_bytes(url: str, timeout_ms: int) -> bytes:
    timeout = max(timeout_ms, 1000) / 1000.0
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def run_document_text_detection(image_bytes: bytes) -> Tuple[str, float]:
    client = vision.ImageAnnotatorClient()
    image = vision.Image(content=image_bytes)
    response = client.document_text_detection(image=image)
    if response.error and response.error.message:
        raise RuntimeError(response.error.message)

    ocr_text = (response.full_text_annotation.text or "").strip() if response.full_text_annotation else ""
    if not ocr_text and response.text_annotations:
        ocr_text = (response.text_annotations[0].description or "").strip()

    # Basic heuristic confidence if available; default to 0.0
    confidence = 0.0
    if response.full_text_annotation and response.full_text_annotation.pages:
        confidences = []
        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                if block.confidence is not None:
                    confidences.append(block.confidence)
        if confidences:
            confidence = sum(confidences) / len(confidences)

    return ocr_text, float(confidence)




