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
    "tagline": "A punchy one-line marketing tagline that captures the story's hook (synthesize).",
    "logline": "ONE vivid sentence: protagonist + want + central conflict/stakes + what makes it "
               "singular. It must capture the IRONY or tension at the story's heart (synthesize).",
    "genreBlend": "2-3 genres blended with '+', from the story's ACTUAL events and tone — not the "
                  "genre it superficially resembles (synthesize).",
    "tone": "4-6 precise tonal adjectives that track the script's real emotional register, "
            "including how it SHIFTS across acts if it does (synthesize).",
    "synopsis": "A tight 4-6 sentence synopsis tracing the FULL arc: setup and ordinary world → "
                "inciting incident → escalating conflict and midpoint turn → crisis → climax and "
                "resolution. Capture the protagonist's INTERNAL change, not just plot events "
                "(synthesize from the whole story).",
    "storyWorld": "The setting/world: place, era, social texture, rules of the world, and how the "
                  "world itself creates pressure on the characters (extract + describe).",
    "mainCharacters": "EVERY significant character as 'Name — role — arc: who they are at the start, "
                      "what they want vs. need, how they change.', separated by periods. Lead(s) "
                      "first, then antagonist, then key supporting (extract — real names from the text).",
    "characterDynamics": "The relationship MAP: who is bound to whom (love, rivalry, debt, blood, "
                         "duty), which relationships shift across the story, and the central "
                         "relationship the story is really about (extract).",
    "usp": "3-4 selling points grounded in what is genuinely fresh HERE: an unseen world, a novel "
           "protagonist, a structural device, a cultural moment, separated by periods (synthesize).",
    "showCross": "2-3 real comparable films/shows audiences will recognize, e.g. 'Jersey x Pelli "
                 "Choopulu' — comps that match this story's TONE and MARKET, not just its plot "
                 "(synthesize).",
    "targetAudience": "Who this is for: demographics, language market, viewing context, and WHY "
                      "this story speaks to them (synthesize).",
    "releaseFit": "Best release path: OTT / theatrical / festival / regional, with reasoning from "
                  "the story's scale and audience (synthesize).",
    "visualAesthetic": "The visual style the material itself implies: how key locations, times of "
                       "day, and set-pieces in the script suggest a look (synthesize from the text's "
                       "actual imagery).",
    "colorPalette": "A palette drawn from the story's actual world and mood progression, e.g. 'warm "
                    "ambers and dust early, draining to steel blues as the noose tightens' (synthesize).",
    "textureStyle": "Texture/grain/film-stock feel that suits the story's era, world and tone (synthesize).",
    "designDirection": "One-line directorial/visual design direction that a cinematographer could "
                       "shoot from (synthesize).",
    "themes": "The core themes the story ACTUALLY explores through its events — what the story is "
              "about underneath the plot, comma-separated (synthesize).",
    "keyScenes": "3-5 signature scenes FROM THE TEXT that a pitch deck should showcase: the opening "
                 "image, the most cinematic set-piece, the emotional peak, the climax. One vivid "
                 "sentence each, separated by periods (extract).",
    "visualMood": "The atmosphere the visuals should evoke, tracking the story's emotional "
                  "trajectory (synthesize).",
}

_SYSTEM = (
    "You are a senior film development executive doing a FULL COVERAGE READ of a script, treatment, "
    "or synopsis to build a producer-ready PITCH INTAKE. Your reputation rests on never missing "
    "what's actually in the material.\n"
    "\n"
    "READ THE ENTIRE TEXT FIRST — beginning to end, before you write anything. As you read, track:\n"
    "  1. CHARACTERS: every named character; who the protagonist(s) and antagonist really are; each "
    "significant character's arc (start state → want vs. need → end state); entrances and exits.\n"
    "  2. RELATIONSHIPS: the web between characters — love, rivalry, family, debt, betrayal — and "
    "which relationship carries the emotional spine of the story.\n"
    "  3. STRUCTURE: the actual shape — inciting incident, escalations, midpoint reversal, low "
    "point, climax, resolution — so your synopsis reflects the real architecture, not a guess from "
    "the first pages.\n"
    "  4. THEMES & EMOTION: what the events MEAN — the questions the story keeps asking, where it "
    "lands, and the emotional journey it puts the audience through.\n"
    "  5. KEY SCENES: the handful of scenes that sell the film — opening image, biggest set-piece, "
    "emotional peak, climax — as they appear in the text.\n"
    "  6. GENRE & MARKET SIGNALS: tropes used or subverted, tone shifts, scale, and what kind of "
    "audience the material is really for.\n"
    "  7. VISUAL OPPORTUNITIES: locations, light, era, textures and imagery the text itself "
    "describes — the raw material of the deck's look.\n"
    "\n"
    "THEN fill every field. Two kinds:\n"
    "  • EXTRACT fields (title, mainCharacters, characterDynamics, storyWorld, keyScenes): "
    "faithfully from the text — real names, real places, real events, real scenes. Do not "
    "fabricate; do not stop at the first act's characters; do not miss a major character who "
    "enters late.\n"
    "  • SYNTHESIZE fields (logline, tagline, genreBlend, tone, synopsis, usp, showCross, "
    "targetAudience, releaseFit, visualAesthetic, colorPalette, textureStyle, designDirection, "
    "themes, visualMood): your professional judgment, INFERRED from the whole story — expected, "
    "not invention. Ground every inference in material you actually read; never contradict it.\n"
    "\n"
    "QUALITY BAR: every field specific to THIS story — a reader should recognise the script from "
    "your intake alone. No boilerplate ('a thrilling journey'), no hedging. Leave a field empty "
    "ONLY if the text gives genuinely nothing to base it on. "
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
        max_tokens=4000,
        temperature=0.4,
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
