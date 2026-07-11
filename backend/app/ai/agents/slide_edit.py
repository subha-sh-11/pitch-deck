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

You are given the current slides (id, number, type, title, and a little content), plus the film's
PITCH BRIEF (the intake the director completed), the DECK DESIGN, and — when uploaded — the SCRIPT.
Reason about which slide(s) the instruction refers to — by name, type, position ("the cover",
"slide 3", "the comps slide", "the protagonist") — and call ONLY the tools needed. Never invent
slide ids; use the ids you were given. Ground any new copy in the PITCH BRIEF, the script and the
existing deck — the brief is the source of truth for the story, USP, audience, characters and
market facts; never invent unrelated plot when the brief already answers it.

RESOLVE INTENT BEFORE ACTING — every turn, silently settle these five things from the instruction
+ conversation + selected slide BEFORE you pick a tool. Every noun and constraint in the
director's sentence must land somewhere (a tool field or your reply) — dropping one is a failure:
1. TARGET: which slide(s)? (named > selected > asked-about-earlier; a bare ordinal = that slide number)
2. OPERATION: copy edit / image / whole-slide regen / layout / colour / structure (add, delete, move)?
3. CONTENT SCOPE: which parts change (one field? the items list? the whole slide?) and what must
   the result contain — names, numbers, topics the director actually said.
4. AMOUNT & DETAIL: any counts ("5 points", "two slides"), lengths ("shorter", "one line each").
5. STYLE: any look/tone words ("punchier", "minimal", "darker") — map to the matching tool/field.
Then act by confidence:
- CLEAR → call the tools and confirm by NAMING your interpretation (which slide, what changed):
  "Rewrote the USP slide's three points around the festival angle" — never a bare "Done".
- ONE reading is best but another is plausible → act on the best reading AND name the alternative
  in your reply so a wrong guess is instantly correctable: "I took 'lighter' as the colour theme —
  if you meant less text, say so and I'll trim instead."
- GENUINELY ambiguous (no selected slide and the target/operation can't be resolved) → call NO
  tools and ask ONE short, specific question that offers the concrete readings as options.

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

STYLING THE EXISTING IMAGE — style_image adjusts a slide's CURRENT background image without
regenerating it: blur it, dim/darken it (for text legibility), or zoom in. Use it for "blur the
image", "darken the background", "zoom in" — never generate_image for those.

LIST SLIDES — genre blend, USP, market potential, target audience and similar slides render an
"items" array ([{title, description}]), NOT bullets. Change their points via edit_slide's items
field, and to change how many points show ("make it 5 points") pass the FULL new items list with
exactly that many entries.
COMPARABLES (show_cross) slides render a "comps" array ([{title, note}]) — edit them via
edit_slide's comps field, always passing the FULL new list (swapping one film = all the kept
comps unchanged + the replacement).
CHARACTER slides (character, supporting_characters) render a "characters" array
([{name, role, description, appearance}]) — rename a character, change their role/description or
look via edit_slide's characters field, always passing the FULL new list with untouched
characters echoed unchanged. The visual_aesthetic slide's mood tiles are "moodBlocks"
([{label, color}]) — edit them the same way (full list, real 6-digit hex colours).

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
  When the director says HOW it should change ("punchier", "lead with the box-office numbers",
  "more about the sisters"), pass their ask in `direction` — the regeneration writer follows it.
- ADD A SLIDE — when the director describes what the new slide is ABOUT ("add a slide on our
  festival strategy with the three target festivals"), you MUST carry their words into the call:
  pick the closest slideType (generic when nothing fits), set `title` to a short on-deck title,
  and put EVERYTHING they said the slide must contain into `contentBrief` — their topics, names,
  numbers and constraints, near-verbatim. A slide added WITH a contentBrief is WRITTEN and
  rendered immediately (say so); one added without (e.g. deck-length padding) is an outline shell
  the director generates from the Slides tab. Set `pointCount` when they gave a count.
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
- "Apply to every slide / the whole deck" (layout or look) → one tool call per slide in the deck
  (for colour, prefer a single set_accent / set_theme).
- FONT changes ("change the font", "use a serif", "make it Times", "bolder type") → set_font. Only
  these display fonts are available; map the request to the NEAREST one:
    serif / classic / elegant / "Times" / "Garamond"  → "cormorant" (or "playfair")
    bold / poster / impact / heavy / condensed         → "anton" (or "oswald")
    clean / modern / sans / minimal                    → "poppins"
  Say which font you applied (and that it's the closest available match if they named a specific one).
- DECK LENGTH ("reduce to 10 slides", "cut it down to 8", "make it 12 slides", "add 2 more",
  "trim the deck"): change WHOLE slides — call delete_slide / add_slide tools. NEVER shorten a
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
    slides so the director sees the final line-up. Make sure it matches the tool calls you made.
- Be an agent: when the instruction is a clear edit, DO IT (call the tool) and confirm.
- SLIDE NAME → TYPE mapping — target the slide whose TYPE matches what the director named, never a
  lookalike: "comparables" / "comps" / "similar films" / "X meets Y" → the show_cross slide;
  "market" / "market potential" → market_potential; "USP" / "unique selling point" → usp;
  "audience" → target_audience. Editing market_potential when they said "comparables" is a hard
  failure — if no slide of the right type exists, say so instead of editing a different one.

READ-BACK REQUESTS ("show the content on slide 11", "what's on the market slide?", "read me the
cover") — the director wants to SEE the content, not change it:
- Call NO tools. Put the slide's ACTUAL content from CURRENT DECK in your reply: title, heading,
  and its body or items as a numbered list, one per line.
- NEVER say you "displayed", "opened" or "showed" the slide — you cannot drive their screen; the
  content you write in the chat IS the answer. Claiming a display action is a fabrication.

SUGGESTION REQUESTS ("suggest options and I'll pick", "give me some alternatives", "what would you
put here?") — the director wants CHOICES before anything changes:
- Call NO tools yet. Reply with 3-5 concrete, story-grounded options as a numbered list and invite
  them to pick (this counts as clarification, so a question is fine here).
- Apply their pick with the right tool on their NEXT message. Never silently apply an edit — least
  of all to a different slide — when they asked to choose first.

UNDO — "undo", "undo that", "revert", "go back to how it was", "restore the previous version"
→ call undo_last (alone, no other tools). It restores the deck to the state before your previous
change: copy, images, added/deleted slides, order, colours and fonts. It only reaches back ONE
step per call — repeat for older states. If the director asks to undo when you haven't changed
anything yet, say there's nothing to undo (call no tools). Never try to "undo" by manually
re-editing slides — undo_last is exact; a manual reconstruction isn't.

NEVER FABRICATE — this is critical:
- Only claim you changed something if you made a matching tool call for it. Do NOT say "Changed the
  font / colour / image" unless you actually called set_font / set_accent / generate_image, etc.
- If you genuinely cannot do what's asked (no matching tool exists), say so plainly and call NO
  tool — never report a success you didn't perform.
- Call no tools and ask ONE short clarification only when the instruction is genuinely unclear
  or not about editing the deck.

OUTPUT: make the tool calls for the edits, and ALWAYS also write a short, in-character plain-text
reply describing what you changed (or what you need). Text only — no JSON, no markdown.
- Confirmations and reactions: one short line — but when you ADD or DELETE slides, append the full
  numbered resulting deck line-up, one slide per line, as described in the DECK LENGTH rule.
- ENUMERABLE answers ("what slides do I have?", "which slides got new images?", "list the
  characters") — or when the director asks to "number it" / "make it points": a one-line lead-in,
  then a blank line, then a numbered list with ONE item per line (real newlines, "1." numbering).
  Never cram a list into a single dense sentence.
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
                "items": {
                    "type": "array",
                    "description": ("For LIST slides (genre blend, USP, market potential, target "
                                    "audience…): the FULL new list of points — always pass every "
                                    "entry, not just the changed ones."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                        },
                        "required": ["title"],
                    },
                },
                "comps": {
                    "type": "array",
                    "description": ("For COMPARABLES (show_cross) slides: the FULL new list of "
                                    "comparable films — always pass every entry, not just the "
                                    "changed ones."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string", "description": "film/show title"},
                            "note": {"type": "string", "description": "why it's comparable"},
                        },
                        "required": ["title"],
                    },
                },
                "characters": {
                    "type": "array",
                    "description": ("For CHARACTER slides: the FULL new character list — every "
                                    "kept character echoed unchanged plus your edits."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "role": {"type": "string"},
                            "description": {"type": "string"},
                            "appearance": {"type": "string",
                                           "description": "age / build / defining look — drives the portrait"},
                        },
                        "required": ["name"],
                    },
                },
                "moodBlocks": {
                    "type": "array",
                    "description": ("For the visual_aesthetic slide's mood tiles: the FULL new "
                                    "list of {label, color} (6-digit hex)."),
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "color": {"type": "string", "description": _HEX_DESC},
                        },
                        "required": ["label"],
                    },
                },
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
        "description": ("Insert a new slide after the given slide number. Carry the director's "
                        "words: title = a short on-deck title, contentBrief = everything they said "
                        "the slide must contain (topics, names, numbers — near-verbatim; the "
                        "slide's copy is written FROM this)."),
        "parameters": {
            "type": "object",
            "properties": {
                "afterSlideNumber": {"type": "integer"},
                "slideType": {"type": "string", "enum": _SLIDE_TYPES},
                "title": {"type": "string", "description": "short on-deck slide title"},
                "contentBrief": {
                    "type": "string",
                    "description": ("what this slide must say/contain, in the director's own "
                                    "terms — drives the slide's generated copy"),
                },
                "pointCount": {"type": "integer", "minimum": 1, "maximum": 8,
                               "description": "number of points/items the director asked for"},
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
        "description": ("Regenerate the WHOLE slide — rewrites its copy AND its imagery. Pass "
                        "`direction` when the director said HOW it should change."),
        "parameters": {
            "type": "object",
            "properties": {
                "slideId": {"type": "string"},
                "direction": {
                    "type": "string",
                    "description": ("the director's change request for this regeneration, e.g. "
                                    "'punchier, lead with the box-office comps' — the writer "
                                    "follows it"),
                },
            },
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
    {
        "name": "undo_last",
        "description": ("Restore the deck to the state before the previous agent change — copy, "
                        "imagery, structure, order, colours and fonts. One step back per call. "
                        "Use for 'undo' / 'revert that' / 'go back'; call it ALONE."),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "name": "style_image",
        "description": ("Adjust the EXISTING background image on one slide WITHOUT regenerating it: "
                        "blur it, dim/darken it (for text legibility), or zoom in. Use for 'blur the "
                        "image', 'darken the background', 'zoom in' — not generate_image."),
        "parameters": {
            "type": "object",
            "properties": {
                "slideId": {"type": "string"},
                "blur": {"type": "number", "minimum": 0, "maximum": 16,
                         "description": "blur radius in px (0 = sharp)"},
                "dim": {"type": "number", "minimum": 0, "maximum": 0.85,
                        "description": "darken overlay strength (0 = none)"},
                "scale": {"type": "number", "minimum": 1.0, "maximum": 1.8,
                          "description": "zoom factor (1.0 = full frame)"},
            },
            "required": ["slideId"],
        },
    },
]


def _slides_digest(slides: list[dict]) -> str:
    """Compact, id-anchored view of the deck for the model. Carries enough real content
    (body, items, bullets, comps, characters) that the agent can read a slide back and
    edit list slides without guessing what's on them."""
    lines = []
    for s in slides or []:
        content = s.get("content") or {}
        heading = content.get("heading") or ""
        body = (content.get("body") or "")[:300]
        line = (
            f'  - id={s.get("id")} #{s.get("slideNumber")} type={s.get("slideType")} '
            f'title="{s.get("title", "")}" heading="{heading}" body="{body}"'
        )
        items = content.get("items")
        if isinstance(items, list) and items:
            pts = "; ".join(
                f'{i.get("title", "")}: {(i.get("description") or "")[:100]}'.strip(": ")
                if isinstance(i, dict) else str(i)[:100]
                for i in items[:8]
            )
            line += f' items=[{pts}]'
        bullets = content.get("bullets")
        if isinstance(bullets, list) and bullets:
            line += f' bullets=[{"; ".join(str(b)[:80] for b in bullets[:8])}]'
        comps = content.get("comps")
        if isinstance(comps, list) and comps:
            line += f' comps=[{"; ".join(str((c or {}).get("title", "")) for c in comps if isinstance(c, dict))}]'
        chars = content.get("characters")
        if isinstance(chars, list) and chars:
            line += ' characters=[' + "; ".join(
                f'{(c or {}).get("name", "")} ({(c or {}).get("role", "")}): '
                f'{str((c or {}).get("description") or "")[:80]}'.strip(": ")
                for c in chars if isinstance(c, dict)) + ']'
        lines.append(line)
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
    chars = content.get("characters")
    if isinstance(chars, list) and chars:
        lines = [
            f'      - name="{(c or {}).get("name", "")}" role="{(c or {}).get("role", "")}" '
            f'description="{(c or {}).get("description", "")}" appearance="{(c or {}).get("appearance", "")}"'
            for c in chars if isinstance(c, dict)
        ]
        return ("\n    existing characters (echo untouched ones EXACTLY when editing the list):\n"
                + "\n".join(lines))
    comps = content.get("comps")
    if isinstance(comps, list) and comps:
        lines = [f'      - title="{(c or {}).get("title", "")}" note="{(c or {}).get("note", "")}"'
                 for c in comps if isinstance(c, dict)]
        return "\n    existing comps (echo kept ones EXACTLY when editing the list):\n" + "\n".join(lines)
    blocks = content.get("moodBlocks")
    if isinstance(blocks, list) and blocks:
        lines = [f'      - label="{(b or {}).get("label", "")}" color="{(b or {}).get("color", "")}"'
                 for b in blocks if isinstance(b, dict)]
        return "\n    existing mood tiles (echo kept ones EXACTLY when editing the list):\n" + "\n".join(lines)
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


def _brief_digest(intake: dict | None, purpose: str | None) -> str:
    """The completed intake brief, compact — the story/market source of truth for edits."""
    lines: list[str] = []
    if purpose:
        lines.append(f"  pitch purpose: {purpose}")
    for key, val in (intake or {}).items():
        if isinstance(val, list):
            val = ", ".join(str(v) for v in val)
        val = str(val or "").strip()
        if not val:
            continue
        val = val if len(val) <= 260 else val[:260] + "…"
        lines.append(f"  {key}: {val}")
    return "\n".join(lines) or "  (no brief captured)"


def _design_digest(design: dict | None) -> str:
    """The deck's live design language, so styling requests stay grounded in it."""
    d = design or {}
    parts: list[str] = []
    palette = [c for c in (d.get("palette") or []) if isinstance(c, dict) and c.get("hex")]
    if palette:
        parts.append("palette " + ", ".join(
            f'{c.get("usage") or c.get("name") or "colour"}={c["hex"]}' for c in palette[:5]))
    for key in ("displayFont", "font", "cinematicTone", "imageStyle"):
        if d.get(key):
            parts.append(f"{key}={d[key]}")
    return "  " + " · ".join(parts) if parts else "  (default design)"


def _build_prompt(instruction: str, slides: list[dict], history: list[dict] | None = None,
                  selected_slide_id: str | None = None, image_names: list[str] | None = None,
                  intake: dict | None = None, design: dict | None = None,
                  purpose: str | None = None) -> str:
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
        + "PITCH BRIEF (the director's completed intake — ground all new copy in this):\n"
        f"{_brief_digest(intake, purpose)}\n\n"
        "DECK DESIGN (current look — styling requests build on this):\n"
        f"{_design_digest(design)}\n\n"
        "RECENT CONVERSATION (oldest first; the director's LATEST instruction is shown again below):\n"
        f"{_history_digest(history)}\n\n"
        "CURRENTLY SELECTED SLIDE (the director is looking at this — default target if they don't name one):\n"
        f"{_selected_digest(slides, selected_slide_id)}\n\n"
        "CURRENT DECK:\n"
        f"{_slides_digest(slides)}\n\n"
        f'DIRECTOR\'S LATEST INSTRUCTION:\n  "{instruction}"\n\n'
        "Use the conversation for context — if your previous line asked a question, this instruction"
        " is the answer to it (a bare number/ordinal means that slide number, never a move). If no"
        " slide is named, act on the CURRENTLY SELECTED SLIDE. Resolve the intent (target, operation,"
        " content scope, amount, style) before calling tools; carry every stated constraint into the"
        " matching tool field. For an edit, carry it out and confirm by naming your interpretation."
        " For a read-back or a suggestions request, call NO tools and put the content / numbered"
        " options in your reply."
    )


def _describe_actions(actions: list[dict], slides: list[dict] | None = None) -> str:
    """Deterministic confirmation when the model gave tool calls but no text — names the
    interpretation (which slide, what) so a wrong read is visible, never a bare "Done"."""
    if not actions:
        return "Done."
    by_id = {s.get("id"): s for s in (slides or [])}

    def where(a: dict) -> str:
        s = by_id.get(a.get("slideId"))
        return f' on "{s.get("title")}" (slide {s.get("slideNumber")})' if s else ""

    parts = []
    for a in actions:
        op = a["op"]
        if op == "add_slide":
            what = f'"{a["title"]}"' if a.get("title") else a.get("slideType", "a new slide")
            parts.append(f"added {what} after slide {a.get('afterSlideNumber')}")
        elif op == "regenerate_slide":
            d = f" — {a['direction']}" if a.get("direction") else ""
            parts.append(f"regenerating{where(a)}{d}")
        elif op == "edit_slide":
            n = len(a["items"]) if isinstance(a.get("items"), list) else None
            parts.append(f"rewrote{where(a)}" + (f" as {n} point{'s' if n != 1 else ''}" if n else ""))
        else:
            labels = {
                "move_slide": "reordered slides", "delete_slide": f"removed{where(a)}",
                "generate_image": f"generating an image{where(a)}",
                "set_appearance": f"restyled{where(a)}", "set_accent": "recoloured the accent",
                "set_theme": "set a new colour theme", "set_font": "changed the display font",
                "style_image": f"adjusted the image{where(a)}",
                "undo_last": "restored the deck to before my last change",
            }
            parts.append(labels.get(op, op))
    return ("Done — " + "; ".join(parts) + ".")


# How much of the uploaded script rides along (cached system block, same as the interview).
_SCRIPT_CONTEXT_CHARS = 150_000

# ── Post-action verification (Layer 4) ────────────────────────────────────
# Deterministic checks that the emitted actions actually satisfy the instruction's explicit,
# machine-checkable constraints. A failed check triggers ONE retry with a critique note —
# the same claimed-update pattern the intake agent uses.

_COUNT_RE = re.compile(
    r"\b(\d+)\s*(?:more\s+)?(points?|items?|cards?|bullets?|tiles?|scenes?)\b", re.IGNORECASE)
_MORE_RE = re.compile(r"\b(more|another|add)\b", re.IGNORECASE)
_CLAIM_RE = re.compile(
    r"\b(i'?ve|i have|added|updated|changed|rewrote|removed|regenerat\w+|set|applied|moved|done)\b",
    re.IGNORECASE,
)


def _requested_count(instruction: str) -> int | None:
    m = _COUNT_RE.search(instruction or "")
    return int(m.group(1)) if m else None


def _verify(instruction: str, actions: list[dict], text: str, discarded: int) -> str | None:
    """Return a critique string when the actions visibly miss the instruction, else None."""
    want = _requested_count(instruction)
    if want is not None:
        # An edited items list must match an explicit count ("make it 5 points") — UNLESS the ask
        # is additive ("add 2 more points"), where total = existing + new and we can't know it here.
        if not _MORE_RE.search(instruction or ""):
            for a in actions:
                if a.get("op") == "edit_slide" and isinstance(a.get("items"), list):
                    got = len(a["items"])
                    if got != want:
                        return (f"VERIFICATION FAILED: the director asked for {want} points but your "
                                f"edit_slide call carries {got} items. Re-emit the edit with EXACTLY "
                                f"{want} items (keep the existing ones that fit, grounded in this film).")
        # A NEW slide has no existing items, so its pointCount must equal the stated count even
        # when the instruction says "add" ("add a slide with 3 points").
        for a in actions:
            if a.get("op") == "add_slide" and a.get("pointCount") not in (None, want):
                return (f"VERIFICATION FAILED: the director asked for {want} points but you set "
                        f"pointCount={a.get('pointCount')}. Re-emit add_slide with pointCount={want}.")
    # Success-claiming reply with NO surviving action and nothing discarded → the model narrated
    # an edit it never made. (Read-backs/suggestions don't claim changes, so they pass.)
    if not actions and not discarded and _CLAIM_RE.search(text or ""):
        return ("VERIFICATION FAILED: your reply claims a change but you called NO edit tools. "
                "Either make the real tool calls for what you claimed, or reply honestly about "
                "what you need (without claiming success).")
    return None


def run(instruction: str, slides: list[dict], history: list[dict] | None = None,
        selected_slide_id: str | None = None, images: list[dict] | None = None,
        intake: dict | None = None, design: dict | None = None,
        purpose: str | None = None, script: str | None = None) -> dict:
    """Turn a natural-language instruction into {message, actions[], discarded}.

    Uses NATIVE tool calling: the model emits schema-validated edit calls, we validate them
    against the real deck, and the confirmation the director sees is grounded in the calls
    that actually survived — so "Done" is never claimed for edits that didn't happen.

    ``history``: recent [{"role": "user"|"assistant", "text": str}] turns so the agent can
    resolve follow-ups like a bare "9th" against its own previous question.
    ``selected_slide_id``: the slide the director currently has open — default edit target.
    ``images``: reference images shared this turn ([{"name","mediaType","data"}]) for the
    vision model to analyse and adapt the deck to.
    ``intake`` / ``design`` / ``purpose`` / ``script``: the completed brief, deck design,
    pitch purpose and uploaded script — the grounding context for interpreting requests.
    """
    image_names = [img.get("name", "reference") for img in images] if images else None
    context = None
    if script and script.strip():
        truncated = " (truncated)" if len(script) > _SCRIPT_CONTEXT_CHARS else ""
        context = (f"THE DIRECTOR'S UPLOADED SCRIPT{truncated} — ground character/scene/plot "
                   "edits in it:\n\n" + script[:_SCRIPT_CONTEXT_CHARS])

    def call(note: str = "") -> dict | None:
        result = complete_tools(
            system=_SYSTEM,
            prompt=note + _build_prompt(instruction, slides, history, selected_slide_id,
                                        image_names, intake, design, purpose),
            tools=_TOOLS,
            log_prefix="slide_edit",
            max_tokens=1600,
            temperature=0.3,
            images=images,
            context=context,
            fallback=lambda: _fallback(instruction, slides),
        )
        return result if isinstance(result, dict) else None

    result = call()
    if result is None:
        return _fallback(instruction, slides)
    if "actions" in result:  # deterministic fallback already in the public shape
        return result

    def validate(res: dict) -> tuple[list[dict], int, str]:
        raw = [
            {"op": tc.get("name"), **(tc.get("arguments") or {})}
            for tc in res.get("tool_calls", []) or []
            if isinstance(tc, dict)
        ]
        v = sanitize({"message": res.get("text") or "", "actions": raw}, slides)
        return v["actions"], v["discarded"], (res.get("text") or "").strip()

    actions, discarded, text = validate(result)

    # Layer-4 verify: when the actions visibly miss an explicit constraint, retry ONCE with the
    # critique; keep the retry only if it passes the same check.
    from app.ai import llm as _llm

    critique = _verify(instruction, actions, text, discarded)
    if critique and not _llm.last_error():
        second = call(critique + "\n\n")
        if second is not None and "actions" not in second:
            a2, d2, t2 = validate(second)
            if not _verify(instruction, a2, t2, d2):
                actions, discarded, text = a2, d2, t2

    # Ground the confirmation in what actually survived validation.
    if actions:
        message = text or _describe_actions(actions, slides)
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
    "undo_last",
}
_EDITABLE = {"title", "heading", "subheading", "body", "bullets", "items", "comps",
             "characters", "moodBlocks"}


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


def _clean_comps(raw) -> list[dict] | None:
    """Normalise a `comps` list ([{title, note}] or [str]) for show_cross slides."""
    if not isinstance(raw, list) or not raw:
        return None
    out: list[dict] = []
    for c in raw:
        if isinstance(c, dict) and str(c.get("title") or "").strip():
            comp = {"title": str(c["title"]).strip(), "note": str(c.get("note") or "").strip()}
            if str(c.get("posterUrl") or "").strip():
                comp["posterUrl"] = str(c["posterUrl"]).strip()
            out.append(comp)
        elif isinstance(c, str) and c.strip():
            out.append({"title": c.strip(), "note": ""})
    return out or None


def _clean_characters(raw) -> list[dict] | None:
    """Normalise a `characters` list for character slides — name required, rest optional."""
    if not isinstance(raw, list) or not raw:
        return None
    out: list[dict] = []
    for c in raw:
        if not (isinstance(c, dict) and str(c.get("name") or "").strip()):
            continue
        char = {"name": str(c["name"]).strip(),
                "role": str(c.get("role") or "").strip(),
                "description": str(c.get("description") or "").strip()}
        if str(c.get("appearance") or "").strip():
            char["appearance"] = str(c["appearance"]).strip()
        out.append(char)
    return out or None


def _clean_mood_blocks(raw) -> list[dict] | None:
    """Normalise a `moodBlocks` list — label required, colour must be a real hex."""
    if not isinstance(raw, list) or not raw:
        return None
    out: list[dict] = []
    for b in raw:
        if not (isinstance(b, dict) and str(b.get("label") or "").strip()):
            continue
        block = {"label": str(b["label"]).strip()}
        color = str(b.get("color") or "").strip()
        if _HEX.match(color):
            block["color"] = color
        out.append(block)
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
            _LISTY = ("items", "comps", "characters", "moodBlocks")
            patch = {k: v for k, v in a.items()
                     if k in _EDITABLE and k not in _LISTY and v not in (None, "", [])}
            for key, cleaner in (("items", _clean_items), ("comps", _clean_comps),
                                 ("characters", _clean_characters),
                                 ("moodBlocks", _clean_mood_blocks)):
                cleaned = cleaner(a.get(key))
                if cleaned is not None:
                    patch[key] = cleaned
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
            add: dict[str, Any] = {
                "op": "add_slide",
                "afterSlideNumber": int(a.get("afterSlideNumber") or len(slides or [])),
                "slideType": a["slideType"],
            }
            title = a.get("title")
            if isinstance(title, str) and title.strip():
                add["title"] = title.strip()[:120]
            cbrief = a.get("contentBrief")
            if isinstance(cbrief, str) and cbrief.strip():
                add["contentBrief"] = cbrief.strip()[:1500]
            pcount = a.get("pointCount")
            if isinstance(pcount, int) and 1 <= pcount <= 8:
                add["pointCount"] = pcount
            clean.append(add)
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
        elif op == "regenerate_slide":
            regen: dict[str, Any] = {"op": "regenerate_slide", "slideId": a["slideId"]}
            direction = a.get("direction")
            if isinstance(direction, str) and direction.strip():
                regen["direction"] = direction.strip()[:600]
            clean.append(regen)
        elif op == "undo_last":
            clean.append({"op": "undo_last"})
        else:  # delete_slide
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
