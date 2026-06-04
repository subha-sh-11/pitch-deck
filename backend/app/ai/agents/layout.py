"""Slide Layout agent → SlideLayout {template, layoutType} per slide type."""
from __future__ import annotations

# slide_type → layoutType (template defaults to the slide_type)
_LAYOUT_TYPE: dict[str, str] = {
    "cover": "full_bleed",
    "logline": "centered_statement",
    "genre_blend": "three_column",
    "synopsis": "split_image_text",
    "story_world": "atmospheric",
    "character": "character_cards",
    "supporting_characters": "character_cards",
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


def run(slide_type: str, design: dict | None = None) -> dict:
    return {
        "template": slide_type,
        "layoutType": _LAYOUT_TYPE.get(slide_type, "text_led"),
    }
