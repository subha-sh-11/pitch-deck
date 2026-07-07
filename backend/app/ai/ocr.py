"""OCR for scanned PDFs — page images → text via the configured vision LLM.

Used as a fallback when pdfplumber finds no embedded text (photographed or scanned
scripts). Pages are rendered with pypdfium2 (pure pip wheel, no system dependency),
downscaled, and transcribed in small batches through the same provider-agnostic
`complete_json` the agents use — so this works with whichever LLM key is configured
and degrades to "" offline (the caller then shows the normal unreadable-file error).
"""
from __future__ import annotations

import base64
import io

from app.ai.llm import complete_json, resolve_provider
from app.core.config import settings
from app.core.logging import get_logger

_log = get_logger("ocr")

# Cost/latency/memory guard: a feature script is ~90-130 pages, but a brief only needs the first
# pages. Configurable (OCR_MAX_PAGES / OCR_RENDER_SCALE) — turn DOWN on a small/free-tier host.
MAX_PAGES = settings.ocr_max_pages
PAGES_PER_BATCH = 4
RENDER_SCALE = settings.ocr_render_scale  # ~144 dpi at 2.0; drop to 1.0 to quarter the memory
JPEG_QUALITY = 80

_SYSTEM = (
    "You are a meticulous OCR transcriber for film scripts and treatments. Transcribe the "
    "supplied page images VERBATIM, in order — every scene heading, character name, dialogue "
    "line, and action line. Preserve line breaks and screenplay formatting as plain text. Do "
    "not summarise, correct, or annotate; transcribe exactly what is printed. If a word is "
    "illegible, write [illegible]. Return ONLY JSON: {\"text\": \"<the transcription>\"}."
)


def _render_range(pdf, start: int, end: int) -> list[dict]:
    """Render pages [start, end) to base64 JPEGs. Only these pages are held in memory at once."""
    out: list[dict] = []
    for i in range(start, end):
        page = pdf[i]
        bitmap = page.render(scale=RENDER_SCALE)
        pil = bitmap.to_pil().convert("RGB")
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=JPEG_QUALITY)
        out.append({"mediaType": "image/jpeg",
                    "data": base64.b64encode(buf.getvalue()).decode("ascii")})
        page.close()
        del bitmap, pil, buf
    return out


def render_pdf_pages(data: bytes) -> list[dict]:
    """PDF bytes → [{mediaType, data}], capped at MAX_PAGES. (Loads all at once — prefer ocr_pdf,
    which streams. Kept for callers that need every page image.)"""
    import pypdfium2 as pdfium  # lazy
    pdf = pdfium.PdfDocument(io.BytesIO(data))
    try:
        return _render_range(pdf, 0, min(len(pdf), MAX_PAGES))
    finally:
        pdf.close()


def ocr_pdf(data: bytes, filename: str = "") -> str:
    """Transcribe a scanned PDF via the vision model, STREAMING a few pages at a time so peak
    memory stays small (safe on a 512 MB host). Returns "" when disabled or impossible."""
    if not settings.enable_ocr:
        _log.info("ocr: disabled (ENABLE_OCR=false) — skipping %s", filename)
        return ""
    if resolve_provider() is None:
        _log.info("ocr: no LLM provider — skipping OCR for %s", filename)
        return ""
    import pypdfium2 as pdfium  # lazy
    try:
        pdf = pdfium.PdfDocument(io.BytesIO(data))
    except Exception as exc:  # noqa: BLE001 — corrupt / unsupported PDF
        _log.warning("ocr: could not open %s: %s", filename, exc)
        return ""
    chunks: list[str] = []
    try:
        n = min(len(pdf), MAX_PAGES)
        for start in range(0, n, PAGES_PER_BATCH):
            end = min(n, start + PAGES_PER_BATCH)
            try:
                batch = _render_range(pdf, start, end)  # only these pages in memory
            except Exception as exc:  # noqa: BLE001
                _log.warning("ocr: render failed pages %d-%d of %s: %s", start, end, filename, exc)
                break
            result = complete_json(
                system=_SYSTEM,
                prompt=f"Transcribe these page(s) (pages {start + 1}-{end} of the document), in order.",
                images=batch,
                fallback=lambda: {"text": ""},
                cache_prefix="ocr",
                max_tokens=8000,
                temperature=0.0,
            )
            text = result.get("text", "") if isinstance(result, dict) else ""
            if text.strip():
                chunks.append(text.strip())
            del batch  # free the page images before the next batch
    finally:
        pdf.close()
    out = "\n\n".join(chunks)
    _log.info("ocr: %s -> %d chars", filename, len(out))
    return out
