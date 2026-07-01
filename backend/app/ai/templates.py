"""Deck outline templates — the backend source of truth for slide structure.

Mirrors the frontend's preset templates but lives here so generation is server-driven.
The design direction is NOT bundled (the design agent generates it per-project); each
template carries match tags for recommendation.
"""
from __future__ import annotations

from typing import Any

# Canonical slide outline (slide_type, title, purpose, required). `relationship_map` is appended
# LAST so existing template indices stay stable; templates place it after the character slides.
CANONICAL_OUTLINE: list[dict[str, Any]] = [
    {"slide_type": "cover", "title": "Cover", "purpose": "Establish title, tone, and first cinematic impression.", "required": True},
    {"slide_type": "logline", "title": "Logline", "purpose": "Communicate the story hook in one powerful sentence.", "required": True},
    {"slide_type": "genre_blend", "title": "Genre Blend", "purpose": "Position the film's tonal and commercial identity.", "required": True},
    {"slide_type": "synopsis", "title": "Synopsis", "purpose": "Present the story journey clearly and emotionally.", "required": True},
    {"slide_type": "story_world", "title": "Story World", "purpose": "Build the setting, atmosphere, and narrative environment.", "required": True},
    {"slide_type": "character", "title": "Main Characters", "purpose": "Introduce the key emotional drivers of the story.", "required": True},
    {"slide_type": "supporting_characters", "title": "Supporting Characters", "purpose": "Show the wider human world of the film.", "required": False},
    {"slide_type": "usp", "title": "Unique Selling Points", "purpose": "Explain why the project is fresh, urgent, and producible.", "required": True},
    {"slide_type": "show_cross", "title": "Show Cross", "purpose": "Position the project using comparable films and series.", "required": True},
    {"slide_type": "visual_aesthetic", "title": "Visual Aesthetic", "purpose": "Define mood, color, texture, and cinematic language.", "required": True},
    {"slide_type": "target_audience", "title": "Target Audience", "purpose": "Show who the project is built for and why they will connect.", "required": True},
    {"slide_type": "budget", "title": "Budget & Production Scale", "purpose": "Communicate feasibility and production logic.", "required": True},
    {"slide_type": "market_potential", "title": "Market Potential", "purpose": "Explain OTT, theatrical, regional, or wider commercial potential.", "required": True},
    {"slide_type": "directors_vision", "title": "Director's Vision", "purpose": "Present the filmmaker's emotional and creative intent.", "required": True},
    {"slide_type": "team", "title": "Team & Production Status", "purpose": "Show attached talent, stage, and current readiness.", "required": False},
    {"slide_type": "contact", "title": "Contact", "purpose": "End with clear next-step communication.", "required": True},
    {"slide_type": "relationship_map", "title": "Relationship Map", "purpose": "Map the emotional and conflict relationships that drive the story.", "required": False},
]
# Index of the appended relationship-map slide, inserted into templates after the character block.
_REL_MAP = len(CANONICAL_OUTLINE) - 1

# Templates select a subset of the canonical outline by index.
TEMPLATES: dict[str, dict[str, Any]] = {
    "investor-thriller": {
        "name": "Investor Thriller Deck",
        "description": "For financiers and producers. Emphasizes market, budget, and commercial hook.",
        "indices": [0, 1, 2, 3, 4, 5, 6, _REL_MAP, 7, 8, 9, 10, 11, 12, 13],
        "match_tags": ["survival", "thriller", "investor", "suspense", "dark", "contained"],
    },
    "ott-streaming": {
        "name": "OTT / Streaming Pitch",
        "description": "Audience-first structure for platform executives.",
        "indices": [0, 1, 2, 3, 4, 5, _REL_MAP, 7, 8, 9, 10, 12, 15],
        "match_tags": ["ott", "streaming", "audience", "telugu", "series", "thriller"],
    },
    "festival-directors": {
        "name": "Festival Director's Vision",
        "description": "Craft and vision led. For festival programmers and creative attachments.",
        "indices": [0, 1, 2, 3, 4, 5, _REL_MAP, 8, 9, 10, 13, 14, 15],
        "match_tags": ["festival", "director", "vision", "poetic", "artistic"],
    },
    "series-bible-lite": {
        "name": "Series Bible Lite",
        "description": "Expanded character and world focus for limited series or multi-season OTT.",
        "indices": [0, 1, 2, 3, 4, 5, 6, _REL_MAP, 7, 8, 10, 12, 13, 14, 15],
        "match_tags": ["web series", "series", "character", "world", "ott"],
    },
}

DEFAULT_TEMPLATE = "investor-thriller"


def build_outline(template_id: str | None) -> list[dict[str, Any]]:
    """Return an ordered outline (with slide_number) for a template id."""
    tpl = TEMPLATES.get(template_id or DEFAULT_TEMPLATE, TEMPLATES[DEFAULT_TEMPLATE])
    items = [CANONICAL_OUTLINE[i] for i in tpl["indices"]]
    return [{**item, "slide_number": n + 1} for n, item in enumerate(items)]


def recommend_template(genres: list[str] | None, tone: list[str] | None) -> str:
    haystack = " ".join([*(genres or []), *(tone or [])]).lower()
    best, best_score = DEFAULT_TEMPLATE, -1
    for tid, tpl in TEMPLATES.items():
        score = sum(1 for tag in tpl["match_tags"] if tag in haystack)
        if score > best_score:
            best, best_score = tid, score
    return best
