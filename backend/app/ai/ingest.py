"""Script ingestion — turn an uploaded screenplay/treatment into plain text.

Supports the formats the Story Identity uploader accepts (PDF, DOCX, FDX) plus
plain text. Parsing libs are imported lazily so a missing optional dependency only
breaks that one format, never the whole app. Returns "" when nothing readable is found.
"""
from __future__ import annotations

import io
import re
import xml.etree.ElementTree as ET

from app.core.logging import get_logger

_log = get_logger("ingest")

# Cap how much text we hand downstream. A full feature screenplay is ~150k-250k chars;
# we want the model to read the WHOLE story (characters who enter late, the real climax),
# so the cap only guards against pathological inputs, not normal scripts.
MAX_CHARS = 300_000


def _from_pdf(data: bytes) -> str:
    import pdfplumber  # lazy
    from app.core.config import settings

    out: list[str] = []
    # Cap pages so a huge/scanned PDF can't blow memory on a small host (a brief needs only the
    # opening pages). `.close()` each page to release its parsed objects as we go.
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages[: settings.ocr_max_pages]:
            out.append(page.extract_text() or "")
            page.close()
    return "\n".join(out)


def _from_docx(data: bytes) -> str:
    import docx  # lazy (python-docx)

    document = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs)


def _from_fdx(data: bytes) -> str:
    """Final Draft .fdx is XML — concatenate every <Text> node in document order."""
    root = ET.fromstring(data)
    parts = [node.text or "" for node in root.iter("Text")]
    return "\n".join(p for p in parts if p.strip())


def _from_txt(data: bytes) -> str:
    return data.decode("utf-8", errors="replace")


def _ext(filename: str) -> str:
    match = re.search(r"\.([A-Za-z0-9]+)$", filename or "")
    return match.group(1).lower() if match else ""


# Below this, a "parsed" PDF is treated as scanned (a real script page has far more text).
_OCR_TRIGGER_CHARS = 200


def extract_text(filename: str, data: bytes) -> str:
    """Extract readable text from an uploaded script file. Never raises on bad content."""
    ext = _ext(filename)
    try:
        if ext == "pdf":
            text = _from_pdf(data)
        elif ext == "docx":
            text = _from_docx(data)
        elif ext in ("fdx", "xml"):
            text = _from_fdx(data)
        else:
            text = _from_txt(data)
    except Exception as exc:  # noqa: BLE001 — any parse failure → empty, caller handles it
        _log.warning("ingest: failed to parse %s (%s): %s", filename, ext or "?", exc)
        text = ""

    # Scanned PDF (no embedded text layer) → OCR via the vision model.
    if ext == "pdf" and len(text.strip()) < _OCR_TRIGGER_CHARS:
        from app.ai.ocr import ocr_pdf  # lazy

        _log.info("ingest: %s has no text layer (%d chars) — trying OCR", filename, len(text.strip()))
        ocr_text = ocr_pdf(data, filename)
        if len(ocr_text.strip()) > len(text.strip()):
            text = ocr_text

    # Collapse runaway whitespace while keeping paragraph breaks.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    _log.info("ingest: %s (%s) -> %d chars", filename, ext or "txt", len(text))
    return text[:MAX_CHARS]
