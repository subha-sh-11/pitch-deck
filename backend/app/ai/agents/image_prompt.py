"""Image Prompt agent → story-grounded prompts for slides that carry generated imagery.

`build_prompt` asks the LLM to write ONE vivid diffusion prompt grounded STRICTLY in the
film summary + this specific slide's content + the design direction (with a deterministic,
register-anchored fallback so a no-key environment still works)."""
from __future__ import annotations

import re

from app.ai.llm import complete_json

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


# ─── Visual medium ──────────────────────────────────────────────────────────────────
# The deck is photoreal-cinematic by default. When the director picks an animated style
# (Visual style chips → folded into genreBlend / visualAesthetic), we switch the rendering
# MEDIUM and OVERRIDE the cinematic-realism system prompt.
_MEDIA: list[tuple[str, str, str]] = [
    (r"anime|manga|cel[\s-]?shad|ghibli|shonen|shoujo|isekai", "anime",
     "anime key visual, cel-shaded anime illustration, clean vibrant linework, expressive "
     "studio-anime art, NOT photorealistic, not a photo, not live-action"),
    (r"3d\s*animat|cgi\s*animat|pixar|dreamworks|claymation|stop[\s-]?motion", "3D animation",
     "3D animated feature-film style, stylized 3D characters, soft global illumination, polished "
     "CGI render, animated-movie key art, NOT photorealistic, not live-action"),
    (r"cartoon|toon|comic[\s-]?book|comic\b|graphic[\s-]?novel|2d\s*animat|hand[\s-]?drawn", "cartoon",
     "stylized 2D cartoon illustration, bold clean outlines, flat cel shading, animated-film key "
     "art, hand-drawn look, NOT photorealistic, not live-action"),
    (r"\banimat", "animation",
     "stylized animated illustration, expressive, NOT photorealistic, not live-action"),
]


def _visual_medium(intake: dict, design: dict | None) -> tuple[str, str] | None:
    """Return (label, style-descriptor) when the director chose an animated style, else None."""
    text = " ".join([
        _g(intake, "genreBlend"), _g(intake, "visualAesthetic"),
        _g(intake, "visualMood"), _g(intake, "textureStyle"),
        str((design or {}).get("imageStyle") or ""),
    ]).lower()
    for pattern, label, desc in _MEDIA:
        if re.search(pattern, text):
            return label, desc
    return None


def _bg_hex(design: dict) -> str:
    """The deck's base/background colour from the palette, if any."""
    for c in design.get("palette") or []:
        usage = (c.get("usage") or "").lower()
        if "background" in usage or "base" in usage:
            hex_ = (c.get("hex") or "").strip()
            if hex_:
                return hex_
    return ""


def _is_light_theme(design: dict) -> bool:
    """True when the deck's background colour is light — so images should be bright/high-key
    instead of the default dark cinematic look."""
    hex_ = _bg_hex(design).lstrip("#")
    if len(hex_) != 6:
        return False
    try:
        r, g, b = (int(hex_[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except ValueError:
        return False
    # Perceived luminance (Rec. 601). > ~0.6 reads as a light background.
    return (0.299 * r + 0.587 * g + 0.114 * b) > 0.6


_DARK_WORDS = re.compile(
    r"\b(dark|low-key|moody|desaturat\w*|noir|shadowy|gloom\w*|murky|dim)\b", re.IGNORECASE
)


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


# Each slide gets a DELIBERATELY DIFFERENT shot type + location intent so the deck reads like a film
# (wide establishing → close-up → detail → emotional → final hopeful) instead of repeating the same
# dark street. Market/budget/team are intentionally MINIMAL (clarity over cinema, per the design
# bible). COMPOSITION ONLY here — lighting/grade come from the theme.
_SHOT_BY_TYPE: dict[str, str] = {
    "cover": "epic wide establishing shot of the story's world, anamorphic widescreen, monumental "
             "scale, layered depth, a generous expanse of empty sky and open uncluttered space, no people",
    "logline": "a lone central figure small within the wide world at a charged moment, poetic wide "
               "shot, a large clean uncluttered empty area of the frame",
    "synopsis": "an establishing shot of a DISTINCT key location from the story (a different place "
                "than other slides), deep perspective, lived-in detail, no people",
    "story_world": "a sweeping environmental establishing shot of the setting, atmosphere and depth, "
                   "a fresh location, no people",
    "genre_blend": "an atmospheric frame that fuses the story's genres in one image, no people",
    "character": "an intimate character close-up, expressive face and silhouette against the story's "
                 "world, shallow depth of field, no real-person likeness",
    "supporting_characters": "an ensemble mid-shot, layered figures in the story's world, shallow "
                             "depth of field, no real-person likeness",
    "usp": "a bold graphic close-up of a single meaningful object or detail from the story, striking "
           "and minimal, strong negative space, no people",
    "show_cross": "a distinctive mid-shot that situates the film among its comparables, fresh "
                  "framing, no people",
    "visual_aesthetic": "a painterly mood-and-texture study, macro surfaces and light play, "
                        "evocative composition, no people",
    "target_audience": "a warm, human wide shot of the everyday world the audience recognises, "
                       "inviting and relatable, no faces in focus",
    "budget": "a restrained, near-graphic minimal frame, lots of clean negative space, plain and "
              "documentary — clarity over cinema, no people",
    "market_potential": "a restrained minimal frame, clean negative space, more chart-ready than "
                        "cinematic, no people",
    "directors_vision": "a single powerful visual metaphor from the story, intimate, contemplative "
                       "and emotional, no people",
    "team": "a clean, professional, restrained backdrop, lots of negative space, no people",
    "contact": "the story's final hopeful frame — a quiet resonant closing image, forward-looking "
               "light, generous negative space, no people",
    "generic": "an atmospheric frame from a FRESH, unused corner of the story's world, a new "
               "location, texture and depth, a generous clean uncluttered empty area, no people",
}


def _shot_for(slide_type: str) -> str:
    return _SHOT_BY_TYPE.get(slide_type, _SHOT_BY_TYPE["generic"])


# When the brief is THIN, the model collapses every slide to one generic scene (a dark city
# skyline, an empty sandy field) — so the whole deck looks like the SAME image. Give each slide a
# distinct FACET (different time of day, distance and focal subject) so the frames diverge even
# with no story to anchor on. Purely differentiating cues — the story still drives the content.
_FACET_BY_TYPE: dict[str, str] = {
    "cover": "at first light / dawn, an extreme-wide vista, the whole world laid out",
    "logline": "at dusk / golden hour, a lone distant figure, vast empty space around them",
    "synopsis": "at midday, a mid-distance lived-in location, everyday activity",
    "story_world": "under an overcast sky, a sweeping different corner of the setting",
    "genre_blend": "at blue hour, a moody atmospheric fusion of the story's tones",
    "character": "in warm interior / window light, a tight intimate close framing of a face",
    "supporting_characters": "in dappled shade, a grouped mid-shot of several figures",
    "usp": "in hard side light, an extreme macro of a single symbolic object",
    "show_cross": "at night, a graphic comparative framing, neon or lamp light",
    "visual_aesthetic": "in soft diffused light, a painterly macro texture study",
    "target_audience": "on a bright ordinary afternoon, a warm relatable everyday scene",
    "budget": "in flat even daylight, a plain restrained near-empty frame",
    "market_potential": "in clean neutral light, a minimal chart-ready backdrop",
    "directors_vision": "in a single shaft of light against darkness, one poetic metaphor",
    "team": "in clean studio light, a plain professional negative-space backdrop",
    "contact": "at sunrise, a quiet hopeful forward-looking closing frame",
    "generic": "in a fresh unused light and location not seen on any other slide",
}


def _facet_for(slide_type: str) -> str:
    return _FACET_BY_TYPE.get(slide_type, _FACET_BY_TYPE["generic"])


def _deterministic_prompt(slide_type: str, intake: dict, design: dict | None,
                          has_references: bool = False) -> str:
    """Register-anchored fallback: assemble a prompt from the intake + design (no LLM).

    When ``has_references`` is set, lighting/grade defer to the supplied reference images
    instead of forcing the register's default dark cinematic look."""
    design = design or {}
    region = _g(intake, "storyWorld")          # where it's set → regional authenticity
    genre = _g(intake, "genreBlend")           # genre cues (allows weapons/tension when fitting)
    tone = _g(intake, "tone")                  # emotional register
    themes = _g(intake, "themes")
    mood = _g(intake, "visualMood") or _g(intake, "visualAesthetic")
    subject = _subject(slide_type, intake)

    light = _is_light_theme(design)

    image_style = design.get("imageStyle", "cinematic, realistic lighting")
    visual_style = ", ".join((design.get("visualStyle") or [])[:4])
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])
    # On a light deck — or when references drive the look — drop any dark descriptors the
    # register/design carries so they don't fight the brighter/warmer look that was asked for.
    if light or has_references:
        image_style = _DARK_WORDS.sub("", image_style).strip(" ,") or "naturalistic, soft contrast"
        visual_style = _DARK_WORDS.sub("", visual_style).strip(" ,")

    # Lighting + grade are LIGHTING-NEUTRAL in the framing below and set here from the theme,
    # so a light deck yields bright, airy images and a dark deck yields cinematic low-key ones.
    # With references attached, defer entirely to them rather than forcing a direction.
    if has_references:
        lighting = "lighting, colour temperature and mood matching the supplied reference images"
        grade = "colour grade and grain matching the reference images"
    elif light:
        lighting = ("bright high-key natural daylight, soft even illumination, airy and luminous, "
                    "light clean background, fresh and vibrant")
        grade = "natural true-to-life color, crisp and clean, minimal grain"
    else:
        lighting = ("dramatic low-key cinematic lighting, strong directional light, deep shadows, "
                    "atmospheric haze")
        grade = "cinematic color grade, subtle film grain"

    # Framing per slide — a DISTINCT shot type per slide (COMPOSITION ONLY; lighting comes from the
    # theme). This is what keeps the deck from repeating the same frame slide after slide.
    framing = _shot_for(slide_type)

    parts = [framing, _facet_for(slide_type), lighting]
    if subject:
        parts.append(subject)
    if region and region not in (subject or ""):
        parts.append(f"authentic setting: {region}")
    if genre:
        parts.append(f"{genre}")
    emotion = "; ".join(b for b in (tone, themes, mood) if b)
    if emotion:
        parts.append(f"emotional tone: {emotion}")
    if image_style:
        parts.append(image_style)
    if visual_style:
        parts.append(visual_style)
    if palette:
        parts.append(f"color palette: {palette}")
    parts.append(
        f"film still, professional cinematography, {grade}, authentic regional detail, "
        "no text, no watermark, no logo, no real-person likeness"
    )
    return _clean(", ".join(p for p in parts if p))


# ── LLM-driven prompt (grounded in the film summary + this slide) ──────────────

_SYSTEM_IMG = """\
You are a cinematographer and concept artist writing ONE vivid image-generation prompt for a SINGLE
slide of a film pitch deck. A text-to-image diffusion model (Imagen / FLUX) will render it.

GROUND EVERYTHING in the FILM SUMMARY and THIS SLIDE the user gives you. Never invent characters,
places, or plot that the material doesn't support. The image MUST be specific and relevant to THIS
film and THIS slide — generic stock imagery is a failure.

Match the slide's job (by kind):
- cover_image / background: an evocative establishing image of the story's world/setting; leave a
  clean, uncluttered EMPTY area of the frame (the app overlays its own text later — you render none);
  usually no people.
- story_world: an establishing environmental shot of the ACTUAL setting described in the summary.
- character_art: a cinematic mood study evoking the SPECIFIC character(s) named on this slide — their
  role, era and world, expressive silhouette/atmosphere. NO real-person likeness.
- mood_image: a painterly texture/mood study of the film's visual aesthetic.

Honor the THEME brightness EXACTLY (light → bright, high-key, airy; dark → cinematic low-key, deep
shadows). Capture the authentic region/setting, genre, emotional tone, palette, lens and composition.

PHOTOREALISM (critical — this is what makes it look premium, not "AI"): write for a real PHOTOGRAPH,
not an illustration. Name a real camera + lens or film stock, natural/practical lighting, authentic
location detail, real skin texture with small imperfections, true depth of field. It must read as
shot on a film set — NEVER a 3D render, CGI, digital art, anime, cartoon or video-game frame.

SHOT & LOCATION VARIETY (critical — the deck must NOT repeat the same dark street or framing): each
slide uses a DIFFERENT shot type and, wherever the story allows, a DIFFERENT location from its world
(wide establishing, character close-up, over-the-shoulder, action beat, quiet emotional moment,
conflict, object/detail, final hopeful frame). Honor the SHOT specified for THIS slide below, and
pick a fresh location rather than reusing one another slide already used. Market / budget / team
slides are intentionally MINIMAL and clarity-first — restrained, plain, lots of empty space.

ALWAYS weave in, explicitly: subject · setting · mood · lighting · camera angle · lens (e.g.
anamorphic, 35mm, 85mm) · composition WITH a deliberate clean, EMPTY, uncluttered area of the frame ·
colour palette · texture/grain · and a film-still / editorial-photography realism level, plus a
cinematic reference feel. The result must read like a premium cinematic film still, and must NOT
look: glossy, plastic, generic-AI, over-saturated, deformed, cartoonish, or like a stock photo.
NEVER describe a poster, title card, credits, typography or any lettering — those induce garbled
text in the render; the frame must be a clean photograph with NO text anywhere.

HARD RULES: the image must contain NO text, letters, words, captions, watermarks or logos; NO
real-person likeness; NO minors; film-still quality.

Return ONLY JSON: {"prompt": "<one cohesive prompt, ~40-70 words, comma-separated descriptors>"}
"""


# The extracted fields each slide's IMAGE depicts — its visual "placeholders". Kept parallel to
# content.py's _SLIDE_FIELDS so a slide's ART and its COPY are driven by the SAME material.
_SLIDE_IMAGE_FIELDS: dict[str, list[str]] = {
    "cover": ["storyWorld", "logline", "genreBlend"],
    "logline": ["storyWorld", "logline"],
    "genre_blend": ["genreBlend", "storyWorld"],
    "synopsis": ["storyWorld", "keyScenes"],
    "story_world": ["storyWorld", "keyScenes"],
    "character": ["mainCharacters", "characterDynamics", "storyWorld"],
    "supporting_characters": ["supportingCharacters", "characterDynamics", "storyWorld"],
    "usp": ["storyWorld", "genreBlend"],
    "show_cross": ["storyWorld", "genreBlend"],
    "visual_aesthetic": ["visualAesthetic", "designDirection", "storyWorld"],
    "target_audience": ["storyWorld"],
    "budget": ["storyWorld"],
    "market_potential": ["storyWorld"],
    "directors_vision": ["designDirection", "storyWorld", "themes"],
    "team": ["storyWorld"],
    "contact": ["storyWorld"],
    "generic": ["storyWorld", "logline"],
}

# The deck's VISUAL IDENTITY — carried on EVERY slide's image prompt so all art shares one look
# (this is what keeps the deck consistent slide to slide).
_VISUAL_IDENTITY_FIELDS = ["visualAesthetic", "colorPalette", "textureStyle", "visualMood",
                           "visualReferences", "designDirection", "tone", "themes"]

_FIELD_LABELS = {
    "title": "Title", "logline": "Logline", "synopsis": "Synopsis", "genreBlend": "Genre",
    "tone": "Tone", "themes": "Themes", "storyWorld": "Setting / world", "keyScenes": "Key scenes",
    "mainCharacters": "Main characters", "supportingCharacters": "Supporting characters",
    "characterDynamics": "Character dynamics", "visualMood": "Visual mood",
    "visualAesthetic": "Visual aesthetic", "colorPalette": "Colour palette",
    "textureStyle": "Texture / finish", "visualReferences": "Visual references",
    "designDirection": "Design direction",
}


def _ctx_lines(intake: dict, keys: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for k in keys:
        if k in seen:
            continue
        seen.add(k)
        v = _g(intake, k)
        if v:
            out.append(f"- {_FIELD_LABELS.get(k, k)}: {v}")
    return out


def _story_context(intake: dict, slide_type: str | None = None) -> str:
    """Per-slide image grounding: WHAT this slide depicts (its own fields) + the deck's constant
    VISUAL IDENTITY (the same look on every slide). Parallel to content.py so art and copy stay
    consistent and on-theme across the whole deck."""
    subject = _ctx_lines(intake, _SLIDE_IMAGE_FIELDS.get(slide_type or "",
                                                         ["storyWorld", "logline", "synopsis"]))
    look = _ctx_lines(intake, _VISUAL_IDENTITY_FIELDS)
    parts: list[str] = []
    if subject:
        parts.append("WHAT THIS SLIDE DEPICTS:\n" + "\n".join(subject))
    if look:
        parts.append("DECK VISUAL IDENTITY (identical on every slide — match it exactly):\n"
                     + "\n".join(look))
    return "\n\n".join(parts) or "- (no summary captured yet)"


def _slide_brief(content: dict | None) -> str:
    """What is actually on this slide — so the image matches the slide's real copy/characters."""
    content = content or {}
    bits: list[str] = []
    for k in ("heading", "subheading", "body"):
        v = content.get(k)
        if isinstance(v, str) and v.strip():
            bits.append(v.strip())
    chars = content.get("characters")
    if isinstance(chars, list):
        for c in chars[:4]:
            if isinstance(c, dict):
                line = f"{c.get('name', '')} — {c.get('role', '')}: {c.get('description', '')}"
                line = line.strip(" —:")
                if line:
                    bits.append(line)
    return " | ".join(bits)


def build_prompt(slide_type: str, intake: dict, design: dict | None = None,
                 content: dict | None = None, use_llm: bool = True,
                 has_references: bool = False) -> str:
    """Story-grounded diffusion prompt for one slide.

    Uses the LLM (grounded in the film summary + this slide's content + design); falls back to the
    deterministic register-anchored prompt offline. ``use_llm=False`` forces the fallback (used for
    cheap workshop seed prompts that get replaced at generation time).

    ``has_references=True`` means the director's reference images are being attached to the image
    model directly — so the prompt tells the model to MATCH them and stops forcing the deck's
    default dark theme (which previously overrode warm/bright references)."""
    design = design or {}
    if not use_llm:
        return _single_frame(_deterministic_prompt(slide_type, intake, design, has_references))

    kind = image_kind(slide_type)
    if has_references:
        theme = (
            "MATCH THE ATTACHED REFERENCE IMAGES above all — reproduce their palette, light, grade, "
            "grain and graphic treatment. Do NOT impose a dark or low-key look if the references "
            "are bright or warm."
        )
    elif _is_light_theme(design):
        theme = "LIGHT — bright, high-key, airy, luminous, clean (NOT dark or moody)"
    else:
        theme = "DARK — cinematic low-key, dramatic directional light, deep shadows"
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])
    medium = _visual_medium(intake, design)
    medium_line = (
        f"\n\nRENDER MEDIUM OVERRIDE (HIGHEST PRIORITY): the director chose a {medium[0]} visual "
        f"style. IGNORE every instruction to be photorealistic / cinematic / live-action / a film "
        f"still. Write the prompt for a {medium[0]} image — {medium[1]}. The ENTIRE image must be "
        f"in {medium[0]} style."
        if medium else ""
    )
    prompt = (
        "FILM SUMMARY (ground every visual in this; never invent unrelated elements):\n"
        f"{_story_context(intake, slide_type)}\n\n"
        f"THIS SLIDE: type={slide_type}, image kind={kind}.\n"
        f"On the slide: {_slide_brief(content) or '(use the summary above)'}\n\n"
        f"SHOT FOR THIS SLIDE (use this framing, and a DIFFERENT location than other slides): "
        f"{_shot_for(slide_type)}\n"
        f"MAKE THIS FRAME DISTINCT ({_facet_for(slide_type)}) — it MUST NOT look like a repeat of "
        f"another slide. Vary the time of day, distance and focal subject accordingly.\n"
        f"THEME: {theme}\n"
        f"PALETTE: {palette or '(use a fitting palette)'}"
        f"{medium_line}\n\n"
        "Write ONE image-generation prompt for this slide's artwork. Return ONLY the JSON."
    )
    result = complete_json(
        system=_SYSTEM_IMG,
        prompt=prompt,
        cache_prefix="image_prompt",
        max_tokens=400,
        temperature=0.85,
        fallback=lambda: {"prompt": _deterministic_prompt(slide_type, intake, design, has_references)},
    )
    text = ""
    if isinstance(result, dict) and isinstance(result.get("prompt"), str):
        text = result["prompt"].strip()
    if not text:
        text = _deterministic_prompt(slide_type, intake, design, has_references)
    final = _clean(text)
    if medium:
        # Lead with the medium so the diffusion model weights it heavily (overrides any
        # photoreal wording the writer may have slipped in).
        final = f"{medium[1]}. {final}"
    return _single_frame(final)


# Diffusion models (esp. at wide 16:9 with "anamorphic/ultra-wide" wording) love to split the
# canvas into two side-by-side scenes — a diptych with a hard seam down the middle. FLUX ignores
# negative prompts, so we enforce a single unbroken frame in the POSITIVE prompt instead.
_SINGLE_FRAME_GUARD = (
    "one single continuous cinematic frame, one unified scene edge to edge, "
    "no split-screen, no diptych, no collage, no side-by-side panels, no mirrored halves, "
    "no vertical seam or divider down the middle"
)


def _single_frame(prompt: str) -> str:
    return f"{prompt.rstrip(' ,.')}, {_SINGLE_FRAME_GUARD}"


# Per-genre VISUAL character, so each genre tile on the genre-blend slide actually looks like THAT
# genre — not a relabelled copy of the same shot. Matched fuzzily against the tile's title; ordered
# so DISTINCTIVE genres win over the broad ones (comedy/drama) for compound titles like
# "Sports Drama" or "Crime Thriller".
_GENRE_CUES: dict[str, str] = {
    "crime": "tense neo-noir, shadowy high-contrast lighting, a charged criminal confrontation, "
             "gritty underworld texture",
    "thriller": "suspenseful and taut, cold desaturated palette, a moment of danger or pursuit, "
                "hard directional light and deep shadows",
    "horror": "dread and unease, deep shadows and negative space, an eerie threatening atmosphere, "
              "cold desaturated tones",
    "mystery": "moody and enigmatic, low-key lighting, a sense of secrets and investigation, fog "
               "and shadow",
    "noir": "classic film-noir, stark chiaroscuro, rain-slick streets, venetian-blind shadows",
    "sci": "atmospheric tech-noir, cool blue palette, scale and futurism, volumetric light",
    "fantasy": "epic and otherworldly, rich painterly light, a sense of myth and scale",
    "action": "kinetic and high-stakes, dynamic motion, an explosive set-piece beat, bold energy",
    "adventure": "sweeping and expansive, golden-hour vistas, a sense of journey and scale",
    "war": "harsh and visceral, smoke and grit, desaturated battlefield palette, weight and tension",
    "western": "sun-bleached and rugged, wide arid vistas, dust and long shadows",
    "sport": "dynamic and triumphant, stadium light, sweat and motion, a charged athletic moment",
    "musical": "vibrant and theatrical, saturated colour, rhythm and movement, stage-lit energy",
    "biopic": "dignified period detail, naturalistic portrait light, an authentic era-true moment",
    "doc": "observational and candid, available natural light, unstaged real-world texture",
    "rom": "tender and warm, an intimate two-person moment, golden soft light, emotional closeness",
    "comedy": "light-hearted and warm, a playful or absurd comedic beat, bright high-key lighting, "
              "lively expressions and kinetic energy",
    "drama": "intimate and emotional, a quiet poignant character moment, soft naturalistic light, "
             "restrained and human",
}


def _genre_cue(title: str) -> str:
    t = (title or "").lower()
    for key, cue in _GENRE_CUES.items():
        if key in t:
            return cue
    return ""


def build_item_prompt(item: dict, intake: dict, design: dict | None = None,
                      has_references: bool = False) -> str:
    """Diffusion prompt for ONE grid item — a genre tile on the genre-blend slide. Each tile must
    visually EMBODY its own genre (comedy looks comedic, crime looks like crime), grounded in the
    film's world, so the three tiles read as distinct. Deterministic (no LLM), cheap per item."""
    design = design or {}
    title = str((item or {}).get("title") or "").strip()
    desc = str((item or {}).get("description") or "").strip()
    region = _g(intake, "storyWorld")
    logline = _g(intake, "logline")
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])
    cue = _genre_cue(title)

    if has_references:
        grade = "colour and grade matching the supplied reference images"
    elif _is_light_theme(design):
        grade = "bright high-key natural light, airy"
    else:
        grade = "cinematic film grade, deep shadows, atmospheric haze"

    parts = [
        (f"a cinematic film still that visually EMBODIES the {title} genre"
         if title else "a cinematic film still from the story's world"),
        # The genre's distinct visual character — this is what makes each tile its OWN genre.
        cue or desc,
        # Ground it in THIS film's world so the tiles still belong to the story.
        (f"a {title.lower()} moment set in {region}" if region and title
         else f"set in {region}" if region else logline),
        grade,
        f"color palette: {palette}" if palette else "",
        "single strong focal point, shallow depth of field, professional cinematography, film grain, "
        "photorealistic film photograph, real-location detail, not an illustration, not a 3D render, "
        "no text, no watermark, no logo, no real-person likeness",
    ]
    return _clean(", ".join(p for p in parts if p))


def build_character_prompt(char: dict, intake: dict, design: dict | None = None,
                           has_references: bool = False) -> str:
    """Cinematic portrait for ONE character card — evocative of their role/description in the
    film's world. Deliberately uses NO real name (and forbids real-person likeness) so the model
    renders an original, story-true face rather than a celebrity lookalike."""
    design = design or {}
    role = str((char or {}).get("role") or "").strip()
    desc = str((char or {}).get("description") or "").strip()
    appearance = str((char or {}).get("appearance") or "").strip()
    region = _g(intake, "storyWorld")
    tone = _g(intake, "tone")
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])

    if has_references:
        lighting = "lighting and grade matching the supplied reference images"
    elif _is_light_theme(design):
        lighting = "bright high-key portrait light, soft and clean"
    else:
        lighting = "dramatic low-key portrait light, deep shadows, rim light"

    parts = [
        "cinematic character portrait, evocative and atmospheric",
        # Appearance leads so the face matches the character's age, build and defining look.
        appearance,
        f"a {role}" if role else "a central character of the story",
        desc,
        f"set in {region}" if region else "",
        lighting,
        f"emotional tone: {tone}" if tone else "",
        f"color palette: {palette}" if palette else "",
        "true to the stated age and physique, shallow depth of field, 85mm portrait lens, film "
        "grain, photorealistic film photograph, real skin texture and pores, candid expression, not "
        "an illustration, not a 3D render, fictional original face, no real-person likeness, no "
        "celebrity, no text, no watermark, no logo",
    ]
    return _clean(", ".join(p for p in parts if p))


def build_mood_prompt(block: dict, intake: dict, design: dict | None = None,
                      has_references: bool = False) -> str:
    """One moodboard frame for the visual-aesthetic grid — texture/light/atmosphere of the film's
    world (no people, no text), themed by the block's label."""
    design = design or {}
    label = str((block or {}).get("label") or "").strip()
    region = _g(intake, "storyWorld")
    mood = _g(intake, "visualMood") or _g(intake, "visualAesthetic")
    palette = ", ".join(c.get("name", "") for c in (design.get("palette") or [])[:4])

    if has_references:
        lighting = "lighting, colour and grade matching the supplied reference images"
    elif _is_light_theme(design):
        lighting = "bright high-key natural light, airy"
    else:
        lighting = "moody cinematic light, deep shadows"

    subject = f"moodboard frame evoking '{label}'" if label else "moodboard frame"
    parts = [
        f"atmospheric {subject}, texture and light study, evocative macro detail, no people",
        f"from the world of {region}" if region else "",
        mood,
        lighting,
        f"color palette: {palette}" if palette else "",
        "photorealistic cinematic film still, real photograph, film grain, not an illustration, "
        "not a 3D render, no text, no watermark, no logo",
    ]
    return _clean(", ".join(p for p in parts if p))
