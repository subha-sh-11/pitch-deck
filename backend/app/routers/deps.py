"""Shared router dependencies."""
from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.models import Project, User
from app.services import project_service


async def get_current_owner(db: AsyncSession = Depends(get_db)) -> User:
    """Stub auth — returns the dev owner. Replace with JWT verification later."""
    return await project_service.get_default_owner(db)


async def get_owned_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Project:
    project = await project_service.get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project
