"""Conversational intake interview endpoints.

Powers the chat that replaces the IdentityStep / BodyStep / PitchStep forms.
Each turn runs the intake_interview agent; finalize materialises the brief into the
project's IntakeFormData so the existing generation pipeline runs unchanged.
"""
from __future__ import annotations

import base64
import hashlib
from functools import partial

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.ai.agents import intake_interview
from app.ai.llm import provider_name
from app.core.db import get_db
from app.core.storage import store_asset
from app.models import Asset, Project
from app.routers.deps import get_owned_project
from app.schemas.intake import IntakeFormData
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["interview"])


class InterviewTurn(BaseModel):
    history: list[dict] = Field(default_factory=list)
    pillars: dict = Field(default_factory=dict)
    brief: dict | None = None
    # Reference images shared this turn: [{"name", "mediaType", "data": <base64>}].
    # The frontend downscales before upload; we still cap count/size defensively.
    images: list[dict] = Field(default_factory=list)


_MAX_IMAGES = 4
_MAX_IMAGE_B64 = 4_000_000  # ~3 MB binary per image
_MAX_REFERENCES = 10        # total references kept per project (matches the frontend gallery cap)
_REF_EXT = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp"}


def _clean_images(images: list[dict]) -> list[dict] | None:
    cleaned = [
        {
            "name": str(img.get("name", "reference"))[:120],
            "mediaType": str(img.get("mediaType", "image/jpeg")),
            "data": img["data"],
        }
        for img in images
        if isinstance(img, dict)
        and isinstance(img.get("data"), str)
        and 0 < len(img["data"]) <= _MAX_IMAGE_B64
    ][:_MAX_IMAGES]
    return cleaned or None


async def _persist_reference_images(
    db: AsyncSession, project: Project, images: list[dict] | None
) -> None:
    """Persist visual-direction references as ``upload_ref`` assets (deduped by content hash).

    The intake conversation sends references as ephemeral per-turn base64 — seen once by the
    vision model, then lost. Deck generation runs later (async) from persisted state, so without
    this the references can never reach image generation. We tag them ``source=visual_direction``
    to distinguish them from editor slide-replacement uploads (which share the ``upload_ref`` kind).
    """
    if not images:
        return
    existing = (
        await db.execute(
            select(Asset).where(Asset.project_id == project.id, Asset.kind == "upload_ref")
        )
    ).scalars().all()
    seen_hashes = {(a.generation_meta or {}).get("sha256") for a in existing}
    vd_count = sum(
        1 for a in existing if (a.generation_meta or {}).get("source") == "visual_direction"
    )
    added = False
    for img in images:
        if vd_count >= _MAX_REFERENCES:
            break
        try:
            raw = base64.b64decode(img["data"])
        except Exception:
            continue
        if not raw:
            continue
        digest = hashlib.sha256(raw).hexdigest()
        if digest in seen_hashes:
            continue  # already stored on a previous turn
        seen_hashes.add(digest)
        mime = (img.get("mediaType") or "image/jpeg").lower()
        ext = _REF_EXT.get(mime, "jpg")
        asset = Asset(
            project_id=project.id,
            kind="upload_ref",
            storage_key="",
            mime=mime,
            generation_meta={"source": "visual_direction", "sha256": digest},
        )
        db.add(asset)
        await db.flush()  # assign asset.id
        key = f"{project.id}/uploads/{asset.id}.{ext}"
        stored = await run_in_threadpool(store_asset, key, raw, mime)
        asset.storage_key = key
        asset.generation_meta = {
            **(asset.generation_meta or {}),
            "stored_in_s3": stored.stored_in_s3,
        }
        vd_count += 1
        added = True
    if added:
        await db.commit()


class FinalizeBody(BaseModel):
    brief: dict = Field(default_factory=dict)


# Accepted intake field names (camelCase aliases) — used to drop any non-intake
# keys the agent may emit (e.g. projectType) before validating IntakeFormData.
_INTAKE_ALIASES = {
    (f.alias or name) for name, f in IntakeFormData.model_fields.items()
}


def _pillars_with_project(pillars: dict, project: Project) -> dict:
    """Fold what the director entered on the project-creation form into the pillars, so the
    agent knows it from the very first turn (title, format, genre, language, purpose…) instead
    of starting blind and re-asking. Anything the client already sent wins."""
    out = dict(pillars or {})
    if not str(out.get("title") or "").strip() and project.title:
        out["title"] = project.title
    project_meta = {
        k: v
        for k, v in {
            "projectType": project.project_type,
            "pitchPurpose": project.pitch_purpose,
            "storyStage": project.story_stage,
            "language": project.language,
            "genres": project.genres or [],
            "tone": project.tone or [],
        }.items()
        if v
    }
    out["meta"] = {**project_meta, **(out.get("meta") or {})}
    return out


@router.post("/{project_id}/interview")
async def interview_turn(
    body: InterviewTurn,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Run one interview turn. The agent call is blocking, so keep it off the loop."""
    cleaned = _clean_images(body.images)
    # Persist any references shared this turn so they survive to generation time (where they
    # condition slide art), instead of only feeding this turn's vision-model read.
    await _persist_reference_images(db, project, cleaned)
    run = partial(
        intake_interview.run,
        body.history,
        _pillars_with_project(body.pillars, project),
        body.brief,
        images=cleaned,
        script=project.script_text,
    )
    result = await run_in_threadpool(run)
    if isinstance(result, dict):
        result.setdefault("provider", provider_name())
    return result


class InterviewState(BaseModel):
    """The saved conversation blob the frontend replays: messages, sections, brief, history."""

    state: dict = Field(default_factory=dict)


# A conversation is text + small thumbnails; anything bigger means something pathological
# (e.g. full-size images smuggled into messages) — reject instead of bloating the row.
_MAX_STATE_BYTES = 800_000


@router.get("/{project_id}/interview/state")
async def get_interview_state(project: Project = Depends(get_owned_project)) -> dict:
    """The saved conversation for this project (None when the chat hasn't started)."""
    return {"state": project.interview_state}


@router.put("/{project_id}/interview/state")
async def save_interview_state(
    body: InterviewState,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Persist the conversation so it survives across browsers/devices."""
    import json as _json

    raw = _json.dumps(body.state)
    if len(raw.encode("utf-8", "ignore")) > _MAX_STATE_BYTES:
        raise HTTPException(status_code=413, detail="conversation state too large")
    project.interview_state = body.state
    await db.commit()
    return {"ok": True}


@router.post("/{project_id}/interview/finalize", response_model=IntakeFormData)
async def interview_finalize(
    body: FinalizeBody,
    project: Project = Depends(get_owned_project),
    db: AsyncSession = Depends(get_db),
):
    """Flatten the brief -> IntakeFormData and persist it on the project."""
    raw = intake_interview.to_intake_form(body.brief)
    clean = {k: v for k, v in raw.items() if k in _INTAKE_ALIASES}
    form = IntakeFormData.model_validate(clean)
    await project_service.save_intake(db, project, form)
    await db.commit()
    await db.refresh(project)
    return form
