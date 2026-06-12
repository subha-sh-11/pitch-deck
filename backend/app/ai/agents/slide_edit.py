"""Slide-Edit agent — the action layer that makes the producer an AGENT, not a chatbot.

Given the director's natural-language instruction ("make the cover darker", "move the comps
slide up", "rewrite the logline punchier", "add a team slide", "regenerate the lead's portrait")
plus the current deck, this returns a short conversational `message` and a list of structured
`actions` the frontend applies to the live deck via its existing slide-mutation functions.

Contract mirrors the other agents: `run()` calls `llm.complete_json` with a deterministic
fallback, so a no-key / offline environment degrades gracefully instead of erroring.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.ai.llm import complete_json

# Action ops the frontend knows how to apply (→ editor mutation functions):
#   edit_slide       {slideId, title?, heading?, subheading?, body?, bullets?[]}  → onUpdateSlide
#   move_slide       {slideId, direction: "up"|"down", steps?}                    → onMoveSlide
#   add_slide        {afterSlideNumber, slideType}                               → onInsertAfter
#   delete_slide     {slideId}                                                    → onDeleteSlide
#   regenerate_slide {slideId}                                                    → onRegenerateSlide
_SYSTEM = """\
You are the deck editor for a cinematic film pitch deck. The director tells you, in plain language,
how to change the deck; you translate that into precise EDIT ACTIONS on the existing slides and a
short, in-character confirmation of what you did.

You are given the current slides (id, number, type, title, and a little content). Reason about which
slide(s) the instruction refers to — by name, type, position ("the cover", "slide 3", "the comps
slide", "the protagonist") — and emit ONLY the actions needed. Never invent slide ids; use the ids
you were given. Ground any new copy in the existing deck — don't invent unrelated plot.

ACTIONS (emit only what's needed, in order):
- edit_slide:       { "op": "edit_slide", "slideId": "<id>", "title": "<opt>", "heading": "<opt>",
                      "subheading": "<opt>", "body": "<opt>", "bullets": ["<opt>", ...] }
- move_slide:       { "op": "move_slide", "slideId": "<id>", "direction": "up"|"down", "steps": <int default 1> }
- add_slide:        { "op": "add_slide", "afterSlideNumber": <int>, "slideType": "<type>" }
- delete_slide:     { "op": "delete_slide", "slideId": "<id>" }
- regenerate_slide: { "op": "regenerate_slide", "slideId": "<id>" }   # re-draws that slide's imagery
- set_accent:       { "op": "set_accent", "hex": "#RRGGBB" }          # instant accent recolour of the WHOLE deck
- set_theme:        { "op": "set_theme", "palette": [ {"name": "Base", "hex": "#RRGGBB", "usage": "background"},
                      {"name": "Accent", "hex": "#RRGGBB", "usage": "accent"}, {"name": "Text", "hex": "#RRGGBB", "usage": "text"} ] }

slideType is one of: cover, logline, genre_blend, synopsis, story_world, character,
supporting_characters, usp, show_cross, visual_aesthetic, target_audience, budget, market_potential,
directors_vision, team, contact, generic.

Rules:
- Only include fields you are actually changing in edit_slide (omit the rest).
- For COLOUR / THEME / palette / mood changes ("make it blue", "warmer", "darker palette", "go bold
  red") use set_accent (a single accent colour) or set_theme (a full base/accent/text palette). These
  apply to the ENTIRE deck INSTANTLY with no regeneration — strongly prefer them for any colour ask.
  Always return real 6-digit hex values. Use regenerate_slide ONLY to redraw a slide's actual image.
- If the instruction is unclear or not about editing the deck, return actions: [] and ask, in the
  message, for the one clarification you need (keep it short).

OUTPUT — return ONLY this JSON object:
{ "message": "<one short, in-character line describing what you changed or what you need>",
  "actions": [ <zero or more action objects above> ] }
"""


def _slides_digest(slides: list[dict]) -> str:
    """Compact, id-anchored view of the deck for the model."""
    lines = []
    for s in slides or []:
        content = s.get("content") or {}
        heading = content.get("heading") or ""
        body = (content.get("body") or "")[:120]
        lines.append(
            f'  - id={s.get("id")} #{s.get("slideNumber")} type={s.get("slideType")} '
            f'title="{s.get("title", "")}" heading="{heading}" body="{body}"'
        )
    return "\n".join(lines) or "  (no slides yet)"


def _build_prompt(instruction: str, slides: list[dict]) -> str:
    return (
        "CURRENT DECK:\n"
        f"{_slides_digest(slides)}\n\n"
        f'DIRECTOR\'S INSTRUCTION:\n  "{instruction}"\n\n'
        "Translate the instruction into edit actions on the slides above and confirm what you did."
        " Return ONLY the JSON."
    )


def run(instruction: str, slides: list[dict]) -> dict:
    """Turn a natural-language instruction into {message, actions[]}."""
    return complete_json(
        system=_SYSTEM,
        prompt=_build_prompt(instruction, slides),
        cache_prefix="slide_edit",
        max_tokens=1200,
        temperature=0.3,
        use_cache=False,
        fallback=lambda: _fallback(instruction, slides),
    )


def _fallback(instruction: str, slides: list[dict]) -> dict:
    """Offline degradation: no model, so we can't parse intent — ask the user to use the editor."""
    return {
        "message": (
            "I can't reach the editing model right now — you can still tweak slides directly in the "
            "editor, and I'll pick up where we left off once it's back."
        ),
        "actions": [],
    }


# ── Validation: keep only well-formed actions referencing real slides ──

_VALID_OPS = {
    "edit_slide", "move_slide", "add_slide", "delete_slide", "regenerate_slide",
    "set_accent", "set_theme",
}
_EDITABLE = {"title", "heading", "subheading", "body", "bullets"}
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def sanitize(result: dict, slides: list[dict]) -> dict:
    """Drop malformed actions or ones referencing unknown slide ids, so the client only ever
    receives actions it can safely apply."""
    ids = {s.get("id") for s in (slides or [])}
    clean: list[dict[str, Any]] = []
    for a in (result or {}).get("actions", []) or []:
        if not isinstance(a, dict):
            continue
        op = a.get("op")
        if op not in _VALID_OPS:
            continue
        if op in {"edit_slide", "move_slide", "delete_slide", "regenerate_slide"}:
            if a.get("slideId") not in ids:
                continue
        if op == "edit_slide":
            patch = {k: v for k, v in a.items() if k in _EDITABLE and v not in (None, "")}
            if not patch:
                continue
            clean.append({"op": "edit_slide", "slideId": a["slideId"], **patch})
        elif op == "move_slide":
            direction = a.get("direction")
            if direction not in {"up", "down"}:
                continue
            steps = a.get("steps")
            clean.append({
                "op": "move_slide",
                "slideId": a["slideId"],
                "direction": direction,
                "steps": int(steps) if isinstance(steps, int) and steps > 0 else 1,
            })
        elif op == "add_slide":
            if not a.get("slideType"):
                continue
            clean.append({
                "op": "add_slide",
                "afterSlideNumber": int(a.get("afterSlideNumber") or len(slides or [])),
                "slideType": a["slideType"],
            })
        elif op == "set_accent":
            hex_ = a.get("hex")
            if not (isinstance(hex_, str) and _HEX.match(hex_)):
                continue
            clean.append({"op": "set_accent", "hex": hex_})
        elif op == "set_theme":
            palette = [
                {"name": c.get("name") or "", "hex": c.get("hex"), "usage": c.get("usage") or ""}
                for c in (a.get("palette") or [])
                if isinstance(c, dict) and isinstance(c.get("hex"), str) and _HEX.match(c["hex"])
            ]
            if not palette:
                continue
            clean.append({"op": "set_theme", "palette": palette})
        else:  # delete_slide / regenerate_slide
            clean.append({"op": op, "slideId": a["slideId"]})
    return {"message": (result or {}).get("message") or "Done.", "actions": clean}
