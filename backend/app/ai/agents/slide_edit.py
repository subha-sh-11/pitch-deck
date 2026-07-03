"""Slide-Edit agent — the action layer that makes the producer an AGENT, not a chatbot.

Given the director's natural-language instruction ("make the cover darker", "move the comps
slide up", "rewrite the logline punchier", "add a team slide", "regenerate the lead's portrait")
plus the current deck, this returns a short conversational `message` and a list of structured
`actions` the frontend applies to the live deck via its existing slide-mutation functions.

Actions are emitted via NATIVE tool calling (`llm.complete_tools`): each edit op is a tool with
a JSON schema, so the model produces validated calls instead of a free-form JSON blob — far
better adherence, and the confirmation message can be checked against the calls that actually
survived validation (no more "Done!" for changes that never applied).

Contract mirrors the other agents: a deterministic fallback means a no-key / offline
environment degrades gracefully instead of erroring.
"""
from __future__ import annotations

import re
from typing import Any

from app.ai.llm import complete_tools

# Action ops the frontend knows how to apply (→ editor mutation functions):
#   edit_slide       {slideId, title?, heading?, subheading?, body?, bullets?[]}  → onUpdateSlide
#   move_slide       {slideId, direction: "up"|"down", steps?}                    → onMoveSlide
#   add_slide        {afterSlideNumber, slideType}                               → onInsertAfter
#   delete_slide     {slideId}                                                    → onDeleteSlide
#   regenerate_slide {slideId}                                                    → onRegenerateSlide
#   generate_image   {slideId, imagePrompt?}                                      → onGenerateImage
#   set_appearance   {slideId, styleVariant?, accentColor?, backgroundKey?}       → onSetAppearance
#   set_accent       {hex}                                                        → onSetAccent (deck-wide)
#   set_theme        {palette[]}                                                  → onSetTheme  (deck-wide)
#   set_font         {font}                                                       → onSetFont   (deck-wide)
# Each op is exposed to the model as a NATIVE TOOL (schemas in _TOOLS below).
_SYSTEM = """\
You are the deck editor for a cinematic film pitch deck. The director tells you, in plain language,
how to change the deck; you carry it out by CALLING THE EDIT TOOLS on the existing slides, and you
write ONE short, in-character line describing what you did.

You are given the current slides (id, number, type, title, and a little content). Reason about which
slide(s) the instruction refers to — by name, type, position ("the cover", "slide 3", "the comps
slide", "the protagonist") — and call ONLY the tools needed. Never invent slide ids; use the ids
you were given. Ground any new copy in the existing deck — don't invent unrelated plot.

CONVERSATION CONTINUITY — you are mid-conversation, not answering in isolation:
- You are given the RECENT CONVERSATION. Read it before deciding anything. If YOUR previous message
  asked the director a question (e.g. "which slide?"), their next message is the ANSWER to it —
  resolve it in that context and carry out the ORIGINAL request. Example: you asked "which slide
  should get the images?" and they reply "9th" → that means "add the images to slide 9", NOT "move a
  slide to position 9".
- A bare number or ordinal on its own ("6", "9th", "the 4th") is ALWAYS a reference to that slide
  number — almost always the answer to your previous question. It is NEVER, by itself, a move or
  reorder command. Only treat something as a move when the director uses explicit move/reorder
  language ("move … up/down", "put … after …", "make … slide 9").
- Never re-ask something already answered earlier in the conversation. If the conversation now gives
  you enough to act, ACT — do not loop back to "which slide?".

IMAGERY — putting pictures on slides (DO IT, don't suggest it):
- When the director asks for an image ("put an image on this slide", "add character art", "give me a
  visual", "make a relevant image"), CALL generate_image — never reply "you can add one in
  the editor". You are an agent; perform the action.
- generate_image redraws ONE slide's image per call. If no imagePrompt is given, leave it out and
  the system composes a real prompt from the slide + script + design. Only set imagePrompt when the
  director described what they want to see; ground it in the actual story.
- For "images for the 6 characters", you cannot render several separate portraits inside one slide —
  instead call generate_image for the main-character slide AND for the supporting-characters
  slide (and say so). Never claim you produced images you didn't.
- GENRE-BLEND is the exception: a generate_image on the genre_blend slide automatically renders ONE
  image PER genre tile. So you CAN give each genre (comedy, crime, drama, …) its own image — emit a
  SINGLE generate_image for the genre_blend slide and truthfully say each genre got its own visual.

ACTIONS (emit only what's needed, in order):
- edit_slide:       { "op": "edit_slide", "slideId": "<id>", "title": "<opt>", "heading": "<opt>",
                      "subheading": "<opt>", "body": "<opt>", "bullets": ["<opt>", ...] }
- move_slide:       { "op": "move_slide", "slideId": "<id>", "direction": "up"|"down", "steps": <int default 1> }
- add_slide:        { "op": "add_slide", "afterSlideNumber": <int>, "slideType": "<type>" }
- delete_slide:     { "op": "delete_slide", "slideId": "<id>" }
- regenerate_slide: { "op": "regenerate_slide", "slideId": "<id>" }   # rewrite copy + imagery for the slide
- generate_image:   { "op": "generate_image", "slideId": "<id>", "imagePrompt": "<optional>" }  # draw/replace just the image
- set_appearance:   { "op": "set_appearance", "slideId": "<id>", "styleVariant": "cinematic"|"minimal"|"bold",
                      "accentColor": "#RRGGBB", "textColor": "#RRGGBB",
                      "backgroundKey": "default"|"warm-portrait"|"concrete"|"water"|"dark-gradient",
                      "composition": "full"|"split"|"framed", "imageSide": "left"|"right" }
                      # per-slide layout / look — include only the keys you're changing.
                      # textColor = the TEXT colour on JUST this slide (wins over the deck theme)
                      # composition = how the image sits vs the text (see COMPOSITION rule)
- set_accent:       { "op": "set_accent", "hex": "#RRGGBB" }          # instant accent recolour of the WHOLE deck
- set_theme:        { "op": "set_theme", "palette": [ {"name": "Base", "hex": "#RRGGBB", "usage": "background"},
                      {"name": "Accent", "hex": "#RRGGBB", "usage": "accent"}, {"name": "Text", "hex": "#RRGGBB", "usage": "text"} ] }
- set_font:         { "op": "set_font", "font": "cormorant"|"playfair"|"oswald"|"poppins"|"anton" }  # deck-wide display font
- style_image:      { "op": "style_image", "slideId": "<id>", "blur": <0-16 px>, "dim": <0-0.85>, "scale": <1.0-1.8> }
                      # adjust the EXISTING background image without regenerating: blur it, dim/darken
                      # it (for text legibility), or zoom in. Use for "blur the image", "darken the
                      # background", "zoom in" — never generate_image for those.

edit_slide also takes an "items" array — LIST slides (genre blend, USP, market potential, target
audience…) render "items": [ {"title": "<short>", "description": "<one line>"} ], NOT bullets. To
change how many points show ("make it 5 points"), return the FULL new "items" list with exactly that
many entries. Your confirmation message must never claim a change you didn't emit as an action.

slideType is one of: cover, logline, genre_blend, synopsis, story_world, character,
supporting_characters, usp, show_cross, visual_aesthetic, target_audience, budget, market_potential,
directors_vision, team, contact, generic.

Rules:
- Only include fields you are actually changing in edit_slide (omit the rest).
- IMAGE asks → generate_image (image only). COPY/text rewrites → edit_slide. "Regenerate the whole
  slide" → regenerate_slide (redoes copy AND image).
- LAYOUT / per-slide look ("make this slide minimal", "bolder layout", "different background here",
  "change the layout of slide 4") → set_appearance on that slide. For the WHOLE deck's colour
  ("make it blue", "warmer", "go bold red") use set_accent or set_theme — they apply instantly with
  no regeneration. Always return real 6-digit hex values.
- TEXT colour on a SINGLE slide ("the text isn't visible here", "make the text white on this slide",
  "this slide's text should be darker") → set_appearance on that slide with textColor. This is the
  fix when text is hard to read over a slide's image/background — it overrides the deck theme for
  that slide ONLY. Use the currently selected slide if they don't name one. (To recolour text across
  the WHOLE deck instead, use set_theme with a new "text" palette entry.)
- BACKGROUND or whole THEME of the deck ("background is black, make it white", "light theme",
  "light background", "dark theme", "cream/warm theme") → set_theme with a full palette: the new
  BASE as usage "background", a CONTRASTING text colour as usage "text" (dark text on a light bg,
  light text on a dark bg), and keep/choose a sensible accent. E.g. light theme → palette
  [base #F7F5F0 "background", accent <warm/sensible> "accent", text #1A1A1F "text"]. Don't use
  set_accent for a background/theme ask (accent ≠ background).
- After a theme change, newly GENERATED images automatically follow it (a light theme yields bright
  images, dark yields cinematic). Existing images don't change retroactively — so when you switch to
  a light theme, mention they can regenerate a slide's image (generate_image) to get matching bright
  artwork.
- DEFAULT TARGET: if the director doesn't name a slide ("add an image", "make this minimal"), act on
  the CURRENTLY SELECTED SLIDE shown below. Only ask which slide if there is no selected slide AND the
  reference is genuinely ambiguous.
- "Apply to every slide / the whole deck" (layout or look) → one tool call per slide in the deck
  (for colour, prefer a single set_accent / set_theme).
- FONT changes ("change the font", "use a serif", "make it Times", "bolder type") → set_font. Only
  these display fonts are available; map the request to the NEAREST one:
    serif / classic / elegant / "Times" / "Garamond"  → "cormorant" (or "playfair")
    bold / poster / impact / heavy / condensed         → "anton" (or "oswald")
    clean / modern / sans / minimal                    → "poppins"
  Say which font you applied (and that it's the closest available match if they named a specific one).
- Be an agent: when the instruction is a clear edit, DO IT (call the tool) and confirm.

NEVER FABRICATE — this is critical:
- Only claim you changed something if you made a matching tool call for it. Do NOT say "Changed the
  font / colour / image" unless you actually called set_font / set_accent / generate_image, etc.
- If you genuinely cannot do what's asked (no matching tool exists), say so plainly and call NO
  tool — never report a success you didn't perform.
- Call no tools and ask ONE short clarification only when the instruction is genuinely unclear
  or not about editing the deck.

OUTPUT: make the tool calls for the edits, and ALWAYS also write one short, in-character line of
plain text describing what you changed (or what you need). Text only — no JSON, no markdown.
"""


# ── Native tool schemas (translated per provider by llm.complete_tools) ──

_SLIDE_TYPES = [
    "cover", "logline", "genre_blend", "synopsis", "story_world", "character",
    "supporting_characters", "usp", "show_cross", "visual_aesthetic", "target_audience",
    "budget", "market_potential", "directors_vision", "team", "contact", "generic",
]

_HEX_DESC = "6-digit hex colour like #C9A227"

_TOOLS: list[dict] = [
    {
        "name": "edit_slide",
        "description": "Rewrite copy on one slide. Include ONLY the fields you are changing.",
        "parameters": {
            "type": "object",
            "properties": {
                "slideId": {"type": "string", "description": "id of an existing slide (from CURRENT DECK)"},
                "title": {"type": "string"},
                "heading": {"type": "string"},
                "subheading": {"type": "string"},
                "body": {"type": "string"},
                "bullets": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["slideId"],
        },
    },
    {
        "name": "move_slide",
        "description": "Move a slide up or down in the deck order.",
        "parameters": {
            "type": "object",
            "properties": {
                "slideId": {"type": "string"},
                "direction": {"type": "string", "enum": ["up", "down"]},
                "steps": {"type": "integer", "minimum": 1, "description": "positions to move (default 1)"},
            },
            "required": ["slideId", "direction"],
        },
    },
    {
        "name": "add_slide",
        "description": "Insert a new slide after the given slide number.",
        "parameters": {
            "type": "object",
            "properties": {
                "afterSlideNumber": {"type": "integer"},
                "slideType": {"type": "string", "enum": _SLIDE_TYPES},
            },
            "required": ["afterSlideNumber", "slideType"],
        },
    },
    {
        "name": "delete_slide",
        "description": "Remove a slide from the deck.",
        "parameters": {
            "type": "object",
            "properties": {"slideId": {"type": "string"}},
            "required": ["slideId"],
        },
    },
    {
        "name": "regenerate_slide",
        "description": "Regenerate the WHOLE slide — rewrites its copy AND its imagery.",
        "parameters": {
            "type": "object",
            "properties": {"slideId": {"type": "string"}},
            "required": ["slideId"],
        },
    },
    {
        "name": "generate_image",
        "description": ("Draw or replace JUST the image on one slide. Omit imagePrompt to let the "
                        "system compose one from the slide + script + design; set it only when the "
                        "director described what they want to see."),
        "parameters": {
            "type": "object",
            "properties": {
                "slideId": {"type": "string"},
                "imagePrompt": {"type": "string"},
            },
            "required": ["slideId"],
        },
    },
    {
        "name": "set_appearance",
        "description": ("Per-slide layout / look. Include only the keys you're changing. "
                        "textColor overrides the deck theme on JUST this slide."),
        "parameters": {
            "type": "object",
            "properties": {
                "slideId": {"type": "string"},
                "styleVariant": {"type": "string", "enum": ["cinematic", "minimal", "bold"]},
                "accentColor": {"type": "string", "description": _HEX_DESC},
                "textColor": {"type": "string", "description": _HEX_DESC},
                "backgroundKey": {"type": "string",
                                  "enum": ["default", "warm-portrait", "concrete", "water", "dark-gradient"]},
                "composition": {"type": "string", "enum": ["full", "split", "framed"]},
                "imageSide": {"type": "string", "enum": ["left", "right"]},
            },
            "required": ["slideId"],
        },
    },
    {
        "name": "set_accent",
        "description": "Instant accent recolour of the WHOLE deck (no regeneration).",
        "parameters": {
            "type": "object",
            "properties": {"hex": {"type": "string", "description": _HEX_DESC}},
            "required": ["hex"],
        },
    },
    {
        "name": "set_theme",
        "description": ("Set the WHOLE deck's colour theme. Provide a full palette: a base colour "
                        "with usage 'background', a CONTRASTING colour with usage 'text', and a "
                        "sensible 'accent'."),
        "parameters": {
            "type": "object",
            "properties": {
                "palette": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "hex": {"type": "string", "description": _HEX_DESC},
                            "usage": {"type": "string", "enum": ["background", "accent", "text"]},
                        },
                        "required": ["hex", "usage"],
                    },
                },
            },
            "required": ["palette"],
        },
    },
    {
        "name": "set_font",
        "description": ("Deck-wide display font. Only these five are loaded: cormorant, playfair, "
                        "oswald, poppins, anton — map any request to the nearest one."),
        "parameters": {
            "type": "object",
            "properties": {
                "font": {"type": "string",
                         "description": "one of: cormorant | playfair | oswald | poppins | anton"},
            },
            "required": ["font"],
        },
    },
]


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


def _history_digest(history: list[dict] | None) -> str:
    """Recent conversation so the agent can resolve follow-ups ("9th", "that slide")."""
    lines = []
    for t in (history or [])[-8:]:
        who = "director" if t.get("role") == "user" else "you"
        text = (t.get("text") or "").strip()
        if text:
            lines.append(f"  {who}: {text}")
    return "\n".join(lines) or "  (start of conversation)"


def _selected_digest(slides: list[dict], selected_slide_id: str | None) -> str:
    """The slide the director currently has open — the default target for unaddressed edits."""
    if not selected_slide_id:
        return "  (none — ask which slide only if the instruction is ambiguous)"
    for s in slides or []:
        if s.get("id") == selected_slide_id:
            return (
                f'  id={s.get("id")} #{s.get("slideNumber")} type={s.get("slideType")} '
                f'title="{s.get("title", "")}"'
            )
    return "  (none — ask which slide only if the instruction is ambiguous)"


def _build_prompt(instruction: str, slides: list[dict], history: list[dict] | None = None,
                  selected_slide_id: str | None = None, image_names: list[str] | None = None) -> str:
    images_note = ""
    if image_names:
        images_note = (
            "REFERENCE IMAGES ATTACHED TO THIS TURN: " + ", ".join(image_names) + " — the director "
            "shared these as visual direction. Analyse the palette, light and mood you actually see, "
            "and adapt the deck to them: set_theme / set_accent for colour, or generate_image with an "
            "imagePrompt that echoes what you saw. Acknowledge specifically what you observed.\n\n"
        )
    return (
        images_note
        + "RECENT CONVERSATION (oldest first; the director's LATEST instruction is shown again below):\n"
        f"{_history_digest(history)}\n\n"
        "CURRENTLY SELECTED SLIDE (the director is looking at this — default target if they don't name one):\n"
        f"{_selected_digest(slides, selected_slide_id)}\n\n"
        "CURRENT DECK:\n"
        f"{_slides_digest(slides)}\n\n"
        f'DIRECTOR\'S LATEST INSTRUCTION:\n  "{instruction}"\n\n'
        "Use the conversation for context — if your previous line asked a question, this instruction"
        " is the answer to it (a bare number/ordinal means that slide number, never a move). If no"
        " slide is named, act on the CURRENTLY SELECTED SLIDE. Carry out the instruction by calling"
        " the edit tools on the slides above, and write one short line confirming what you did."
    )


def _describe_actions(actions: list[dict]) -> str:
    """Deterministic one-line confirmation when the model gave tool calls but no text."""
    if not actions:
        return "Done."
    ops = {}
    for a in actions:
        ops[a["op"]] = ops.get(a["op"], 0) + 1
    labels = {
        "edit_slide": "rewrote copy", "move_slide": "reordered slides", "add_slide": "added a slide",
        "delete_slide": "removed a slide", "regenerate_slide": "regenerated a slide",
        "generate_image": "generated imagery", "set_appearance": "restyled a slide",
        "set_accent": "recoloured the accent", "set_theme": "set a new theme",
        "set_font": "changed the display font",
    }
    parts = [labels.get(op, op) for op in ops]
    return ("Done — " + ", ".join(parts) + ".").capitalize()


def run(instruction: str, slides: list[dict], history: list[dict] | None = None,
        selected_slide_id: str | None = None, images: list[dict] | None = None) -> dict:
    """Turn a natural-language instruction into {message, actions[], discarded}.

    Uses NATIVE tool calling: the model emits schema-validated edit calls, we validate them
    against the real deck, and the confirmation the director sees is grounded in the calls
    that actually survived — so "Done" is never claimed for edits that didn't happen.

    ``history``: recent [{"role": "user"|"assistant", "text": str}] turns so the agent can
    resolve follow-ups like a bare "9th" against its own previous question.
    ``selected_slide_id``: the slide the director currently has open — default edit target.
    ``images``: reference images shared this turn ([{"name","mediaType","data"}]) for the
    vision model to analyse and adapt the deck to.
    """
    image_names = [img.get("name", "reference") for img in images] if images else None
    result = complete_tools(
        system=_SYSTEM,
        prompt=_build_prompt(instruction, slides, history, selected_slide_id, image_names),
        tools=_TOOLS,
        log_prefix="slide_edit",
        max_tokens=1600,
        temperature=0.3,
        images=images,
        fallback=lambda: _fallback(instruction, slides),
    )
    if not isinstance(result, dict):
        return _fallback(instruction, slides)
    if "actions" in result:  # deterministic fallback already in the public shape
        return result

    raw_actions = [
        {"op": tc.get("name"), **(tc.get("arguments") or {})}
        for tc in result.get("tool_calls", []) or []
        if isinstance(tc, dict)
    ]
    validated = sanitize({"message": result.get("text") or "", "actions": raw_actions}, slides)
    actions, discarded = validated["actions"], validated["discarded"]

    # Ground the confirmation in what actually survived validation.
    text = (result.get("text") or "").strip()
    if actions:
        message = text or _describe_actions(actions)
        if discarded:
            message += " (Part of the request didn't apply cleanly — tell me the exact slide for the rest.)"
    elif discarded:
        message = ("I tried to make that change but it didn't apply cleanly — "
                   "tell me the exact slide (or rephrase) and I'll do it.")
    else:
        message = text or "Tell me which slide to change and what you'd like different, and I'll do it."
    return {"message": message, "actions": actions, "discarded": discarded}


def _fallback(instruction: str, slides: list[dict]) -> dict:
    """Offline degradation: no model reachable, so we can't parse intent. Surface the REAL reason
    (e.g. OpenAI quota / missing key) so the director can fix it, not just a generic apology."""
    from app.ai import llm

    reason = llm.last_error()
    detail = f" — {reason}" if reason else ""
    return {
        "message": (
            "I can't reach the editing model right now" + detail + ". You can still tweak slides "
            "directly in the editor, and I'll pick up where we left off once it's back."
        ),
        "actions": [],
    }


# ── Validation: keep only well-formed actions referencing real slides ──

_VALID_OPS = {
    "edit_slide", "move_slide", "add_slide", "delete_slide", "regenerate_slide",
    "generate_image", "set_appearance", "set_accent", "set_theme", "set_font", "style_image",
}
_EDITABLE = {"title", "heading", "subheading", "body", "bullets", "items"}


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
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_STYLE_VARIANTS = {"cinematic", "minimal", "bold"}
_BACKGROUND_KEYS = {"default", "warm-portrait", "concrete", "water", "dark-gradient"}
# Only these five display fonts are actually loaded in the app. The model may name any font
# ("Times", "a serif", "something bold") — map it to the nearest one we can render.
_FONTS = {"cormorant", "playfair", "oswald", "poppins", "anton"}
_FONT_SYNONYMS: list[tuple[tuple[str, ...], str]] = [
    (("anton", "impact", "poster", "heavy", "ultra", "blockbuster", "massive", "bold display"), "anton"),
    (("oswald", "condensed", "narrow", "gothic", "tall"), "oswald"),
    (("poppins", "sans", "modern", "clean", "minimal", "grotesk", "geometric", "helvetica",
      "arial", "futura", "roboto"), "poppins"),
    (("playfair", "didot", "didone", "fashion", "high-contrast", "luxury", "vogue"), "playfair"),
    (("cormorant", "serif", "times", "garamond", "georgia", "roman", "classic", "elegant",
      "book", "literary", "editorial"), "cormorant"),
]


def _normalize_font(value: Any) -> str | None:
    """Map any font name the model emits to one of the five loaded display fonts."""
    v = str(value or "").strip().lower()
    if not v:
        return None
    if v in _FONTS:
        return v
    for keys, font in _FONT_SYNONYMS:
        if any(k in v for k in keys):
            return font
    return "cormorant"  # sensible serif default for an unrecognised request


def sanitize(result: dict, slides: list[dict]) -> dict:
    """Drop malformed actions or ones referencing unknown slide ids, so the client only ever
    receives actions it can safely apply.

    Also reports ``discarded`` — how many actions the model emitted that were dropped here —
    so the client can tell "the agent chose to do nothing" apart from "the agent tried but its
    actions were invalid", and avoid echoing a success message for changes that never applied.
    """
    ids = {s.get("id") for s in (slides or [])}
    raw_actions = [a for a in ((result or {}).get("actions", []) or []) if isinstance(a, dict)]
    clean: list[dict[str, Any]] = []
    for a in raw_actions:
        if not isinstance(a, dict):
            continue
        op = a.get("op")
        if op not in _VALID_OPS:
            continue
        if op in {"edit_slide", "move_slide", "delete_slide", "regenerate_slide",
                  "generate_image", "set_appearance", "style_image"}:
            if a.get("slideId") not in ids:
                continue
        if op == "edit_slide":
            patch = {k: v for k, v in a.items()
                     if k in _EDITABLE and k != "items" and v not in (None, "", [])}
            items = _clean_items(a.get("items"))
            if items is not None:
                patch["items"] = items
            if not patch:
                continue
            clean.append({"op": "edit_slide", "slideId": a["slideId"], **patch})
        elif op == "style_image":
            sty: dict[str, Any] = {}
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
        elif op == "generate_image":
            prompt = a.get("imagePrompt")
            action: dict[str, Any] = {"op": "generate_image", "slideId": a["slideId"]}
            if isinstance(prompt, str) and prompt.strip():
                action["imagePrompt"] = prompt.strip()
            clean.append(action)
        elif op == "set_appearance":
            ap: dict[str, Any] = {"op": "set_appearance", "slideId": a["slideId"]}
            sv = a.get("styleVariant")
            if isinstance(sv, str) and sv in _STYLE_VARIANTS:
                ap["styleVariant"] = sv
            ac = a.get("accentColor")
            if isinstance(ac, str) and _HEX.match(ac):
                ap["accentColor"] = ac
            tc = a.get("textColor")
            if isinstance(tc, str) and _HEX.match(tc):
                ap["textColor"] = tc
            bg = a.get("backgroundKey")
            if isinstance(bg, str) and bg in _BACKGROUND_KEYS:
                ap["backgroundKey"] = bg
            comp = a.get("composition")
            if isinstance(comp, str) and comp in {"full", "split", "framed"}:
                ap["composition"] = comp
            side = a.get("imageSide")
            if isinstance(side, str) and side in {"left", "right"}:
                ap["imageSide"] = side
            if len(ap) == 2:  # only op + slideId, nothing actually changed
                continue
            clean.append(ap)
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
        elif op == "set_font":
            font = _normalize_font(a.get("font"))
            if not font:
                continue
            clean.append({"op": "set_font", "font": font})
        else:  # delete_slide / regenerate_slide
            clean.append({"op": op, "slideId": a["slideId"]})
    prior = (result or {}).get("discarded")
    return {
        "message": (result or {}).get("message") or "Done.",
        "actions": clean,
        # Accumulate: re-sanitizing an already-validated result (the router does this as a
        # final safety net) must not reset the count of what was dropped earlier.
        "discarded": (prior if isinstance(prior, int) and prior > 0 else 0)
                     + (len(raw_actions) - len(clean)),
    }
