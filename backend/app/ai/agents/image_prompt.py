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


# We now generate on Vertex Imagen with relaxed safety, so cinematic realism (tension,
# period-accurate weapons for crime/action stories, etc.) is allowed. We only strip terms
# involving MINORS (which hard-block regardless) and the most graphic gore that adds nothing
# to pitch key art. Weapons/danger/tension are intentionally kept.
_STRIP = re.compile(
    r"\b(kids?|child(ren)?|minors?|boys?|girls?|teen\w*|toddlers?|infants?|bab(y|ies)|"
    r"gore|corpses?|mutilat\w*|dismember\w*)\b",
    re.IGNORECASE,
)


def _clean(text: str) -> str:
    """Drop only minor-related and extreme-gore terms; keep the rest for realism."""
    return re.sub(r"\s{2,}", " ", _STRIP.sub("", text or "")).strip(" ,.-")


def _subject(slide_type: str, intake: dict) -> str:
    """The concrete focus of the frame, grounded in the intake."""
    if slide_type == "cover":
        return (_g(intake, "storyWorld") or _g(intake, "visualAesthetic")
                or _g(intake, "logline") or _g(intake, "tagline"))
    if slide_type == "story_world":
        return _g(intake, "storyWorld") or _g(intake, "visualMood")
    if slide_type == "visual_aesthetic":
        return (_g(intake, "visualAesthetic") or _g(intake, "visualMood")
                or _g(intake, "designDirection"))
    if slide_type in ("character", "supporting_characters"):
        return _g(intake, "characterDynamics") or _g(intake, "visualMood") or _g(intake, "storyWorld")
    return _g(intake, "storyWorld") or _g(intake, "visualMood") or _g(intake, "logline")


def build_character_prompt(char: dict, intake: dict, design: dict | None) -> str:
    """A cinematic portrait prompt for ONE character, grounded in the film's world + design.

    Used to give each character card on the character slide its own image. Deliberately a
    fictional cinematic portrait (no real-person likeness) so it's safe to generate.
    """
    design = design or {}
    region = _g(intake, "storyWorld")
    genre = _g(intake, "genreBlend")
    tone = _g(intake, "tone")
    mood = _g(intake, "visualMood") or _g(intake, "visualAesthetic")
    image_style = design.get("imageStyle", "cinematic, realistic lighting")
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:3])

    role = (char.get("role") or "").strip()
    desc = (char.get("description") or "").strip()
    who = "; ".join(p for p in (role, desc) if p)[:240]

    parts = [
        "cinematic character portrait, single person, head-and-shoulders to waist-up framing, "
        "centered, looking toward camera, dramatic rim lighting, shallow depth of field, "
        "expressive face that conveys the character's inner life",
    ]
    if who:
        parts.append(f"character: {who}")
    if region:
        parts.append(f"authentic casting and wardrobe for: {region}")
    if genre:
        parts.append(genre)
    emotion = "; ".join(b for b in (tone, mood) if b)
    if emotion:
        parts.append(f"emotional tone: {emotion}")
    parts.append(image_style)
    if palette:
        parts.append(f"color palette: {palette}")
    parts.append(
        "film still, anamorphic portrait, professional cinematography, subtle film grain, "
        "consistent color grade, no text, no watermark, no logo, fictional character, "
        "no real-person likeness"
    )
    return _clean(", ".join(p for p in parts if p))


def character_aspect() -> str:
    return "3:4"


def build_prompt(slide_type: str, intake: dict, design: dict | None) -> str:
    """Assemble a prompt that captures THIS film's genre, tone, emotion, and regional setting."""
    design = design or {}
    region = _g(intake, "storyWorld")          # where it's set → regional authenticity
    genre = _g(intake, "genreBlend")           # genre cues (allows weapons/tension when fitting)
    tone = _g(intake, "tone")                  # emotional register
    themes = _g(intake, "themes")
    mood = _g(intake, "visualMood") or _g(intake, "visualAesthetic")
    subject = _subject(slide_type, intake)

    image_style = design.get("imageStyle", "cinematic, realistic lighting")
    visual_style = ", ".join((design.get("visualStyle") or [])[:4])
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])

    # Framing per slide — people are allowed so scenes feel lived-in and emotional.
    framing = {
        "cover": "epic theatrical key art, ultra-wide anamorphic establishing frame of the setting, "
                 "monumental scale, layered depth from foreground texture to distant horizon, "
                 "dramatic golden-hour or low-key lighting, no people",
        "logline": "wide poetic frame of the story's world at a charged moment, strong single light "
                   "source, generous negative space for overlaid text, no people",
        "story_world": "rich environmental establishing shot of the setting, lived-in detail and "
                       "atmosphere, volumetric light, deep perspective leading the eye, no people",
        "visual_aesthetic": "painterly cinematic mood and texture study, macro surfaces and light "
                            "play, atmospheric haze, evocative abstract composition, no people",
        "character": "evocative cinematic character mood study, dramatic rim lighting, expressive "
                     "silhouette against the story's world, shallow depth of field, "
                     "no real-person likeness",
        "supporting_characters": "evocative cinematic ensemble mood study, dramatic chiaroscuro "
                                 "lighting, layered silhouettes, no real-person likeness",
        "genre_blend": "moody atmospheric frame that fuses the story's genres in one image, "
                       "contrast of light and shadow, no people",
        "directors_vision": "contemplative wide cinematic frame, a single strong visual metaphor "
                            "from the story's world, painterly light, no people",
        "contact": "quiet minimal cinematic frame of the story's world at dusk, restrained and "
                   "elegant, generous negative space, no people",
    }.get(slide_type, "cinematic atmospheric frame of the story's world, soft directional light, "
                      "texture and depth, generous negative space for text, no people")

    parts = [framing]
    if subject:
        parts.append(subject)
    if region and region not in (subject or ""):
        parts.append(f"authentic setting: {region}")
    if genre:
        parts.append(f"{genre}")
    emotion = "; ".join(b for b in (tone, themes, mood) if b)
    if emotion:
        parts.append(f"emotional tone: {emotion}")
    parts.append(image_style)
    if visual_style:
        parts.append(visual_style)
    if palette:
        parts.append(f"color palette: {palette}")
    parts.append(
        "film still, shot on anamorphic lenses, professional cinematography, subtle film grain, "
        "consistent color grade, authentic regional detail, period-accurate, "
        "no text, no watermark, no logo, no real-person likeness"
    )
    return _clean(", ".join(p for p in parts if p))
