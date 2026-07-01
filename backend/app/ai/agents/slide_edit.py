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
                      "subheading": "<opt>", "body": "<opt>", "bullets": ["<opt>", ...],
                      "items": [ {"title": "<short>", "description": "<one line>"}, ... ] }
                      # Most LIST slides (genre blend, USP, market potential, target audience…)
                      # render the "items" array — NOT bullets. To change how many points show
                      # ("make it 5 points"), return the FULL new "items" list with that many
                      # entries (keep the existing ones and add/remove to reach the count).
- style_image:      { "op": "style_image", "slideId": "<id>", "blur": <0-16 px>, "dim": <0-0.85>,
                      "scale": <1.0-1.8> }
                      # Adjust the slide's existing background image WITHOUT regenerating it:
                      # blur (soften/blur the background), dim (darken for text legibility),
                      # scale (zoom in). Use this for "blur the image", "darken the background",
                      # "zoom the image" — never regenerate_slide for those.
- move_slide:       { "op": "move_slide", "slideId": "<id>", "direction": "up"|"down", "steps": <int default 1> }
- add_slide:        { "op": "add_slide", "afterSlideNumber": <int>, "slideType": "<type>" }
- delete_slide:     { "op": "delete_slide", "slideId": "<id>" }
- regenerate_slide: { "op": "regenerate_slide", "slideId": "<id>", "instruction": "<opt: what to change in the IMAGE>",
                      "useReference": <true|false> }
                      # re-draws that slide's imagery. Put the visual change in "instruction"
                      # ("add period-accurate guns and roses, photoreal realistic", "wider shot,
                      # more fire", "in a gritty noir style"). Set "useReference": true ONLY when an
                      # image is attached AND the director wants the slide to LOOK LIKE / MATCH /
                      # be in the STYLE of that image — then the attached image is used directly as
                      # an image-to-image reference (true style transfer). Otherwise omit it/false.
- set_accent:       { "op": "set_accent", "hex": "#RRGGBB" }          # instant accent recolour of the WHOLE deck
- set_theme:        { "op": "set_theme", "palette": [ {"name": "Base", "hex": "#RRGGBB", "usage": "background"},
                      {"name": "Accent", "hex": "#RRGGBB", "usage": "accent"}, {"name": "Text", "hex": "#RRGGBB", "usage": "text"} ] }

slideType is one of: cover, logline, genre_blend, synopsis, story_world, character,
supporting_characters, usp, show_cross, visual_aesthetic, target_audience, budget, market_potential,
directors_vision, team, contact, generic.

Rules:
- TRUTHFUL CONFIRMATION: your `message` must describe ONLY the actions you actually put in the
  `actions` array — never claim a change you didn't emit. If you change the points, the message
  says you changed the points; if you only blurred the image, say only that. If `actions` is empty,
  do NOT claim success — say what you couldn't do and why (or ask the one clarification you need).
  Count must match: if asked for "5 points" and you emit an items list, it must have exactly 5.
- ACT, don't interrogate. Resolve the target slide yourself: "slide 2"/"the second slide" → slideNumber 2;
  "this slide"/"the slide in the image"/"the one shown" → the slide the director is pointing at (if
  ambiguous, pick the most likely single slide and act). NEVER reply with only a clarifying question
  when the slide is identifiable — emit the action.
- Only include fields you are actually changing in edit_slide (omit the rest).
- IMAGE / picture changes ("add guns and roses", "make it realistic", "put a temple in the back",
  "wider shot", "more fire", "redraw in X style") → regenerate_slide WITH an "instruction".
  CRITICAL: the "instruction" is the ONLY thing the image model sees about the change — it cannot
  see the chat or any attached image. So write it CONCRETE, LITERAL and SELF-CONTAINED:
    • Name the actual objects to depict, with placement — e.g. "add guns and roses" →
      "a realistic antique revolver and a bunch of deep-red roses resting together on a weathered
      wooden surface in the foreground, sharp focus, photoreal".
    • Never pass vague text like "add guns and roses", "make it like the image", or "match the
      style" verbatim — EXPAND it.
    • If a REFERENCE IMAGE is attached and the ask is "make this slide like the image / match this
      style", DESCRIBE WHAT YOU SEE in that image as the instruction: the subjects, the art medium
      (e.g. hand-painted poster collage, photoreal film still, 3D render), the dominant colours, the
      composition/layout and the mood — enough that the image model can recreate that look blind.
- For COLOUR / THEME / palette / mood changes ("make it blue", "warmer", "darker palette", "go bold
  red") use set_accent (a single accent colour) or set_theme (a full base/accent/text palette). These
  apply to the ENTIRE deck INSTANTLY with no regeneration — strongly prefer them for any colour ask.
  Always return real 6-digit hex values.
- FONT / typography swaps for a single slide aren't supported yet — if asked, briefly say so in the
  message, and still apply every other part of the request (e.g. the image change). Don't loop on it.
- Only ask for clarification (actions: []) if the request truly isn't about editing the deck at all.

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


def _build_prompt(instruction: str, slides: list[dict], has_images: bool = False) -> str:
    image_note = (
        "\nAN IMAGE IS ATTACHED. It is most likely a SCREENSHOT of one of the slides above — "
        "read the visible heading/body text in it and MATCH it to the slide in the deck with the "
        "same text; that matched slide is the target of 'this slide'. (If instead it's a style "
        "reference, fold its look into the regenerate_slide instruction.) Target exactly ONE slide.\n"
        if has_images else ""
    )
    return (
        "CURRENT DECK:\n"
        f"{_slides_digest(slides)}\n"
        f"{image_note}\n"
        f'DIRECTOR\'S INSTRUCTION:\n  "{instruction}"\n\n'
        "Translate the instruction into edit actions on the slides above and confirm what you did."
        " Return ONLY the JSON."
    )


def run(instruction: str, slides: list[dict], images: list[dict] | None = None) -> dict:
    """Turn a natural-language instruction into {message, actions[]}.

    ``images`` (optional): reference images shared this turn — a screenshot of a slide (to
    identify the target) or a style reference. Passed to the vision model.
    """
    imgs = images or None
    return complete_json(
        system=_SYSTEM,
        prompt=_build_prompt(instruction, slides, has_images=bool(imgs)),
        images=imgs,
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
    "set_accent", "set_theme", "style_image",
}
_EDITABLE = {"title", "heading", "subheading", "body", "bullets", "items"}
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _clean_items(raw) -> list[dict] | None:
    """Normalise an `items` list ([{title, description}] or [str]) for list-style slides."""
    if not isinstance(raw, list) or not raw:
        return None
    out: list[dict] = []
    for it in raw:
        if isinstance(it, dict) and (str(it.get("title") or "").strip() or str(it.get("description") or "").strip()):
            out.append({"title": str(it.get("title") or "").strip(),
                        "description": str(it.get("description") or "").strip()})
        elif isinstance(it, str) and it.strip():
            out.append({"title": it.strip(), "description": ""})
    return out or None


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
        if op in {"edit_slide", "move_slide", "delete_slide", "regenerate_slide", "style_image"}:
            if a.get("slideId") not in ids:
                continue
        if op == "edit_slide":
            patch = {k: v for k, v in a.items()
                     if k in _EDITABLE and k not in ("items",) and v not in (None, "", [])}
            items = _clean_items(a.get("items"))
            if items is not None:
                patch["items"] = items
            if not patch:
                continue
            clean.append({"op": "edit_slide", "slideId": a["slideId"], **patch})
        elif op == "style_image":
            sty = {}
            blur, dim, scale = a.get("blur"), a.get("dim"), a.get("scale")
            if isinstance(blur, (int, float)):
                sty["imageBlur"] = max(0.0, min(16.0, float(blur)))
            if isinstance(dim, (int, float)):
                sty["imageDim"] = max(0.0, min(0.85, float(dim)))
            if isinstance(scale, (int, float)):
                sty["imageScale"] = max(1.0, min(1.8, float(scale)))
            if not sty:
                continue
            clean.append({"op": "style_image", "slideId": a["slideId"], **sty})
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
        elif op == "regenerate_slide":
            action = {"op": op, "slideId": a["slideId"]}
            instr = a.get("instruction")
            if isinstance(instr, str) and instr.strip():
                action["instruction"] = instr.strip()
            if a.get("useReference") is True:
                action["useReference"] = True
            clean.append(action)
        else:  # delete_slide
            clean.append({"op": op, "slideId": a["slideId"]})
    return {"message": (result or {}).get("message") or "Done.", "actions": clean}
