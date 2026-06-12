"""Conversational intake interview endpoints.

Powers the chat that replaces the IdentityStep / BodyStep / PitchStep forms.
Each turn runs the intake_interview agent; finalize materialises the brief into the
project's IntakeFormData so the existing generation pipeline runs unchanged.
"""
from __future__ import annotations

from functools import partial

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.ai.agents import intake_interview
from app.ai.llm import provider_name
from app.core.db import get_db
from app.models import Project
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


class FinalizeBody(BaseModel):
    brief: dict = Field(default_factory=dict)


# Accepted intake field names (camelCase aliases) — used to drop any non-intake
# keys the agent may emit (e.g. projectType) before validating IntakeFormData.
_INTAKE_ALIASES = {
    (f.alias or name) for name, f in IntakeFormData.model_fields.items()
}


@router.post("/{project_id}/interview")
async def interview_turn(
    body: InterviewTurn,
    project: Project = Depends(get_owned_project),
) -> dict:
    """Run one interview turn. The agent call is blocking, so keep it off the loop."""
    run = partial(
        intake_interview.run,
        body.history,
        body.pillars,
        body.brief,
        images=_clean_images(body.images),
        script=project.script_text,
    )
    result = await run_in_threadpool(run)
    if isinstance(result, dict):
        result.setdefault("provider", provider_name())
    return result


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
