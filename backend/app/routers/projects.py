"""Projects + intake endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import ingest
from app.ai.agents import intake_extract
from app.ai.templates import recommend_template
from app.core.config import settings
from app.core.db import get_db
from app.core.storage import store_asset
from app.models import Asset, Project, User
from app.routers.deps import get_current_owner, get_owned_project
from app.schemas.intake import IntakeExtractResult, IntakeFormData, IntakeUpdate
from app.schemas.project import ProjectCreate, ProjectRead, ProjectSummary, ProjectUpdate
from app.services import project_service

# Reject uploads larger than this before reading them into memory.
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024

# Accepted image uploads (slide image replacement) → file extension.
_IMAGE_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    owner: User = Depends(get_current_owner),
):
    project = await project_service.create_project(db, data, owner)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("", response_model=list[ProjectSummary])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    owner: User = Depends(get_current_owner),
):
    return await project_service.list_projects(db, owner.id)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project: Project = Depends(get_owned_project)):
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    data: ProjectUpdate,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    await project_service.update_project(db, project, data)
    await db.commit()
    await db.refresh(project)
    return project


@router.put("/{project_id}/intake", response_model=ProjectRead)
async def save_intake(
    data: IntakeUpdate,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    await project_service.save_intake(db, project, data.form)
    await db.commit()
    await db.refresh(project)
    return project


@router.post("/{project_id}/intake/extract", response_model=IntakeExtractResult)
async def extract_intake(
    file: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Parse an uploaded script (PDF/DOCX/FDX/TXT) and auto-fill the intake fields."""
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file.")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 15 MB).")

    filename = file.filename or "script"
    # Parsing + the extraction LLM call are blocking — keep them off the event loop.
    text = await run_in_threadpool(ingest.extract_text, filename, data)
    if not text.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Could not read any text from this file. Try a PDF, DOCX, FDX, or TXT.",
        )
    # Keep the full script on the project so the intake conversation can answer
    # questions about specific scenes/characters, not just the extracted fields.
    project.script_text = text
    await db.commit()
    extracted = await run_in_threadpool(intake_extract.run, text, filename)

    form = IntakeFormData.model_validate(extracted)
    dumped = form.model_dump(by_alias=True)
    filled = [key for key, value in dumped.items() if isinstance(value, str) and value.strip()]
    return IntakeExtractResult(file_name=filename, form=form, filled_fields=filled)


async def _persist_deck_reference_images(
    db: AsyncSession, project: Project, images: list[bytes], deck_filename: str, tag: str
) -> int:
    """Persist reference-deck page renders / embedded pictures as ``upload_ref`` assets.

    Same shape as the intake references (``source=visual_direction`` + sha256 + name), so the
    existing generation pipeline (_load_references_full → reference_analysis) sees the deck's
    actual COMPOSITION through the vision model — not just its extracted colours/fonts.
    Names are prefixed ``refdeck-`` so user-shared images can outrank them when capping.
    One reference deck per project: previous ``refdeck-*`` assets are replaced.
    """
    import hashlib

    from sqlalchemy import select

    from app.ai.deck_ref_images import safe_stem

    existing = (
        await db.execute(
            select(Asset).where(Asset.project_id == project.id, Asset.kind == "upload_ref")
        )
    ).scalars().all()
    kept = []
    for a in existing:
        meta = a.generation_meta or {}
        if meta.get("source") == "visual_direction" and str(meta.get("name") or "").startswith("refdeck-"):
            await db.delete(a)  # stale pages from a previously uploaded deck
        else:
            kept.append(a)
    seen_hashes = {(a.generation_meta or {}).get("sha256") for a in kept}
    stem = safe_stem(deck_filename)
    added = 0
    for i, raw in enumerate(images):
        if not raw:
            continue
        digest = hashlib.sha256(raw).hexdigest()
        if digest in seen_hashes:
            continue  # the director already shared this exact image in intake
        seen_hashes.add(digest)
        asset = Asset(
            project_id=project.id,
            kind="upload_ref",
            storage_key="",
            mime="image/jpeg",
            generation_meta={
                "source": "visual_direction",
                "sha256": digest,
                "name": f"refdeck-{stem}-{tag}-{i + 1}.jpg",
            },
        )
        db.add(asset)
        await db.flush()  # assign asset.id
        key = f"{project.id}/uploads/{asset.id}.jpg"
        stored = await run_in_threadpool(store_asset, key, raw, "image/jpeg")
        asset.storage_key = key
        asset.generation_meta = {**(asset.generation_meta or {}),
                                 "stored_in_s3": stored.stored_in_s3}
        added += 1
    return added


@router.post("/{project_id}/references/pptx")
async def parse_reference_deck(
    file: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Parse a reference deck (.pptx or PDF) → structure (slide titles/text), colours, fonts,
    and persist it on the project. When set, generation mirrors its slide sequence and
    visual style (see generation_service + outline/design agents).

    The deck also feeds the VISION-based reference-analysis stage as images: PDF pages are
    rendered to JPEG (Canva exports are usually PDF); for .pptx (no pure-python renderer)
    the embedded slide pictures are extracted. Both are persisted as visual-direction
    reference assets, so the vision model sees the deck's real composition.
    """
    filename = file.filename or "reference.pptx"
    lower = filename.lower()
    is_pdf = lower.endswith(".pdf")
    if not (is_pdf or lower.endswith(".pptx")):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Please upload a .pptx or PDF deck (export Google Slides / Keynote / Canva / old .ppt first).",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file.")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 15 MB).")
    from app.ai import deck_ref_images, pptx_ref

    try:
        if is_pdf:
            ref = await run_in_threadpool(deck_ref_images.extract_reference_pdf, data)
        else:
            ref = await run_in_threadpool(pptx_ref.extract_reference, data)
    except Exception:  # noqa: BLE001 — a corrupt/unreadable file shouldn't 500
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Couldn't read this file as a deck — make sure it's a valid .pptx or PDF export.",
        )
    if not ref.get("slideCount"):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Couldn't read any slides from this deck.",
        )
    # Best-effort: the deck as IMAGES for the vision model. Never fails the upload.
    try:
        if is_pdf:
            images = await run_in_threadpool(deck_ref_images.render_pdf_pages, data)
            tag = "page"
        else:
            images = await run_in_threadpool(deck_ref_images.extract_pptx_images, data)
            tag = "img"
        await _persist_deck_reference_images(db, project, images, filename, tag)
    except Exception:  # noqa: BLE001 — text/colour extraction alone is still useful
        pass
    stored = {"fileName": filename, **ref}
    project.reference_deck = stored
    await db.commit()
    return stored


@router.delete("/{project_id}/references/pptx", status_code=status.HTTP_204_NO_CONTENT)
async def clear_reference_deck(
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Remove the reference deck so generation no longer mimics it."""
    from sqlalchemy import select

    project.reference_deck = None
    # Also drop the deck's persisted page renders / embedded pictures, so the visual
    # profile refingerprints without them (user-shared intake references are kept).
    rows = (
        await db.execute(
            select(Asset).where(Asset.project_id == project.id, Asset.kind == "upload_ref")
        )
    ).scalars().all()
    for a in rows:
        meta = a.generation_meta or {}
        if meta.get("source") == "visual_direction" and str(meta.get("name") or "").startswith("refdeck-"):
            await db.delete(a)
    await db.commit()


@router.post("/{project_id}/assets/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Store a user-uploaded image and return its served URL (for slide image replacement)."""
    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file.")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 15 MB).")
    mime = (file.content_type or "").lower()
    ext = _IMAGE_MIME_EXT.get(mime)
    if ext is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "Unsupported image type. Use PNG, JPG, WEBP, or GIF.",
        )

    asset = Asset(
        project_id=project.id,
        kind="upload_ref",
        storage_key="",
        mime=mime,
        generation_meta={"source": "user_upload"},
    )
    db.add(asset)
    await db.flush()  # assign asset.id
    key = f"{project.id}/uploads/{asset.id}.{ext}"
    stored = await run_in_threadpool(store_asset, key, data, mime)
    asset.storage_key = key
    asset.generation_meta = {**(asset.generation_meta or {}), "stored_in_s3": stored.stored_in_s3}
    await db.commit()

    url = f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}"
    return {"url": url}


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),                   
      
):
    # FK cascade removes decks, slides, assets, and generation jobs.
    await db.delete(project)
    await db.commit()


@router.get("/{project_id}/recommend-template")
async def recommend(project: Project = Depends(get_owned_project)):
    template_id = recommend_template(project.genres, project.tone)
    return {"templateId": template_id}
