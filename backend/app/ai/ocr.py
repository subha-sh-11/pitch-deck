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
# pages. Configurable (OCR_MAX_PAGES) — turn it DOWN on a small/free-tier host to avoid OOM.
MAX_PAGES = settings.ocr_max_pages
PAGES_PER_BATCH = 5
RENDER_SCALE = 2.0  # ~144 dpi — plenty for typewritten screenplay text
JPEG_QUALITY = 80

_SYSTEM = (
    "You are a meticulous OCR transcriber for film scripts and treatments. Transcribe the "
    "supplied page images VERBATIM, in order — every scene heading, character name, dialogue "
    "line, and action line. Preserve line breaks and screenplay formatting as plain text. Do "
    "not summarise, correct, or annotate; transcribe exactly what is printed. If a word is "
    "illegible, write [illegible]. Return ONLY JSON: {\"text\": \"<the transcription>\"}."
)


def render_pdf_pages(data: bytes) -> list[dict]:
    """PDF bytes → [{mediaType, data(base64 jpeg)}], capped at MAX_PAGES."""
    import pypdfium2 as pdfium  # lazy
    from PIL import Image  # noqa: F401  # lazy — pypdfium2 renders to PIL

    pdf = pdfium.PdfDocument(io.BytesIO(data))
    images: list[dict] = []
    try:
        for i, page in enumerate(pdf):
            if i >= MAX_PAGES:
                break
            bitmap = page.render(scale=RENDER_SCALE)
            pil = bitmap.to_pil().convert("RGB")
            buf = io.BytesIO()
            pil.save(buf, format="JPEG", quality=JPEG_QUALITY)
            images.append({
                "mediaType": "image/jpeg",
                "data": base64.b64encode(buf.getvalue()).decode("ascii"),
            })
            page.close()
    finally:
        pdf.close()
    return images


def ocr_pdf(data: bytes, filename: str = "") -> str:
    """Transcribe a scanned PDF via the vision model. Returns "" when impossible."""
    if resolve_provider() is None:
        _log.info("ocr: no LLM provider — skipping OCR for %s", filename)
        return ""
    try:
        pages = render_pdf_pages(data)
    except Exception as exc:  # noqa: BLE001 — missing dep / corrupt PDF → no OCR
        _log.warning("ocr: could not render %s to images: %s", filename, exc)
        return ""
    if not pages:
        return ""

    _log.info("ocr: transcribing %d page(s) of %s via vision model", len(pages), filename)
    chunks: list[str] = []
    for start in range(0, len(pages), PAGES_PER_BATCH):
        batch = pages[start:start + PAGES_PER_BATCH]
        result = complete_json(
            system=_SYSTEM,
            prompt=(
                f"Transcribe these {len(batch)} page(s) (pages {start + 1}-"
                f"{start + len(batch)} of the document), in order."
            ),
            images=batch,
            fallback=lambda: {"text": ""},
            cache_prefix="ocr",
            max_tokens=8000,
            temperature=0.0,
        )
        text = result.get("text", "") if isinstance(result, dict) else ""
        if text.strip():
            chunks.append(text.strip())
    out = "\n\n".join(chunks)
    _log.info("ocr: %s -> %d chars from %d page(s)", filename, len(out), len(pages))
    return out
