"""Projects + intake endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.templates import recommend_template
from app.core.db import get_db
from app.models import Project, User
from app.routers.deps import get_current_owner, get_owned_project
from app.schemas.intake import IntakeUpdate
from app.schemas.project import ProjectCreate, ProjectRead, ProjectSummary, ProjectUpdate
from app.services import project_service

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
