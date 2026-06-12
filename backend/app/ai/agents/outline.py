"""Outline agent → an ordered, brief-aware slide outline.

Replaces the fixed template outline with one shaped by the actual brief:
- honours the director's requested deck length (intake `deckLength`),
- drops optional slides the intake gives no grounding for,
- adds grounded extra slides (as `generic`) when the director asked for a longer deck,
- keeps the producer-logic ordering (cover → hook → story → look → market → close).

Contract mirrors the other agents: `run()` calls `llm.complete_json` with a deterministic
fallback, so a no-key environment still produces a sensible outline.
"""
from __future__ import annotations

import json
import re

from app.ai.llm import complete_json
from app.ai.templates import CANONICAL_OUTLINE, build_outline

# Slide types the frontend can render (canonical set + the generic template).
_ALLOWED_TYPES = {item["slide_type"] for item in CANONICAL_OUTLINE} | {"generic"}

_MIN_SLIDES, _MAX_SLIDES = 6, 20

# Optional slide types and the intake fields that justify including them.
_GROUNDING: dict[str, tuple[str, ...]] = {
    "supporting_characters": ("mainCharacters", "characterDynamics"),
    "team": ("creativeTeam", "productionStatus"),
    "budget": ("budget",),
    "market_potential": ("releaseFit", "distribution", "targetAudience"),
    "show_cross": ("showCross",),
    "directors_vision": ("directorStatement", "designDirection", "synopsis"),
    "why_now": ("whyNow",),
}

# Extra slides (rendered with the generic template) we can add for longer decks,
# ONLY when the intake actually has material for them.
_EXTRA_CANDIDATES: list[dict] = [
    {"slide_type": "generic", "title": "Key Scenes",
     "purpose": "Showcase the signature moments that sell the film.", "fields": ("keyScenes",)},
    {"slide_type": "generic", "title": "Why Now",
     "purpose": "Make the case for this story in this cultural moment.", "fields": ("whyNow",)},
    {"slide_type": "generic", "title": "Distribution & Release",
     "purpose": "Lay out the release path and marketing logic.", "fields": ("distribution",)},
    {"slide_type": "generic", "title": "Director's Statement",
     "purpose": "The filmmaker's voice, in their own words.", "fields": ("directorStatement",)},
    {"slide_type": "generic", "title": "Themes",
     "purpose": "The ideas the story explores beneath the plot.", "fields": ("themes",)},
    {"slide_type": "generic", "title": "Mood Board",
     "purpose": "The visual references anchoring the film's look.",
     "fields": ("moodBoard", "visualReferences")},
    {"slide_type": "generic", "title": "Character Dynamics",
     "purpose": "The relationships that carry the story's emotional spine.",
     "fields": ("characterDynamics",)},
    {"slide_type": "generic", "title": "The Ask",
     "purpose": "What the production needs from this room, plainly.",
     "fields": ("budget", "pitchingTo")},
]


def _has(intake: dict, fields: tuple[str, ...]) -> bool:
    return any(isinstance((intake or {}).get(f), str) and (intake or {}).get(f, "").strip()
               for f in fields)


def parse_target(deck_length: str | None, default: int) -> int:
    """'17' → 17 · 'standard 10-15' → 15 · 'lean 8-10 slides' → 10 · junk → default."""
    if not deck_length or not str(deck_length).strip():
        return max(_MIN_SLIDES, min(_MAX_SLIDES, default))
    nums = [int(n) for n in re.findall(r"\d+", str(deck_length))]
    target = max(nums) if nums else default
    return max(_MIN_SLIDES, min(_MAX_SLIDES, target))


_SYSTEM = (
    "You are a pitch-deck architect for film and series — the person who decides which slides "
    "a deck needs and in what order, the way a story editor decides scene order. You are given: "
    "the canonical slide menu (each with its job), optional extra slides with the intake fields "
    "that justify them, the project's intake (with a per-field availability map), and a TARGET "
    "slide count the director explicitly asked for.\n"
    "Rules:\n"
    "  • HIT THE TARGET COUNT EXACTLY — the director chose it.\n"
    "  • ORDER tells the pitch story: cover first, the hook (logline) immediately after, then "
    "story (genre/synopsis/world/characters), then the look, then market/business, then vision "
    "and close. 'contact' is always last when present.\n"
    "  • NEVER include a slide whose grounding fields are empty (an empty team slide reads as "
    "an unprepared director). Prefer dropping ungrounded optional slides; prefer adding the "
    "extra slides (slideType 'generic') that DO have material when the target is long.\n"
    "  • TAILOR titles to this story where it strengthens the deck ('The World of Amara' beats "
    "'Story World'), and write each slide's purpose as one concrete line for the copywriter "
    "who will write that slide.\n"
    "  • Each slide type may appear once (generic may repeat with different titles).\n"
    "Return ONLY JSON: {\"slides\": [{\"slideType\": \"...\", \"title\": \"...\", "
    "\"purpose\": \"...\"}]} using ONLY the provided slide types."
)


def _fallback(template_id: str | None, intake: dict, target: int) -> list[dict]:
    """Deterministic outline: template base → drop ungrounded optional → fit to target."""
    base = build_outline(template_id)

    # 1. Drop optional slides with no grounding (boilerplate slides scream "auto-generated").
    kept = []
    for item in base:
        fields = _GROUNDING.get(item["slide_type"])
        if fields and not item.get("required", False) and not _has(intake, fields):
            continue
        kept.append(item)

    # 2. Too long → drop non-required from the end, then trim (never cover/logline/contact).
    protected = {"cover", "logline", "contact"}
    while len(kept) > target:
        droppable = [i for i in range(len(kept) - 1, -1, -1)
                     if not kept[i].get("required", False)
                     and kept[i]["slide_type"] not in protected]
        if droppable:
            kept.pop(droppable[0])
            continue
        trimmable = [i for i in range(len(kept) - 1, -1, -1)
                     if kept[i]["slide_type"] not in protected]
        if not trimmable:
            break
        kept.pop(trimmable[0])

    # 3. Too short → append grounded extras (before the contact slide).
    if len(kept) < target:
        insert_at = len(kept) - 1 if kept and kept[-1]["slide_type"] == "contact" else len(kept)
        for cand in _EXTRA_CANDIDATES:
            if len(kept) >= target:
                break
            if _has(intake, cand["fields"]):
                kept.insert(insert_at, {"slide_type": cand["slide_type"],
                                        "title": cand["title"],
                                        "purpose": cand["purpose"], "required": False})
                insert_at += 1

    return [{**item, "slide_number": n + 1} for n, item in enumerate(kept)]


def _sanitize(result: dict, fallback: list[dict], target: int) -> list[dict]:
    """Validate the LLM outline; on anything structurally off, trust the fallback."""
    slides = result.get("slides") if isinstance(result, dict) else None
    if not isinstance(slides, list):
        return fallback
    canonical = {item["slide_type"]: item for item in CANONICAL_OUTLINE}
    out: list[dict] = []
    seen: set[str] = set()
    for raw in slides:
        if not isinstance(raw, dict):
            continue
        stype = str(raw.get("slideType") or raw.get("slide_type") or "").strip()
        if stype not in _ALLOWED_TYPES:
            continue
        if stype != "generic" and stype in seen:
            continue
        seen.add(stype)
        base = canonical.get(stype, {})
        title = str(raw.get("title") or base.get("title") or "Slide").strip()[:80]
        purpose = str(raw.get("purpose") or base.get("purpose") or "").strip()[:240]
        out.append({"slide_type": stype, "title": title, "purpose": purpose,
                    "required": bool(base.get("required", False))})
    # Structural guarantees: cover opens, contact (if present) closes, sane length.
    if not out or out[0]["slide_type"] != "cover":
        cover = next((s for s in out if s["slide_type"] == "cover"), None)
        if cover:
            out.remove(cover)
            out.insert(0, cover)
        else:
            out.insert(0, {**canonical["cover"], "required": True})
    contacts = [s for s in out if s["slide_type"] == "contact"]
    if contacts and out[-1]["slide_type"] != "contact":
        out = [s for s in out if s["slide_type"] != "contact"] + [contacts[0]]
    # The director chose the count — accept at most ±1 from the LLM, and only keep its
    # version when it lands at least as close to the target as the deterministic outline.
    if not (_MIN_SLIDES <= len(out) <= _MAX_SLIDES):
        return fallback
    if abs(len(out) - target) > 1 or abs(len(out) - target) > abs(len(fallback) - target):
        return fallback
    return [{**item, "slide_number": n + 1} for n, item in enumerate(out)]


def run(project: dict, intake: dict, template_id: str | None = None) -> list[dict]:
    """Return the ordered outline: [{slide_type, title, purpose, required, slide_number}]."""
    intake = intake or {}
    base = build_outline(template_id)
    target = parse_target(intake.get("deckLength"), len(base))
    fb = _fallback(template_id, intake, target)

    availability = {}
    for item in CANONICAL_OUTLINE:
        fields = _GROUNDING.get(item["slide_type"])
        availability[item["slide_type"]] = (_has(intake, fields) if fields else True)
    payload = {
        "targetSlideCount": target,
        "project": {k: project.get(k) for k in ("title", "genres", "tone", "pitchPurpose")},
        "canonicalSlides": [{"slideType": i["slide_type"], "title": i["title"],
                             "purpose": i["purpose"], "required": i.get("required", False),
                             "hasMaterial": availability[i["slide_type"]]}
                            for i in CANONICAL_OUTLINE],
        "extraSlides": [{"slideType": c["slide_type"], "title": c["title"],
                         "purpose": c["purpose"], "hasMaterial": _has(intake, c["fields"])}
                        for c in _EXTRA_CANDIDATES],
        "intake": {k: v for k, v in intake.items() if isinstance(v, str) and v.strip()},
    }
    result = complete_json(
        system=_SYSTEM,
        prompt="Architect this deck:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=lambda: {"slides": None},  # sanitizer falls back to the deterministic outline
        cache_prefix="outline",
        max_tokens=2000,
        temperature=0.4,
    )
    return _sanitize(result if isinstance(result, dict) else {}, fb, target)
