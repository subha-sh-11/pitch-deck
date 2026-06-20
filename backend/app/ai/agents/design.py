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
    "You are a film art director designing the complete visual identity for a cinematic pitch deck "
    "— the kind a director carries into a studio meeting. This is NOT a business presentation: it "
    "is a piece of visual storytelling that must make a producer FEEL the film before a single "
    "scene is shot. You are given the project's genre, tone, intake notes (which may include "
    "observations from the director's own reference images — honour those above all), and a "
    "recommended style register with a base palette. The payload may also include a "
    "`referenceDeck` with the dominant colours (hex) and font names pulled from a deck the "
    "director uploaded — when present, ANCHOR the palette to those colours and echo those "
    "fonts in typography, so the result clearly resembles their reference, then refine for "
    "cinematic quality and contrast.\n"
    "Craft rules:\n"
    "  • PALETTE (6 colors, real hex): build it like a colorist grading the film — a dominant "
    "dark base for slide grounds, one signature accent that carries the story's emotional "
    "temperature, supporting mid-tones, and a light text tone. Name colors evocatively for THIS "
    "story ('Monsoon Slate', not 'Dark Gray') and give each a concrete `usage` (backgrounds / "
    "headlines / accents / captions) so every slide applies them identically — consistency across "
    "the deck is the difference between curated and assembled.\n"
    "  • cinematicTone: the deck's emotional register in one line, as a DP would describe the "
    "film's look.\n"
    "  • TYPOGRAPHY: choose with intent — headings that carry the genre's voice (epic serif, "
    "brutalist sans, elegant editorial), body built for fast producer reading, accents (caps "
    "tracking, numerals) used sparingly; `treatment` states the rule, e.g. 'oversized serif "
    "headlines, generous tracking on caps labels, never more than two faces'.\n"
    "  • visualStyle: 3-5 precise art-direction phrases a designer could execute (composition "
    "habits, image treatment, graphic motifs) — not vague adjectives.\n"
    "  • backgroundStyle / imageStyle: how slide grounds and imagery are treated so every image "
    "in the deck feels pulled from the SAME film (consistent grade, grain, light).\n"
    "  • layoutStyle: the compositional philosophy — where negative space lives, how hierarchy "
    "flows, full-bleed vs framed imagery.\n"
    "  • rationale: one tight paragraph connecting every choice back to the story's emotion — "
    "why THIS look sells THIS film.\n"
    "Return ONLY JSON with keys: mood, cinematicTone, palette (array of {name, hex, usage}), "
    "typography ({headings, body, accents, treatment}), visualStyle (array), backgroundStyle, "
    "imageStyle, layoutStyle, rationale."
)


def run(project: dict, intake: dict, reference: dict | None = None) -> dict:
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
    # A director-supplied reference deck: anchor the palette/typography to its real
    # colours and fonts so the generated deck looks like the one they handed us.
    if reference and (reference.get("colors") or reference.get("fonts")):
        payload["referenceDeck"] = {
            "colors": (reference.get("colors") or [])[:6],
            "fonts": (reference.get("fonts") or [])[:3],
        }
    result = complete_json(
        system=_SYSTEM,
        prompt="Design brief:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=fallback,
        # Reference-anchored designs must not collide with the cached generic one.
        cache_prefix="design:ref" if payload.get("referenceDeck") else "design",
    )
    # Always tag the register + apply its font pairing (deterministic, not LLM-chosen).
    if isinstance(result, dict):
        result.setdefault("_register", register_id)
        result["fonts"] = {"display": FONT_BY_REGISTER.get(register_id, "cormorant"), "body": "sans"}
    return result
