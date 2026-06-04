"""Deck template catalog (for the templates gallery)."""
from __future__ import annotations

from fastapi import APIRouter

from app.ai.templates import TEMPLATES, build_outline

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("")
async def list_templates():
    catalog = []
    for tid, tpl in TEMPLATES.items():
        outline = build_outline(tid)
        catalog.append({
            "id": tid,
            "name": tpl["name"],
            "description": tpl["description"],
            "slideCount": len(outline),
            "matchTags": tpl["match_tags"],
            "slideOutline": [
                {"slideNumber": o["slide_number"], "title": o["title"],
                 "purpose": o["purpose"], "required": o["required"], "slideType": o["slide_type"]}
                for o in outline
            ],
        })
    return catalog
