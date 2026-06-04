"""Design Direction agent → DesignDirection (palette, typography, visual language).

This is the agent that "determines the visual representation from genre/tone". It always
starts from the matched style register (a strong prior) and, when an LLM is available,
refines the language while keeping a coherent, genre-appropriate palette.
"""
from __future__ import annotations

import json

from app.ai.llm import complete_json
from app.ai.registers import (
    FONT_BY_REGISTER,
    REGISTERS,
    design_direction_fallback,
    select_register,
)


_SYSTEM = (
    "You are a film art director designing a pitch-deck visual system. You are given the project's "
    "genre, tone, intake notes, and a recommended style register (with a base palette). Produce a "
    "cohesive design direction. Keep the palette genre-appropriate (6 colors, each with a real hex). "
    "Return ONLY JSON with keys: mood, cinematicTone, palette (array of {name, hex, usage}), "
    "typography ({headings, body, accents, treatment}), visualStyle (array), backgroundStyle, "
    "imageStyle, layoutStyle, rationale."
)


def run(project: dict, intake: dict) -> dict:
    genres = project.get("genres") or []
    tone = project.get("tone") or []
    register_id = select_register(genres, tone, (intake or {}).get("genreBlend", ""))
    fallback = lambda: design_direction_fallback(genres, tone, intake, register_id)

    reg = REGISTERS[register_id]
    payload = {
        "genres": genres,
        "tone": tone,
        "intake": {k: (intake or {}).get(k) for k in
                   ("visualAesthetic", "colorPalette", "textureStyle", "visualMood",
                    "designDirection", "genreBlend")},
        "recommendedRegister": {"id": register_id, "label": reg["label"], "palette": reg["palette"]},
    }
    result = complete_json(
        system=_SYSTEM,
        prompt="Design brief:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=fallback,
        cache_prefix="design",
    )
    # Always tag the register + apply its font pairing (deterministic, not LLM-chosen).
    if isinstance(result, dict):
        result.setdefault("_register", register_id)
        result["fonts"] = {"display": FONT_BY_REGISTER.get(register_id, "cormorant"), "body": "sans"}
    return result
