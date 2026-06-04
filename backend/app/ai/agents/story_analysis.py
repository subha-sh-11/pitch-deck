"""Story Analysis agent → StoryAnalysis (frontend src/types/workflow.ts)."""
from __future__ import annotations

import json

from app.ai.llm import complete_json


def _g(intake: dict, key: str, default: str = "") -> str:
    val = intake.get(key)
    return val if isinstance(val, str) and val.strip() else default


def _fallback(project: dict, intake: dict) -> dict:
    genres = project.get("genres") or []
    tone = project.get("tone") or []
    genre_dna = genres or [g.strip() for g in _g(intake, "genreBlend").replace("+", ",").split(",") if g.strip()]
    return {
        "coreTheme": _g(intake, "themes") or _g(intake, "logline", "Core dramatic tension of the story."),
        "emotionalCore": _g(intake, "characterDynamics") or _g(intake, "synopsis", "The emotional engine of the story."),
        "genreDna": genre_dna or ["Drama"],
        "storyWorld": _g(intake, "storyWorld", "The world the story inhabits."),
        "commercialAngle": _g(intake, "usp", "The commercial hook of the project."),
        "audiencePromise": _g(intake, "targetAudience", "The experience promised to the audience."),
        "visualWorld": _g(intake, "visualAesthetic") or _g(intake, "visualMood", "The visual identity of the film."),
        "pitchPositioning": _g(intake, "showCross") or _g(intake, "tone", ", ".join(tone)),
    }


_SYSTEM = (
    "You are a film development analyst. Given a project's intake form, distill its story into a "
    "tight analysis. Ground everything strictly in the provided material — never invent plot points. "
    "Return ONLY a JSON object with keys: coreTheme, emotionalCore, genreDna (array of strings), "
    "storyWorld, commercialAngle, audiencePromise, visualWorld, pitchPositioning."
)


def run(project: dict, intake: dict) -> dict:
    payload = {"project": {k: project.get(k) for k in ("title", "genres", "tone", "language", "pitchPurpose")},
               "intake": intake}
    return complete_json(
        system=_SYSTEM,
        prompt="Project + intake:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=lambda: _fallback(project, intake),
        cache_prefix="story_analysis",
    )
