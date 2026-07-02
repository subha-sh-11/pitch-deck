"""Slide Layout agent → SlideLayout {template, layoutType} + initial visual appearance.

Layout is decided per slide from its ACTUAL content — does it carry an image, how long
is the copy, does it have structured items — plus the deck's design language. The
frontend slide templates render these layoutType variants, so the decision is visible:
a synopsis with no image gets editorial text columns instead of an empty image panel; a
short, punchy generic slide becomes a big statement instead of a small paragraph.

`appearance_for()` additionally sets the slide's initial visual pacing (bold / minimal /
standard), which the renderer applies via the appearance channel. The director can
override everything per slide in the editor.
"""
from __future__ import annotations

import random

# slide_type → default layoutType (template defaults to the slide_type)
_LAYOUT_TYPE: dict[str, str] = {
    "cover": "full_bleed",
    "logline": "centered_statement",
    "genre_blend": "three_column",
    "synopsis": "split_image_text",
    "story_world": "atmospheric",
    "character": "character_cards",
    "supporting_characters": "character_cards",
    "relationship_map": "map",
    "usp": "grid",
    "show_cross": "comp_cards",
    "visual_aesthetic": "moodboard",
    "target_audience": "segments",
    "budget": "text_led",
    "market_potential": "text_led",
    "directors_vision": "quote",
    "team": "text_led",
    "contact": "minimal",
    "generic": "text_led",
}

# Visual pacing: hero beats land bold, dense-copy beats stay quiet, the rest standard.
_BOLD = {"cover", "visual_aesthetic", "directors_vision", "story_world"}
_MINIMAL = {"logline", "synopsis", "contact"}

# Auto-varied compositions so the deck doesn't read the same on every slide: text-centric slides
# get a side-by-side ("split") or inset ("framed") layout instead of full-bleed-with-overlay,
# alternating which side the image sits on. Only slide types whose template supports composition
# (logline, and the generic-rendered text slides) — grids/heroes keep their own strong layouts.
_COMPOSITION_BY_TYPE: dict[str, tuple[str, str]] = {
    "logline": ("split", "right"),           # text left, image right
    "directors_vision": ("split", "left"),   # image left, text right
    "budget": ("framed", "left"),
    "team": ("split", "right"),
    "generic": ("framed", "right"),
}


def _text_len(content: dict | None, key: str = "body") -> int:
    val = (content or {}).get(key)
    return len(val) if isinstance(val, str) else 0


def run(slide_type: str, design: dict | None = None,
        content: dict | None = None, has_image: bool | None = None) -> dict:
    """Pick the layout variant for this slide from its content shape.

    ``has_image``: whether a generated image will be bound to this slide (known to the
    pipeline before the image URL exists on content). Falls back to content.imageUrl.
    """
    content = content or {}
    if has_image is None:
        has_image = bool(content.get("imageUrl"))
    layout_style = ((design or {}).get("layoutStyle") or "").lower()

    layout_type = _LAYOUT_TYPE.get(slide_type, "text_led")

    if slide_type == "cover":
        # No image (or an explicitly symmetric design language) → typographic centre.
        if not has_image or "centered" in layout_style or "symmetr" in layout_style:
            layout_type = "centered_title" if not has_image else layout_type
    elif slide_type == "logline":
        # A long logline reads better anchored left with the rail; a tight one lands
        # centred like a title card.
        layout_type = "left_rail" if _text_len(content) > 140 else "centered_statement"
    elif slide_type == "synopsis":
        # No image → don't render an empty image panel; go editorial columns. Very long
        # synopses also need the full width.
        if not has_image or _text_len(content) > 700:
            layout_type = "text_columns"
    elif slide_type == "story_world":
        # Location cards want the bottom-anchored composition; pure prose over imagery
        # reads better in a side caption panel.
        items = content.get("items")
        if not (isinstance(items, list) and items) and has_image:
            layout_type = "caption_panel"
    elif slide_type == "generic":
        # Short, bullet-less copy lands as a big statement, not a small paragraph.
        bullets = content.get("bullets")
        if not (isinstance(bullets, list) and bullets) and 0 < _text_len(content) <= 160:
            layout_type = "statement"

    return {"template": slide_type, "layoutType": layout_type}


def appearance_for(slide_type: str, design: dict | None = None) -> dict:
    """Initial styleVariant for a freshly generated slide, biased by the design language."""
    layout_style = ((design or {}).get("layoutStyle") or "").lower()
    quiet_deck = any(w in layout_style for w in ("minimal", "negative space", "restrained"))

    if slide_type in _BOLD:
        variant = "standard" if quiet_deck and slide_type != "cover" else "bold"
    elif slide_type in _MINIMAL or quiet_deck:
        variant = "minimal"
    else:
        variant = "standard"

    appearance: dict = {"styleVariant": variant}
    comp = _COMPOSITION_BY_TYPE.get(slide_type)
    if comp:
        appearance["composition"], appearance["imageSide"] = comp
    return appearance


# Composition variants each template can render (grids/heroes keep their own layout).
_COMP_OPTIONS = ["split", "framed", "full"]
_STYLE_OPTIONS = ["standard", "bold", "minimal", "cinematic"]
# Types whose template actually reflows with composition/imageSide.
_COMPOSABLE = set(_COMPOSITION_BY_TYPE) | {"synopsis", "story_world", "visual_aesthetic"}


def varied_appearance(slide_type: str, design: dict | None = None, current: dict | None = None) -> dict:
    """A DELIBERATELY DIFFERENT appearance than ``current`` — so an explicit 'Regenerate slide'
    also changes the LAYOUT (composition / image side / style pacing), not just text + image."""
    cur = current or {}
    appearance = appearance_for(slide_type, design)

    styles = [s for s in _STYLE_OPTIONS if s != cur.get("styleVariant")] or _STYLE_OPTIONS
    appearance["styleVariant"] = random.choice(styles)

    if slide_type in _COMPOSABLE:
        comps = [c for c in _COMP_OPTIONS if c != cur.get("composition")] or _COMP_OPTIONS
        appearance["composition"] = random.choice(comps)
        # Flip the image side from whatever it was.
        appearance["imageSide"] = "left" if cur.get("imageSide") == "right" else "right"
    return appearance
