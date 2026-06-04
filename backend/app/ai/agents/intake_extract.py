"""Intake Extraction agent → IntakeFormData from raw script text.

Reads an uploaded screenplay/treatment and fills the 20-field intake form
(frontend src/types/workflow.ts). Grounded STRICTLY in the supplied text — the
LLM is told never to invent facts. With no provider configured, a conservative
deterministic fallback fills only what can be read without guessing.
"""
from __future__ import annotations

import json
import re

from app.ai.llm import complete_json

# camelCase keys exactly matching IntakeFormData (the schema accepts these aliases).
# "extract" = lift from the text; "synthesize" = infer from the whole story like a
# development exec building the pitch. Every field should be filled.
_FIELDS: dict[str, str] = {
    "title": "The film/series title (extract; if untitled, propose a strong working title).",
    "tagline": "A punchy one-line marketing tagline (synthesize).",
    "logline": "ONE vivid sentence: protagonist + goal + central conflict/stakes (synthesize).",
    "genreBlend": "2-3 genres blended with '+', e.g. 'Coming-of-Age Comedy + Family Drama' (synthesize).",
    "tone": "4-6 tonal adjectives, e.g. 'warm, comedic, heartfelt, nostalgic' (synthesize).",
    "synopsis": "A tight 3-5 sentence plot synopsis: setup, conflict, arc (synthesize from the story).",
    "storyWorld": "The setting/world: place, era, social texture (extract + describe).",
    "mainCharacters": "Lead characters as 'Name — role — one-line description.', separated by periods (extract).",
    "characterDynamics": "The key relationships, alliances and conflicts between characters (extract).",
    "usp": "2-4 selling points: what makes this fresh/marketable, separated by periods (synthesize).",
    "showCross": "2-3 real comparable films/shows audiences will recognize, e.g. 'Jersey x Pelli Choopulu' (synthesize).",
    "targetAudience": "Who this is for: demographics, language market, viewing context (synthesize).",
    "releaseFit": "Best release path: OTT / theatrical / festival / regional, with reasoning (synthesize).",
    "visualAesthetic": "The visual style and look the film should have (synthesize).",
    "colorPalette": "A fitting color palette for this story's mood, e.g. 'warm ambers, dusty greens' (synthesize).",
    "textureStyle": "Texture/grain/film-stock feel that suits the story (synthesize).",
    "designDirection": "One-line directorial/visual design direction (synthesize).",
    "themes": "The core themes the story explores, comma-separated (synthesize).",
    "keyScenes": "2-3 signature or pivotal scenes from the material (extract).",
    "visualMood": "The atmosphere/mood the visuals should evoke (synthesize).",
}

_SYSTEM = (
    "You are an experienced film development executive turning a script, treatment, or synopsis "
    "into a complete, producer-ready PITCH INTAKE. Read the supplied text carefully and fill EVERY "
    "field below.\n"
    "Two kinds of fields:\n"
    "  • EXTRACT fields (title, mainCharacters, characterDynamics, storyWorld, keyScenes): take "
    "these faithfully from the text — real names, real places, real events. Do not fabricate facts.\n"
    "  • SYNTHESIZE fields (logline, tagline, genreBlend, tone, synopsis, usp, showCross, "
    "targetAudience, releaseFit, visualAesthetic, colorPalette, textureStyle, designDirection, "
    "themes, visualMood): these are your editorial judgment as a pitch professional, INFERRED from "
    "the story's actual content. You SHOULD confidently infer genre, tone, themes, comparables, "
    "audience, and visual direction from what happens in the story — that is expected, not "
    "invention. Ground every inference in the material; never contradict it.\n"
    "Be precise, specific to THIS story (no generic boilerplate), and concise. Leave a field as an "
    "empty string ONLY if the text gives you genuinely nothing to base it on. "
    "Return ONLY a JSON object with these exact keys: " + ", ".join(_FIELDS) + "."
)


def _title_from_filename(filename: str) -> str:
    stem = re.sub(r"\.[^.]+$", "", filename or "").strip()
    stem = re.sub(r"[_\-]+", " ", stem).strip()
    return stem.title() if stem else ""


def _fallback(text: str, filename: str) -> dict:
    """No LLM: fill only what we can read without guessing (title + raw synopsis snippet)."""
    snippet = " ".join(text.split())[:1500]
    return {
        "title": _title_from_filename(filename),
        "synopsis": snippet,
    }


def run(text: str, filename: str = "") -> dict:
    """Return a partial IntakeFormData dict (camelCase keys) extracted from the script text."""
    payload = {
        "fields": _FIELDS,
        "scriptText": text,
    }
    result = complete_json(
        system=_SYSTEM,
        prompt="Extract the intake from this script:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=lambda: _fallback(text, filename),
        cache_prefix="intake_extract",
        max_tokens=3000,
        temperature=0.5,
    )
    if not isinstance(result, dict):
        result = _fallback(text, filename)

    # Keep only known string fields; backfill title from filename if the LLM left it blank.
    cleaned = {
        key: value.strip()
        for key, value in result.items()
        if key in _FIELDS and isinstance(value, str) and value.strip()
    }
    if not cleaned.get("title"):
        title = _title_from_filename(filename)
        if title:
            cleaned["title"] = title
    return cleaned
