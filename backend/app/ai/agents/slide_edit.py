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
#   generate_image   {slideId, imagePrompt?}                                      → onGenerateImage
#   set_appearance   {slideId, styleVariant?, accentColor?, backgroundKey?}       → onSetAppearance
#   set_accent       {hex}                                                        → onSetAccent (deck-wide)
#   set_theme        {palette[]}                                                  → onSetTheme  (deck-wide)
#   set_font         {font}                                                       → onSetFont   (deck-wide)
_SYSTEM = """\
You are the deck editor for a cinematic film pitch deck. The director tells you, in plain language,
how to change the deck; you translate that into precise EDIT ACTIONS on the existing slides and a
short, in-character confirmation of what you did.

You are given the current slides (id, number, type, title, and a little content). Reason about which
slide(s) the instruction refers to — by name, type, position ("the cover", "slide 3", "the comps
slide", "the protagonist") — and emit ONLY the actions needed. Never invent slide ids; use the ids
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
  visual", "make a relevant image"), EMIT a generate_image action — never reply "you can add one in
  the editor". You are an agent; perform the action.
- generate_image redraws ONE slide's image per action. If no imagePrompt is given, leave it out and
  the system composes a real prompt from the slide + script + design. Only set imagePrompt when the
  director described what they want to see; ground it in the actual story.
- For "images for the 6 characters", you cannot render several separate portraits inside one slide —
  instead emit a generate_image for the main-character slide AND one for the supporting-characters
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

ADD / REMOVE POINTS / ADD CONTENT ("add more points", "add another point/card", "add 2 more",
"remove the last point", and ALSO generic "add content", "add some content", "more", "add more",
"expand this slide", "elaborate", "flesh it out") — the CURRENT deck view shows each list slide's
existing points as items[N]="a; b; c" (or bullets[N]/comps[N]). For ANY list-style slide (genre_blend,
usp, show_cross, market_potential, target_audience, and any slide that already has items/bullets/comps),
"add content" MEANS add more ITEMS — emit edit_slide on THAT slide with the FULL items list = ALL
existing points (unchanged) PLUS the new ones, each grounded in this film. On a list-style slide you
MUST use "items"; NEVER put the new content in "body" (the slide renders the items grid and ignores
body, so a body edit is invisible and the director sees no change). Never return only the new points
(that would delete the originals), and never claim you added content without emitting the edit_slide
action with items. Default to the SELECTED slide the director is looking at — do NOT retarget the
cover unless they named it.

slideType is one of: cover, logline, genre_blend, synopsis, story_world, character,
supporting_characters, usp, show_cross, visual_aesthetic, target_audience, budget, market_potential,
directors_vision, team, contact, generic.

Rules:
- Only include fields you are actually changing in edit_slide (omit the rest).
- REGENERATE THE SLIDE — "regenerate this slide", "regenerate the slide", "redo this slide", "give
  me a new version / a fresh design of this slide", "make it different" → ALWAYS emit
  regenerate_slide (redoes BOTH copy AND image with a new design). This is NOT generate_image —
  generate_image only redraws the picture and leaves the copy/layout unchanged. Use generate_image
  ONLY when the director explicitly says "regenerate/redo/change the IMAGE (or art/picture/photo)".
  regenerate_slide always targets the SELECTED slide the director is viewing unless they name another.
- Other IMAGE asks (image only) → generate_image. COPY/text rewrites → edit_slide.
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
- "Apply to every slide / the whole deck" (layout or look) → emit one action per slide in the deck
  (for colour, prefer a single set_accent / set_theme).
- FONT changes ("change the font", "use a serif", "make it Times", "bolder type") → set_font. Only
  these display fonts are available; map the request to the NEAREST one:
    serif / classic / elegant / "Times" / "Garamond"  → "cormorant" (or "playfair")
    bold / poster / impact / heavy / condensed         → "anton" (or "oswald")
    clean / modern / sans / minimal                    → "poppins"
  Say which font you applied (and that it's the closest available match if they named a specific one).
- DECK LENGTH ("reduce to 10 slides", "cut it down to 8", "make it 12 slides", "add 2 more",
  "trim the deck"): change WHOLE slides — emit delete_slide / add_slide actions. NEVER shorten a
  slide's copy to hit a number, and never leave a slide half-empty; each slide that stays keeps its
  full content. Reach the exact target count the director asked for.
  • REDUCING: remove the LEAST essential slides first, in this rough drop-order until the count
    matches — team → budget → relationship_map → supporting_characters → target_audience →
    market_potential → show_cross → usp → story_world. NEVER delete cover, logline, synopsis, main
    characters, directors_vision, or contact — those are the spine of the pitch.
  • INCREASING: add relevant slides (from the slideType list) that AREN'T already in the deck,
    grounded in the story, each placed in a sensible spot (e.g. supporting_characters after
    character, market_potential near target_audience). Keep cover first and contact last.
  • ALWAYS finish your confirmation with the FULL resulting deck — a numbered list of EVERY slide
    that will remain AFTER your actions apply (current deck minus deletions, plus additions, in
    order), one per line as "N. <Title> (<type>)". This list is REQUIRED whenever you add or delete
    slides so the director sees the final line-up. Make sure it matches the actions you emitted.
- Be an agent: when the instruction is a clear edit, DO IT (emit the action) and confirm.

NEVER FABRICATE — this is critical:
- Only claim you changed something if you emitted a matching action for it. Do NOT say "Changed the
  font / colour / image" unless you actually emitted set_font / set_accent / generate_image, etc.
- If you genuinely cannot do what's asked (no matching action exists), say so plainly and emit NO
  action — never report a success you didn't perform.
- Return actions: [] and ask ONE short clarification only when the instruction is genuinely unclear
  or not about editing the deck.

OUTPUT — return ONLY this JSON object:
{ "message": "<short, in-character confirmation of what you changed (or what you need). Normally one
   line — but when you ADD or DELETE slides, append the full numbered resulting deck line-up, one
   slide per line, as described in the DECK LENGTH rule>",
  "actions": [ <zero or more action objects above> ] }
"""


def _list_summary(content: dict) -> str:
    """A short view of a slide's LIST content (points/cards) so the agent can see what to add to."""
    items = content.get("items")
    if isinstance(items, list) and items:
        pts = "; ".join(str((it or {}).get("title", "")).strip() for it in items if isinstance(it, dict))
        return f' items[{len(items)}]="{pts[:140]}"'
    bullets = content.get("bullets")
    if isinstance(bullets, list) and bullets:
        return f' bullets[{len(bullets)}]="{"; ".join(str(b)[:40] for b in bullets)[:140]}"'
    comps = content.get("comps")
    if isinstance(comps, list) and comps:
        return f' comps[{len(comps)}]="{"; ".join(str((c or {}).get("title", "")) for c in comps if isinstance(c, dict))[:140]}"'
    chars = content.get("characters")
    if isinstance(chars, list) and chars:
        return f' characters[{len(chars)}]="{"; ".join(str((c or {}).get("name", "")) for c in chars if isinstance(c, dict))[:140]}"'
    return ""


def _slides_digest(slides: list[dict]) -> str:
    """Compact, id-anchored view of the deck for the model — includes list points/cards so the
    agent can extend them ("add more points")."""
    lines = []
    for s in slides or []:
        content = s.get("content") or {}
        heading = content.get("heading") or ""
        body = (content.get("body") or "")[:120]
        lines.append(
            f'  - id={s.get("id")} #{s.get("slideNumber")} type={s.get("slideType")} '
            f'title="{s.get("title", "")}" heading="{heading}" body="{body}"{_list_summary(content)}'
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


def _full_list(content: dict) -> str:
    """The selected slide's FULL list content (title AND description per item) so the agent can
    echo the existing points back VERBATIM when adding to them — the compact _list_summary drops
    descriptions and joins titles, which made the model merge/lose existing items."""
    items = content.get("items")
    if isinstance(items, list) and items:
        lines = [f'      - title="{(it or {}).get("title", "")}" description="{(it or {}).get("description", "")}"'
                 for it in items if isinstance(it, dict)]
        return "\n    existing items (echo these EXACTLY, then append new ones):\n" + "\n".join(lines)
    bullets = content.get("bullets")
    if isinstance(bullets, list) and bullets:
        return "\n    existing bullets (keep all, then append):\n" + "\n".join(f'      - {b}' for b in bullets)
    return ""


def _selected_digest(slides: list[dict], selected_slide_id: str | None) -> str:
    """The slide the director currently has open — the default target for unaddressed edits."""
    if not selected_slide_id:
        return "  (none — ask which slide only if the instruction is ambiguous)"
    for s in slides or []:
        if s.get("id") == selected_slide_id:
            content = s.get("content") or {}
            return (
                f'  id={s.get("id")} #{s.get("slideNumber")} type={s.get("slideType")} '
                f'title="{s.get("title", "")}"' + _full_list(content)
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
        " slide is named, act on the CURRENTLY SELECTED SLIDE. Translate the instruction into edit"
        " actions on the slides above and confirm what you did. Return ONLY the JSON."
    )


def run(instruction: str, slides: list[dict], history: list[dict] | None = None,
        selected_slide_id: str | None = None, images: list[dict] | None = None) -> dict:
    """Turn a natural-language instruction into {message, actions[]}.

    ``history``: recent [{"role": "user"|"assistant", "text": str}] turns so the agent can
    resolve follow-ups like a bare "9th" against its own previous question.
    ``selected_slide_id``: the slide the director currently has open — default edit target.
    ``images``: reference images shared this turn ([{"name","mediaType","data"}]) for the
    vision model to analyse and adapt the deck to.
    """
    image_names = [img.get("name", "reference") for img in images] if images else None
    return complete_json(
        system=_SYSTEM,
        prompt=_build_prompt(instruction, slides, history, selected_slide_id, image_names),
        cache_prefix="slide_edit",
        max_tokens=1200,
        temperature=0.3,
        use_cache=False,
        images=images,
        fallback=lambda: _fallback(instruction, slides),
    )


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
    receives actions it can safely apply."""
    ids = {s.get("id") for s in (slides or [])}
    clean: list[dict[str, Any]] = []
    for a in (result or {}).get("actions", []) or []:
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
    return {"message": (result or {}).get("message") or "Done.", "actions": clean}
