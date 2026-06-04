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

# Cap how much text we hand downstream — screenplays can be huge and the LLM only
# needs enough to understand the story, not every page.
MAX_CHARS = 40_000


def _from_pdf(data: bytes) -> str:
    import pdfplumber  # lazy

    out: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            out.append(page.extract_text() or "")
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
        return ""

    # Collapse runaway whitespace while keeping paragraph breaks.
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    _log.info("ingest: %s (%s) -> %d chars", filename, ext or "txt", len(text))
    return text[:MAX_CHARS]
