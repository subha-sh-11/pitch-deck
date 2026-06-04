"""Image Prompt agent → register-anchored prompts for slides that carry generated imagery."""
from __future__ import annotations

import re

# Every slide gets a genre-themed image (kind, aspect). Character slides use a portrait ratio.
IMAGE_SLIDES: dict[str, tuple[str, str]] = {
    "cover": ("cover_image", "16:9"),
    "logline": ("background", "16:9"),
    "genre_blend": ("background", "16:9"),
    "synopsis": ("story_world", "16:9"),
    "story_world": ("story_world", "16:9"),
    "character": ("character_art", "3:4"),
    "supporting_characters": ("character_art", "3:4"),
    "usp": ("background", "16:9"),
    "show_cross": ("background", "16:9"),
    "visual_aesthetic": ("mood_image", "16:9"),
    "target_audience": ("background", "16:9"),
    "budget": ("background", "16:9"),
    "market_potential": ("background", "16:9"),
    "directors_vision": ("background", "16:9"),
    "team": ("background", "16:9"),
    "contact": ("background", "16:9"),
    "generic": ("background", "16:9"),
}


def _g(intake: dict, key: str, default: str = "") -> str:
    val = (intake or {}).get(key)
    return val if isinstance(val, str) and val.strip() else default


def slide_needs_image(slide_type: str) -> bool:
    return slide_type in IMAGE_SLIDES


def image_kind(slide_type: str) -> str:
    return IMAGE_SLIDES.get(slide_type, ("background", "16:9"))[0]


def aspect_for(slide_type: str) -> str:
    return IMAGE_SLIDES.get(slide_type, ("background", "16:9"))[1]


# Words that commonly trip diffusion safety filters; we keep prompts atmospheric instead.
_UNSAFE = re.compile(
    r"\b(kid|kids|child|children|minor|boy|girl|teen|drown|drowning|trapped|sealed|"
    r"dying|dead|death|killed|blood|gore|corpse|suicide|abuse|victim|weapon|gun)\w*\b",
    re.IGNORECASE,
)


def _safe(text: str) -> str:
    """Strip peril/minor/violence terms so prompts pass image-model safety policies."""
    return re.sub(r"\s{2,}", " ", _UNSAFE.sub("", text or "")).strip(" ,.-")


def _subject(slide_type: str, intake: dict) -> str:
    # Bias toward SETTING / MOOD / VISUAL fields — these are safe and on-brand for key art.
    if slide_type == "cover":
        return _g(intake, "storyWorld") or _g(intake, "visualAesthetic") or _g(intake, "tagline")
    if slide_type == "story_world":
        return _g(intake, "storyWorld") or _g(intake, "visualMood")
    if slide_type == "visual_aesthetic":
        return _g(intake, "visualAesthetic") or _g(intake, "visualMood") or _g(intake, "designDirection")
    if slide_type in ("character", "supporting_characters"):
        # Avoid literal (often minor/peril) descriptions → evoke mood, not a real person.
        return _g(intake, "visualMood") or _g(intake, "storyWorld")
    return _g(intake, "storyWorld") or _g(intake, "visualMood")


def build_prompt(slide_type: str, intake: dict, design: dict | None) -> str:
    """Assemble a register-anchored, rights-safe diffusion prompt grounded in design language."""
    design = design or {}
    subject = _safe(_subject(slide_type, intake))
    image_style = design.get("imageStyle", "cinematic, realistic lighting")
    visual_style = ", ".join((design.get("visualStyle") or [])[:5])
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])

    framing = {
        "cover": "ultra-wide cinematic establishing key art of the setting, no people",
        "story_world": "wide environmental establishing shot of the setting, no people",
        "visual_aesthetic": "cinematic mood and texture study, atmospheric, no people",
        "character": "evocative cinematic character mood study, dramatic lighting, silhouette, "
                     "no real-person likeness",
        "supporting_characters": "evocative cinematic mood study, dramatic lighting, silhouette, "
                                 "no real-person likeness",
    }.get(slide_type, "cinematic atmospheric frame, no people")

    parts = [framing]
    if subject:
        parts.append(subject)
    parts.append(image_style)
    if visual_style:
        parts.append(visual_style)
    if palette:
        parts.append(f"color palette: {palette}")
    parts.append("film still, professional cinematography, no text, no watermark, no logo")
    return ", ".join(p for p in parts if p)
