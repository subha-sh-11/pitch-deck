"""Project CRUD + intake persistence (async session)."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project, User
from app.schemas.intake import IntakeFormData
from app.schemas.project import ProjectCreate, ProjectUpdate

DEV_OWNER_EMAIL = "dev@pitchdeck.local"


async def get_default_owner(db: AsyncSession) -> User:
    """Return (creating if needed) the dev owner. Replaced by real auth later."""
    result = await db.execute(select(User).where(User.email == DEV_OWNER_EMAIL))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=DEV_OWNER_EMAIL, name="Dev User", role="director")
        db.add(user)
        await db.flush()
    return user


async def create_project(db: AsyncSession, data: ProjectCreate, owner: User) -> Project:
    project = Project(
        owner_id=owner.id,
        title=data.title,
        project_type=data.project_type.value if data.project_type else None,
        pitch_purpose=data.pitch_purpose.value if data.pitch_purpose else None,
        story_stage=data.story_stage.value if data.story_stage else None,
        genres=data.genres,
        tone=data.tone,
        language=data.language,
        production_status=data.production_status.value if data.production_status else None,
        status="intake",
    )
    db.add(project)
    await db.flush()
    return project


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    return await db.get(Project, project_id)


async def list_projects(db: AsyncSession, owner_id: uuid.UUID | None = None) -> list[Project]:
    stmt = select(Project).order_by(Project.updated_at.desc())
    if owner_id:
        stmt = stmt.where(Project.owner_id == owner_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_project(db: AsyncSession, project: Project, data: ProjectUpdate) -> Project:
    for field, value in data.model_dump(exclude_unset=True).items():
        # enums serialize to their .value via model_dump? ensure plain str
        if hasattr(value, "value"):
            value = value.value
        setattr(project, field, value)
    await db.flush()
    return project


async def save_intake(db: AsyncSession, project: Project, form: IntakeFormData) -> Project:
    project.intake_form = form.model_dump(by_alias=True)
    await db.flush()
    return project
