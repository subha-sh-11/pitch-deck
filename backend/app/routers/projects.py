"""Projects + intake endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai import ingest
from app.ai.agents import intake_extract
from app.ai.templates import recommend_template
from app.core.db import get_db
from app.models import Project, User
from app.routers.deps import get_current_owner, get_owned_project
from app.schemas.intake import IntakeExtractResult, IntakeFormData, IntakeUpdate
from app.schemas.project import ProjectCreate, ProjectRead, ProjectSummary, ProjectUpdate
from app.services import project_service

# Reject uploads larger than this before reading them into memory.
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024

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
    extracted = await run_in_threadpool(intake_extract.run, text, filename)

    form = IntakeFormData.model_validate(extracted)
    dumped = form.model_dump(by_alias=True)
    filled = [key for key, value in dumped.items() if isinstance(value, str) and value.strip()]
    return IntakeExtractResult(file_name=filename, form=form, filled_fields=filled)


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
