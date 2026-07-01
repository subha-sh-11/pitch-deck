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


# Slides whose image is a CONCEPT (audience, money, market, uniqueness, team…), NOT the story's
# location. We deliberately keep the setting/storyWorld OUT of these so the deck doesn't become
# the same street over and over — their own framing drives a distinct image.
_CONCEPT_SLIDES = {
    "logline", "genre_blend", "usp", "show_cross", "visual_aesthetic", "target_audience",
    "budget", "market_potential", "directors_vision", "team", "contact",
}


# Per-slide lighting so the deck isn't one uniform dark night. Chosen deterministically by
# slide type → each type gets a consistent but DIFFERENT time-of-day / light quality.
_LIGHTS = [
    "warm golden-hour light", "cool overcast daylight", "moody blue-hour dusk",
    "bright high-key daylight", "vivid neon night glow", "soft misty dawn",
    "dramatic single-source chiaroscuro", "hazy backlit afternoon sun",
]


def _lighting(slide_type: str) -> str:
    return _LIGHTS[sum(ord(c) for c in slide_type) % len(_LIGHTS)]


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


# ─── Visual medium ──────────────────────────────────────────────────────────────────
# The default deck is cinematic (photographic film key art). When the director's
# genre / visual style says otherwise (anime, cartoon, 3D animation…), we switch the
# rendering MEDIUM so the generated images actually look animated instead of photoreal.
_MEDIA: list[tuple[str, str]] = [
    # (regex, trailer)  — order matters: most specific first.
    (r"anime|manga|cel[\s-]?shad|shonen|shoujo|ghibli|isekai",
     "anime key visual, cel-shaded anime illustration, clean vibrant linework, expressive "
     "anime art, studio-anime production still, highly detailed, NOT photorealistic, not a photo"),
    (r"3d\s*animat|cgi\s*animat|pixar|dreamworks|claymation|stop[\s-]?motion",
     "3D animated film still, stylized 3D characters, soft global illumination, polished "
     "CGI render, animated-feature key art, NOT photorealistic, not a photo"),
    (r"cartoon|toon|comic[\s-]?book|comic\b|graphic[\s-]?novel|2d\s*animat|hand[\s-]?drawn|animat",
     "stylized 2D illustration, bold clean outlines, flat cel shading, animated-film key art, "
     "hand-drawn cartoon style, NOT photorealistic, not a photo"),
]


def _style_text(intake: dict, design: dict | None) -> str:
    design = design or {}
    return " ".join([
        _g(intake, "genreBlend"), _g(intake, "visualAesthetic"), _g(intake, "visualMood"),
        _g(intake, "textureStyle"), str(design.get("imageStyle") or ""),
    ]).lower()


def _medium(intake: dict, design: dict | None) -> tuple[bool, str]:
    """Return (is_realistic, finishing_trailer) for the chosen visual medium.

    Realistic (default) → cinematic photographic finish. Otherwise → an animation/anime/
    cartoon finish, and the caller drops the photographic art-direction so it doesn't fight
    the stylized look.
    """
    text = _style_text(intake, design)
    for pattern, trailer in _MEDIA:
        if re.search(pattern, text):
            return False, _clean(
                trailer + ", consistent character design, no text, no watermark, no logo, "
                "no real-person likeness"
            )
    return True, (
        "film still, shot on anamorphic lenses, professional cinematography, subtle film grain, "
        "consistent color grade, authentic regional detail, period-accurate, "
        "no text, no watermark, no logo, no real-person likeness"
    )


def _subject(slide_type: str, intake: dict) -> str:
    """The concrete focus of the frame, grounded in the intake."""
    if slide_type == "cover":
        return (_g(intake, "storyWorld") or _g(intake, "visualAesthetic")
                or _g(intake, "logline") or _g(intake, "tagline"))
    if slide_type == "synopsis":
        # Narrative-driven, NOT the same environment shot as story_world — lean on the
        # logline/themes so the synopsis image reads as a story moment, not a location.
        return (_g(intake, "logline") or _g(intake, "visualMood")
                or _g(intake, "themes") or _g(intake, "storyWorld"))
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
    realistic, trailer = _medium(intake, design)
    if realistic:
        parts.append(image_style)
    if palette:
        parts.append(f"color palette: {palette}")
    parts.append(trailer)
    return _clean(", ".join(p for p in parts if p))


def character_aspect() -> str:
    return "3:4"


def build_prompt(slide_type: str, intake: dict, design: dict | None, extra: str = "") -> str:
    """Assemble a prompt that captures THIS film's genre, tone, emotion, and regional setting.

    ``extra``: a director's image instruction folded in verbatim (e.g. "add period-accurate
    guns and roses, photoreal") so chat edits like "put some guns and roses in this slide"
    actually change the generated art.
    """
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

    # Framing per slide — DELIBERATELY VARIED so no two slides look alike. Each has its own
    # shot type, camera angle and subject focus (overhead / macro / interior / crowd / object /
    # skyline …) instead of defaulting to the same "lone figure walking down a street" wide shot.
    framing = {
        "cover": "epic theatrical key art, ultra-wide anamorphic establishing frame of the setting, "
                 "monumental scale, deserted landscape, layered depth from foreground texture to "
                 "distant horizon, dramatic golden-hour or low-key lighting",
        "logline": "extreme macro close-up of a single symbolic object from the story (a worn artifact, "
                   "a hand, drifting smoke, a glowing neon sign), shallow focus, strong empty negative "
                   "space for overlaid text",
        "synopsis": "a single charged, cinematic story moment — characters mid-action at a turning "
                    "point (a confrontation, a reveal), faces visible toward camera, expressive staging, "
                    "shallow depth of field, tension made visible",
        "story_world": "rich environmental establishing shot of the setting, completely deserted and "
                       "uninhabited, lived-in detail and atmosphere, volumetric light, deep perspective, "
                       "architecture and texture as the only subject",
        "visual_aesthetic": "pure abstract texture study, extreme macro of surfaces, paint, fabric and "
                            "light play, atmospheric haze, no scene — just texture and colour",
        "character": "evocative cinematic character mood study, dramatic rim lighting, expressive "
                     "silhouette against the story's world, shallow depth of field, fictional character",
        "supporting_characters": "evocative cinematic ensemble mood study, dramatic chiaroscuro "
                                 "lighting, layered silhouettes, fictional characters",
        "genre_blend": "bold graphic split-composition of objects and environments fusing the story's "
                       "genres, hard contrast of light and shadow, diagonal energy, deserted",
        "usp": "a single striking hero object or symbol that embodies what makes this story unique, "
               "dramatic low-angle product-style close-up, spotlit on a clean dark ground",
        "show_cross": "moody abstract diptych backdrop suggesting comparison and scale, deserted, "
                      "deep shadow, geometric",
        "target_audience": "warm wide shot of a lively crowd / audience — many silhouetted faces in a "
                           "cinema or bustling marketplace, sense of collective energy, bokeh lights",
        "budget": "sweeping high vista of production scale — a vast empty film set, towering cranes or a "
                  "sprawling skyline, sense of ambition and scope, deserted foreground",
        "market_potential": "aerial overhead night view of a glowing city skyline and a montage of "
                            "screens and light, sense of reach and growth, uninhabited cityscape",
        "directors_vision": "a quiet symbolic still-life that is a visual metaphor for the story — e.g. "
                            "a lone empty chair, a forking road, a single candle in darkness, a closed "
                            "door — painterly light, deserted, no person",
        "team": "elegant ensemble silhouette line-up against a soft studio gradient, behind-the-scenes "
                "craft feel, warm key light, fictional characters",
        "contact": "quiet minimal still-life — a single landmark or object of the story's world at dusk "
                   "(a sign, a doorway, a skyline silhouette), deserted, restrained and elegant, "
                   "generous empty negative space",
    }.get(slide_type, "evocative cinematic still-life from the story's world — an object, texture or "
                      "empty interior, deserted, soft directional light, depth and mood, generous "
                      "empty negative space for text")

    realistic, trailer = _medium(intake, design)

    # A director's explicit change ("a realistic revolver and red roses in the foreground")
    # LEADS the prompt so the diffusion model weights it heavily and overrides the default
    # framing where they conflict (e.g. the slide's usual "no people").
    directive = extra.strip() if (extra and extra.strip()) else ""
    # CONCEPT slides (audience, budget, market, USP, team…) must NOT be pulled back to the
    # story's location — feeding `storyWorld`/region into them is what made 80% of the deck the
    # same ruined street. Only WORLD slides carry the setting; concept slides rely on their own
    # distinct framing + genre + palette for variety.
    is_concept = slide_type in _CONCEPT_SLIDES

    parts = [directive] if directive else []
    parts.append(framing)
    if not directive:
        # Each slide gets its own lighting so the whole deck isn't one dark night.
        if slide_type not in ("character", "supporting_characters", "synopsis"):
            parts.append(_lighting(slide_type))
        # Kill the repeated lone-figure look — but NOT on slides that are meant to show people
        # (characters, the synopsis moment, the audience crowd, the team line-up). FLUX ignores
        # negations ("no people" summons people), so use POSITIVE emptiness words instead.
        if slide_type not in ("character", "supporting_characters", "synopsis", "target_audience", "team"):
            parts.append("distinct unique composition, completely deserted and empty, uninhabited, "
                         "still-life, not a living soul in frame")
    if subject and not is_concept:
        parts.append(subject)
    if region and not is_concept and region not in (subject or ""):
        parts.append(f"authentic setting: {region}")
    if genre:
        parts.append(f"{genre}")
    emotion = "; ".join(b for b in (tone, themes, mood) if b)
    if emotion:
        parts.append(f"emotional tone: {emotion}")
    # Photographic art-direction (film grain, lens look, "realistic lighting") only applies
    # to the cinematic default — it fights anime/cartoon/3D styles, so skip it there.
    if realistic:
        parts.append(image_style)
        if visual_style:
            parts.append(visual_style)
    if palette:
        parts.append(f"color palette: {palette}")
    parts.append(trailer)
    return _clean(", ".join(p for p in parts if p))
