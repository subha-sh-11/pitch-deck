"""Slide Content agent → SlideContent per slide type (frontend src/types/slide.ts).

Deterministic fallback mirrors the frontend's build-slides logic, grounded strictly in the
intake form. The LLM refinement sharpens copy without inventing plot beyond the intake.
"""
from __future__ import annotations

import json
import re

from app.ai.llm import complete_json


def _g(intake: dict, key: str, default: str = "") -> str:
    val = (intake or {}).get(key)
    return val if isinstance(val, str) and val.strip() else default


def _split(text: str, pattern: str, limit: int) -> list[str]:
    return [p.strip() for p in re.split(pattern, text) if p.strip()][:limit]


def _mood_blocks(design: dict | None) -> list[dict]:
    palette = (design or {}).get("palette") or []
    blocks = [{"label": c.get("name", "Tone"), "color": c.get("hex", "#2A2A2A")}
              for c in palette[:4] if c.get("hex")]
    return blocks or [
        {"label": "Base", "color": "#2A2A2A"},
        {"label": "Accent", "color": "#B8862F"},
    ]


def content_fallback(slide_type: str, intake: dict, design: dict | None = None) -> dict:
    """Deterministic SlideContent grounded in the intake form."""
    if slide_type == "cover":
        return {"heading": (_g(intake, "title") or "Untitled").upper(),
                "subheading": _g(intake, "tagline"), "body": _g(intake, "logline")}
    if slide_type == "logline":
        return {"heading": "Logline", "body": _g(intake, "logline")}
    if slide_type == "genre_blend":
        tone = _g(intake, "tone")
        items = [{"title": t, "description": tone}
                 for t in _split(_g(intake, "genreBlend"), r"[+,&]", 3)]
        return {"heading": "Genre Blend", "items": items}
    if slide_type == "synopsis":
        return {"heading": "Synopsis", "body": _g(intake, "synopsis")}
    if slide_type == "story_world":
        return {"heading": "Story World", "body": _g(intake, "storyWorld")}
    if slide_type in ("character", "supporting_characters"):
        heading = "Main Characters" if slide_type == "character" else "Supporting Characters"
        chars = []
        for line in _split(_g(intake, "mainCharacters"), r"[.;]", 3):
            parts = [p.strip() for p in line.split("—")]
            chars.append({"name": parts[0] or "Character",
                          "role": parts[1] if len(parts) > 1 else "Lead",
                          "description": parts[2] if len(parts) > 2 else _g(intake, "characterDynamics")})
        return {"heading": heading, "characters": chars}
    if slide_type == "usp":
        return {"heading": "USP", "bullets": _split(_g(intake, "usp"), r"[.;]", 5)}
    if slide_type == "show_cross":
        audience = _g(intake, "targetAudience")
        comps = [{"title": c, "note": audience}
                 for c in _split(_g(intake, "showCross"), r"[,×x]", 3)][:3]
        return {"heading": "Show Cross", "comps": comps}
    if slide_type == "visual_aesthetic":
        return {"heading": "Visual Aesthetic",
                "body": _g(intake, "visualAesthetic") or _g(intake, "designDirection"),
                "moodBlocks": _mood_blocks(design)}
    if slide_type == "target_audience":
        return {"heading": "Target Audience",
                "items": [{"title": "Primary", "description": _g(intake, "targetAudience")},
                          {"title": "Release", "description": _g(intake, "releaseFit")}]}
    if slide_type == "budget":
        return {"heading": "Budget & Production Scale",
                "body": "Contained production positioned for strong ROI. Scale aligned with story scope."}
    if slide_type == "market_potential":
        return {"heading": "Market Potential",
                "bullets": [b for b in [_g(intake, "releaseFit"),
                                        "Regional OTT with pan-India subtitle appeal",
                                        "Festival craft positioning available"] if b]}
    if slide_type == "directors_vision":
        return {"heading": "Director's Vision",
                "body": _g(intake, "designDirection") or _g(intake, "synopsis")}
    if slide_type == "team":
        return {"heading": "Team & Production Status",
                "body": "Development stage. Key creative attachments in progress."}
    if slide_type == "contact":
        return {"heading": "Let's Talk", "subheading": _g(intake, "title"),
                "body": "Ready for producer and investor conversations."}
    return {"heading": "Slide", "body": _g(intake, "synopsis")}


_SYSTEM = (
    "You are the copywriter behind the best film pitch decks in the industry — decks that read "
    "like the trailer feels. You are writing ONE slide of a deck that, as a whole, tells the "
    "story of a film to producers and investors. Every slide is a STORY BEAT in that telling, "
    "not an isolated content block.\n"
    "Craft rules:\n"
    "  • THE SLIDE FORMULA: one clear title + ONE key message + minimal supporting text. Before "
    "writing, decide the single thing this slide must communicate; every element serves it, and "
    "anything that doesn't gets cut. A producer should grasp the slide in three seconds.\n"
    "  • GROUNDED: use STRICTLY the provided intake — never invent plot, characters, or facts "
    "not present. Specificity from the material beats cleverness.\n"
    "  • PURPOSE-DRIVEN: the slide's stated purpose tells you the job — a cover seduces, a "
    "logline hooks, characters make us care, market slides make the money case. Write to the "
    "job, in the deck's stated tone.\n"
    "  • HEADLINES: evocative and specific to this story, never labels with a colon, never "
    "generic ('A World Like No Other' is a failure; name the world).\n"
    "  • BODY: producer-readable — 1-3 tight sentences max, active voice, no filler ('truly', "
    "'compelling', 'takes us on a journey'), no marketing froth. White space is part of the "
    "design; less copy, better chosen, reads as more premium.\n"
    "  • BULLETS/ITEMS: parallel construction, each one a distinct idea, 3-5 max, every word "
    "earning its place.\n"
    "  • CHARACTERS: name — role — one line that makes a producer see the casting opportunity: "
    "their want, their wound, their contradiction. For the main characters slide, include ONLY "
    "the 3-4 PRIMARY leads (the people the story is about), most important first — never pad "
    "with minor or supporting roles.\n"
    "  • SHOW CROSS / COMPS: always give exactly 3 comparable films or shows (never 2), each a "
    "real, recognisable title; the note says who it reached and why this project rhymes with it.\n"
    "  • EMOTIONAL THROUGHLINE: echo the story's central tension in the slide's language so the "
    "deck reads as one voice from cover to contact.\n"
    "  • DIRECTOR'S INSTRUCTIONS: if the prompt contains a DIRECTOR'S INSTRUCTIONS section, it "
    "comes from the filmmaker reviewing this exact slide — follow it faithfully (tone, angle, "
    "what to emphasise or drop), even over the rules above, while staying grounded in the "
    "story material.\n"
    "Return ONLY a JSON object using ONLY the fields relevant to this slide type, from this set: "
    "heading (required), subheading, body, bullets (array of strings), items (array of {title, "
    "description}), characters (array of {name, role, description}), comps (array of {title, note}), "
    "moodBlocks (array of {label, color})."
)


# The field each slide-type's template needs to render something. If the LLM omits it,
# we backfill from the deterministic fallback so no slide ever renders blank.
_PRIMARY_FIELDS: dict[str, list[str]] = {
    "cover": ["body"],
    "logline": ["body"],
    "genre_blend": ["items"],
    "synopsis": ["body"],
    "story_world": ["body"],
    "character": ["characters"],
    "supporting_characters": ["characters"],
    "usp": ["bullets"],
    "show_cross": ["comps"],
    "visual_aesthetic": ["body", "moodBlocks"],
    "target_audience": ["items"],
    "budget": ["body"],
    "market_potential": ["bullets"],
    "directors_vision": ["body"],
    "team": ["body"],
    "contact": ["body"],
}


def _empty(value) -> bool:
    return value is None or (isinstance(value, (str, list, dict)) and len(value) == 0)


def _ensure_renderable(slide_type: str, result: dict, fb: dict) -> dict:
    """Backfill the template's expected fields from the fallback when the LLM omitted them."""
    if _empty(result.get("heading")):
        result["heading"] = fb.get("heading") or slide_type.replace("_", " ").title()
    for field in _PRIMARY_FIELDS.get(slide_type, ["body"]):
        if _empty(result.get(field)) and not _empty(fb.get(field)):
            result[field] = fb[field]
    return result


def _label(camel: str) -> str:
    """genreBlend → Genre Blend."""
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", camel).replace("_", " ").title()


def compose_prompt(slide_type: str, title: str, purpose: str, intake: dict,
                   design: dict | None, instructions: str | None = None,
                   reference_slide: dict | None = None) -> str:
    """The exact user-prompt string sent to the LLM for this slide — plain English,
    so the workshop's prompt panel reads like a brief, not code. Generation uses
    this same text verbatim."""
    design = design or {}
    lines: list[str] = [
        f'Write the "{title}" slide of this film pitch deck.',
        "",
        f"SLIDE TYPE: {slide_type.replace('_', ' ')}",
        f"PURPOSE: {purpose or '—'}",
    ]
    if design.get("cinematicTone"):
        lines.append(f"DECK TONE: {design['cinematicTone']}")
    if design.get("mood"):
        lines.append(f"DECK MOOD: {design['mood']}")
    visual_style = design.get("visualStyle")
    if isinstance(visual_style, list) and visual_style:
        lines.append("VISUAL STYLE: " + ", ".join(str(v) for v in visual_style))

    lines += ["", "STORY MATERIAL (ground every word strictly in this; never invent):"]
    for key, value in (intake or {}).items():
        if isinstance(value, str) and value.strip():
            lines.append(f"- {_label(key)}: {value.strip()}")

    # The matching slide from the director's reference deck — match its ANGLE, section
    # framing and length, but write entirely from THIS film's story material above.
    if reference_slide and (reference_slide.get("title") or reference_slide.get("text")):
        lines += [
            "",
            "REFERENCE SLIDE (the director uploaded a deck to emulate — mirror this slide's "
            "angle, framing and tone, but rewrite it for THIS film using only the story "
            "material above; never copy the reference's facts, names or numbers):",
            f"- Reference title: {reference_slide.get('title', '').strip()}",
        ]
        ref_text = (reference_slide.get("text") or "").strip()
        if ref_text:
            lines.append(f"- Reference content: {ref_text[:600]}")

    if instructions and instructions.strip():
        lines += ["", "DIRECTOR'S INSTRUCTIONS (follow faithfully):", instructions.strip()]

    return "\n".join(lines)


def run(slide_type: str, title: str, purpose: str, intake: dict, design: dict | None,
        instructions: str | None = None, raw_prompt: str | None = None,
        reference_slide: dict | None = None) -> dict:
    """``raw_prompt``: a director-edited prompt from the workshop — used VERBATIM as
    the user prompt (the system prompt stays), bypassing composition and cache.
    ``reference_slide``: the matching slide of an uploaded reference deck to emulate."""
    fb = content_fallback(slide_type, intake, design)
    edited = bool(raw_prompt and raw_prompt.strip())
    prompt = raw_prompt.strip() if edited else compose_prompt(
        slide_type, title, purpose, intake, design, instructions, reference_slide
    )
    result = complete_json(
        system=_SYSTEM,
        prompt=prompt,
        fallback=lambda: fb,
        # A reference-grounded slide must not collide with the cached generic one.
        cache_prefix=f"content:ref:{slide_type}" if reference_slide else f"content:{slide_type}",
        # Director-touched prompts must be fresh, never a cache hit of the old copy.
        use_cache=not (edited or (instructions and instructions.strip())),
    )
    if not isinstance(result, dict):
        result = fb
    # visual_aesthetic moodBlocks should reflect the real palette even if the LLM omitted them
    if slide_type == "visual_aesthetic" and not result.get("moodBlocks"):
        result["moodBlocks"] = _mood_blocks(design)
    result = _ensure_renderable(slide_type, result, fb)

    # Show Cross: attach real comparable-film posters (TMDB) when available.
    if slide_type == "show_cross":
        from app.ai import tmdb

        for comp in result.get("comps") or []:
            if isinstance(comp, dict) and comp.get("title") and not comp.get("posterUrl"):
                poster = tmdb.poster_for(comp["title"])
                if poster:
                    comp["posterUrl"] = poster
    return result
