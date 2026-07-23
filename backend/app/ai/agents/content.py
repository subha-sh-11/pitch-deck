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


def attach_film_backdrops(blocks: list) -> list:
    """For visual-aesthetic mood tiles labelled with a reference FILM title, attach that film's
    TMDB backdrop (a real still) as the tile image — so the slide shows actual visual references
    from films whose look matches, not solid colours. Tiles TMDB can't match are left for the
    image pipeline to fill with an original AI mood frame (never a bare colour swatch)."""
    from app.ai import tmdb

    out: list = []
    for b in blocks or []:
        if isinstance(b, dict):
            b = dict(b)
            label = str(b.get("label") or "").strip()
            if label and not b.get("imageUrl"):
                back = tmdb.backdrop_for(label)
                if back:
                    b["imageUrl"] = back
        out.append(b)
    return out


def _three_acts(synopsis: str) -> list[dict]:
    """Split a synopsis into a rough 3-act structure for the timeline (deterministic fallback)."""
    sents = _split(synopsis, r"(?<=[.!?])\s+", 60)
    if not sents:
        return []
    n = len(sents)
    cut1 = max(1, round(n / 3))
    cut2 = max(cut1 + 1, round(2 * n / 3))
    chunks = [sents[:cut1], sents[cut1:cut2], sents[cut2:]]
    labels = [("Act I", "Setup"), ("Act II", "Confrontation"), ("Act III", "Resolution")]
    out: list[dict] = []
    for (num, beat), chunk in zip(labels, chunks):
        text = " ".join(chunk).strip()
        if text:
            out.append({"title": f"{num} · {beat}", "description": text})
    return out


def _parse_character_line(line: str) -> dict | None:
    parts = [p.strip() for p in re.split(r"[—–-]", line) if p.strip()]
    if not parts:
        return None
    return {"name": parts[0], "role": parts[1] if len(parts) > 1 else "",
            "description": parts[2] if len(parts) > 2 else ""}


def _relationship_fallback(intake: dict) -> dict:
    """Deterministic relationship-map: character nodes + lead-to-others edges (no LLM)."""
    nodes: list[dict] = []
    seen: set[str] = set()
    for key in ("mainCharacters", "supportingCharacters"):
        for line in _split(_g(intake, key), r"[.;\n]", 4):
            c = _parse_character_line(line)
            if c and c["name"].lower() not in seen:
                seen.add(c["name"].lower())
                nodes.append(c)
            if len(nodes) >= 6:
                break
    rels: list[dict] = []
    if len(nodes) >= 2:
        lead = nodes[0]["name"]
        for other in nodes[1:]:
            rels.append({"source": lead, "target": other["name"], "label": "connected to"})
    return {"heading": "Relationship Map", "characters": nodes, "relationships": rels}


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
        syn = _g(intake, "synopsis")
        return {"heading": "Synopsis", "body": syn, "items": _three_acts(syn)}
    if slide_type == "relationship_map":
        return _relationship_fallback(intake)
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
        return {"heading": "Budget & Production Scale", "body": _g(intake, "budget")}
    if slide_type == "market_potential":
        pairs = (("Release Fit", _g(intake, "releaseFit")),
                 ("Distribution", _g(intake, "distribution")),
                 ("Why Now", _g(intake, "whyNow")))
        return {"heading": "Market Potential",
                "items": [{"title": t, "description": d} for t, d in pairs if d]}
    if slide_type == "directors_vision":
        return {"heading": "Director's Vision",
                "body": (_g(intake, "directorVision") or _g(intake, "directorStatement")
                         or _g(intake, "designDirection"))}
    if slide_type == "team":
        return {"heading": "Team & Production Status",
                "body": " · ".join(b for b in (_g(intake, "creativeTeam"),
                                               _g(intake, "productionStatus")) if b)}
    if slide_type == "contact":
        return {"heading": "Let's Talk", "subheading": _g(intake, "title"),
                "body": _g(intake, "pitchingTo") or _g(intake, "releaseFit")}
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
    "  • DEPTH: a pitch slide can carry a substantial, well-structured beat — do NOT strip the "
    "director's material down to a thin generic line. When the source gives you specifics (character "
    "stakes, the world's texture, the real hook, numbers), put them on the slide. Use as much of the "
    "provided content as the slide's job needs; under-using rich material reads as a WEAK deck, not "
    "a premium one.\n"
    "  • PURPOSE-DRIVEN: the slide's stated purpose tells you the job — a cover seduces, a "
    "logline hooks, characters make us care, market slides make the money case. Write to the "
    "job, in the deck's stated tone.\n"
    "  • HEADLINES: evocative and specific to this story, never labels with a colon, never "
    "generic ('A World Like No Other' is a failure; name the world).\n"
    "  • BODY: producer-readable — 2-4 sentences (more on the synopsis / story-world slides where "
    "the content warrants), active voice, no filler ('truly', 'compelling', 'takes us on a "
    "journey') or marketing froth. Carry the SPECIFIC hook and stakes from the material rather than "
    "compressing rich content into one generic line.\n"
    "  • BULLETS/ITEMS: parallel construction, each a distinct, concrete idea pulled from the "
    "material, 3-6 of them, every word earning its place.\n"
    "  • CHARACTERS: name — role — one line that makes a producer see the casting opportunity: "
    "their want, their wound, their contradiction — PLUS a short `appearance`: apparent age or "
    "age-range, build, and defining physical look, grounded in the script (infer sensibly from the "
    "role when unstated), so the deck casts and renders the RIGHT face. For the main characters "
    "slide, include ONLY the 3-4 PRIMARY leads (the people the story is about), most important "
    "first — never pad with minor or supporting roles.\n"
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
    "description}), characters (array of {name, role, description, appearance, wound}), comps "
    "(array of {title, note}) — for SHOW CROSS, each comp.title is a real comparable film/series "
    "the deck will show a poster for, so use exact, findable titles. For a GENRE-BLEND slide, items "
    "are the genres THIS film actually blends (from its genreBlend): title = the genre, description "
    "= ONE specific line on how THAT genre genuinely shows up in THIS story (distinct per genre, "
    "grounded in real events — NEVER the same line or the tone repeated across all three). "
    "moodBlocks (array of {label, "
    "color}) — for a VISUAL AESTHETIC slide, make these 4-6 REFERENCE FILMS whose cinematography, "
    "mood and tone match THIS film: set label to the EXACT, findable film title and color to a hex "
    "sampled from that film's palette; the deck shows each film's still as a visual reference. "
    "relationships (array of {source, target, label}). "
    "For a SYNOPSIS slide, ALSO return `items` as EXACTLY THREE acts so the slide renders as a "
    "3-act timeline: title = 'Act I · <2-3 word beat>' (then Act II, Act III), description = 2-3 "
    "sentences of that act's story drawn from the synopsis. "
    "For a RELATIONSHIP MAP slide, return `characters` (the 4-6 key people as nodes: name, role, "
    "one short line) AND `relationships`: each {source, target, label} where source and target are "
    "character NAMES from this story and label is the relationship in 1-3 words grounded in the "
    "dynamics (e.g. 'protects', 'hunts', 'mentors', 'betrays', 'awakens hope in') — never a generic "
    "'connected to'. "
    "For a MARKET-POTENTIAL slide, return `items` as 3-4 {title, description}: title = a SHORT "
    "market-angle label (e.g. 'Release Fit', 'Distribution', 'Why Now', 'Audience Size'), "
    "description = one concrete sentence making that commercial point for THIS film."
)


# The field each slide-type's template needs to render something. If the LLM omits it,
# we backfill from the deterministic fallback so no slide ever renders blank.
_PRIMARY_FIELDS: dict[str, list[str]] = {
    "cover": ["body"],
    "logline": ["body"],
    "genre_blend": ["items"],
    "synopsis": ["body", "items"],
    "story_world": ["body"],
    "character": ["characters"],
    "supporting_characters": ["characters"],
    "relationship_map": ["relationships"],
    "usp": ["bullets"],
    "show_cross": ["comps"],
    "visual_aesthetic": ["body", "moodBlocks"],
    "target_audience": ["items"],
    "budget": ["body"],
    "market_potential": ["items"],
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


# The extracted-summary fields each slide is BUILT FROM — its "placeholders". Generation slots
# THESE (and only these) into the per-slide prompt, so every slide stays on its own beat and
# grounded in the story, instead of drowning in the entire intake dump on every slide.
_SLIDE_FIELDS: dict[str, list[str]] = {
    "cover": ["title", "tagline", "logline", "genreBlend"],
    "logline": ["logline", "tone", "themes"],
    "genre_blend": ["genreBlend", "tone", "themes"],
    "synopsis": ["synopsis", "storyWorld", "themes"],
    "story_world": ["storyWorld", "visualMood", "keyScenes", "themes"],
    "character": ["mainCharacters", "characterDynamics"],
    "supporting_characters": ["supportingCharacters", "characterDynamics"],
    "relationship_map": ["mainCharacters", "characterDynamics", "supportingCharacters"],
    "usp": ["usp", "whyNow", "genreBlend"],
    "show_cross": ["showCross", "targetAudience"],
    "visual_aesthetic": ["visualAesthetic", "colorPalette", "textureStyle", "visualMood", "designDirection"],
    "target_audience": ["targetAudience", "releaseFit", "distribution"],
    "budget": ["budget", "productionStatus", "format"],
    "market_potential": ["releaseFit", "distribution", "whyNow", "targetAudience"],
    "directors_vision": ["directorVision", "directorStatement", "designDirection", "themes"],
    "team": ["creativeTeam", "productionStatus"],
    "contact": ["title", "pitchingTo"],
    "generic": ["logline", "synopsis"],
}

# A compact throughline carried on every slide (so the deck reads as one voice), unless the field
# is already this slide's primary material.
_THROUGHLINE = ["title", "logline", "tone"]


def compose_prompt(slide_type: str, title: str, purpose: str, intake: dict,
                   design: dict | None, instructions: str | None = None,
                   reference_slide: dict | None = None) -> str:
    """The exact user-prompt sent to the LLM for THIS slide — a focused brief that slots only the
    extracted-summary fields this slide is built from (its "placeholders") plus a short throughline,
    rather than dumping the whole intake on every slide. Shown verbatim in the workshop panel, so
    each slide's prompt reads as a clear, on-theme brief. ``reference_slide`` optionally supplies a
    matching slide from an uploaded reference deck to emulate."""
    design = design or {}
    lines: list[str] = [
        f'Write the "{title}" slide of this film pitch deck.',
        "",
        f"SLIDE TYPE: {slide_type.replace('_', ' ')}",
        f"PURPOSE: {purpose or '—'}",
    ]
    if design.get("cinematicTone"):
        lines.append(f"DECK TONE: {design['cinematicTone']}")
    visual_style = design.get("visualStyle")
    if isinstance(visual_style, list) and visual_style:
        lines.append("VISUAL STYLE: " + ", ".join(str(v) for v in visual_style[:4]))
    # Reference-derived copy density: when the director's references are minimal/image-led,
    # the writing must match (a text-heavy slide would break the promised visual language).
    profile = design.get("referenceProfile")
    if isinstance(profile, dict):
        text_per_slide = str((profile.get("layout") or {}).get("textPerSlide") or "").lower()
        if "very little" in text_per_slide:
            lines.append("COPY DENSITY (from the director's references): VERY SPARSE — a few "
                         "words to one short line per element; the imagery carries the slide.")
        elif "short" in text_per_slide:
            lines.append("COPY DENSITY (from the director's references): SHORT blocks — 1-2 "
                         "tight sentences per element, never a paragraph.")

    relevant = _SLIDE_FIELDS.get(slide_type, ["logline", "synopsis"])
    lines += ["", "THIS SLIDE IS BUILT FROM (use these exact details; do not pull in other slides' "
              "material):"]
    filled = False
    for key in relevant:
        val = _g(intake, key)
        if val:
            lines.append(f"- {_label(key)}: {val}")
            filled = True
    if not filled:
        lines.append("- (nothing specific captured yet — infer tightly from the throughline below; "
                     "never invent plot)")

    throughline = [f"- {_label(k)}: {_g(intake, k)}"
                   for k in _THROUGHLINE if _g(intake, k) and k not in relevant]
    if throughline:
        lines += ["", "STORY THROUGHLINE (keep one voice; do NOT restate these on this slide):"]
        lines += throughline

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


# Genre → three well-known comparable films (real titles, so TMDB posters attach). Used only when
# neither the intake nor the LLM supplied comparables, so the SHOW CROSS slide is never blank.
_COMP_BY_GENRE: list[tuple[tuple[str, ...], list[str]]] = [
    (("post-apocalyp", "dystop", "survival", "sci"), ["Children of Men", "The Road", "Snowpiercer"]),
    (("horror", "supernatural"), ["Hereditary", "The Witch", "It Follows"]),
    (("crime", "noir", "gangster"), ["No Country for Old Men", "Sicario", "Prisoners"]),
    (("thriller", "mystery", "suspense"), ["Prisoners", "Zodiac", "Wind River"]),
    (("action", "adventure"), ["Mad Max: Fury Road", "John Wick", "Sicario"]),
    (("fantasy", "myth"), ["Pan's Labyrinth", "The Green Knight", "Spirited Away"]),
    (("romance", "love"), ["Before Sunrise", "In the Mood for Love", "Call Me by Your Name"]),
    (("war",), ["1917", "Dunkirk", "Come and See"]),
    (("comedy",), ["Jojo Rabbit", "The Grand Budapest Hotel", "Little Miss Sunshine"]),
    (("drama", "family"), ["Manchester by the Sea", "Nomadland", "The Father"]),
]
_COMP_DEFAULT = ["Parasite", "Arrival", "Whiplash"]


def _fallback_comps(intake: dict, existing: list) -> list[dict]:
    """Guarantee three comparable films for the Show Cross slide, matched to the film's genre/tone
    when the material didn't name any. Real titles → TMDB can still fetch their posters."""
    seen = {str(c.get("title", "")).strip().lower() for c in existing if isinstance(c, dict)}
    hay = " ".join([_g(intake, "genreBlend"), _g(intake, "tone"), _g(intake, "themes"),
                    _g(intake, "logline")]).lower()
    titles = next((t for keys, t in _COMP_BY_GENRE if any(k in hay for k in keys)), _COMP_DEFAULT)
    note = "Tonal & thematic comparable — shared audience and positioning."
    out = list(existing)
    for t in titles:
        if len(out) >= 3:
            break
        if t.lower() not in seen:
            out.append({"title": t, "note": note})
            seen.add(t.lower())
    return out[:3]


def run(slide_type: str, title: str, purpose: str, intake: dict, design: dict | None,
        instructions: str | None = None, raw_prompt: str | None = None,
        reference_slide: dict | None = None, fresh: bool = False) -> dict:
    """``raw_prompt``: a director-edited prompt from the workshop — used VERBATIM as
    the user prompt (the system prompt stays), bypassing composition and cache.
    ``reference_slide``: the matching slide of an uploaded reference deck to emulate.
    ``fresh``: a "regenerate this slide" ask — bypass the cache and push the model to write a
    DISTINCTLY different take (new wording/structure), so regeneration yields something new."""
    fb = content_fallback(slide_type, intake, design)
    edited = bool(raw_prompt and raw_prompt.strip())
    prompt = raw_prompt.strip() if edited else compose_prompt(
        slide_type, title, purpose, intake, design, instructions, reference_slide
    )
    if fresh and not edited:
        prompt += ("\n\nFRESH TAKE: produce a NOTICEABLY DIFFERENT version — rework the wording, "
                   "structure, ordering and emphasis so it doesn't read like the previous one. "
                   "Stay true to the film, but make it feel new.")
    result = complete_json(
        system=_SYSTEM,
        prompt=prompt,
        fallback=lambda: fb,
        # A reference-grounded slide must not collide with the cached generic one.
        cache_prefix=f"content:ref:{slide_type}" if reference_slide else f"content:{slide_type}",
        # Director-touched prompts (and explicit "regenerate") must be fresh, never a cache hit.
        use_cache=not (edited or fresh or (instructions and instructions.strip())),
        # Higher temperature on a fresh regenerate so the wording actually varies.
        **({"temperature": 0.9} if fresh else {}),
    )
    if not isinstance(result, dict):
        result = fb
    # visual_aesthetic: each mood tile is a REFERENCE FILM — attach its real still (TMDB backdrop)
    # so the slide shows actual visual references, not solid colours. Tiles TMDB can't match are
    # filled with an original AI mood frame later in the image pipeline.
    if slide_type == "visual_aesthetic":
        if not result.get("moodBlocks"):
            result["moodBlocks"] = _mood_blocks(design)
        result["moodBlocks"] = attach_film_backdrops(result["moodBlocks"])
    result = _ensure_renderable(slide_type, result, fb)

    # Show Cross: guarantee 3 comparable films (so the slide is never blank), then attach real
    # posters (TMDB) when available.
    if slide_type == "show_cross":
        from app.ai import tmdb

        comps = [c for c in (result.get("comps") or []) if isinstance(c, dict) and c.get("title")]
        if len(comps) < 3:
            comps = _fallback_comps(intake, comps)
        result["comps"] = comps
        for comp in comps:
            if comp.get("title") and not comp.get("posterUrl"):
                poster = tmdb.poster_for(comp["title"])
                if poster:
                    comp["posterUrl"] = poster
    return result
