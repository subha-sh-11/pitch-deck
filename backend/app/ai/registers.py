"""Cinematic style registers — genre/tone → palette, typography, and visual language.

Each register is a complete design prior. `select_register` scores the project's genre+tone
keywords to pick one; `design_direction_fallback` turns it into a full DesignDirection (camelCase)
when no LLM is available. When an LLM IS available, the chosen register is passed in as grounding so
the model refines rather than invents from scratch.
"""
from __future__ import annotations

from typing import Any

REGISTERS: dict[str, dict[str, Any]] = {
    "restrained_cinematic": {
        "label": "Restrained Cinematic",
        "mood": "Slow-burn, prestige, controlled tension",
        "cinematic_tone": "Restrained, atmospheric, emotionally grounded",
        "palette": [
            {"name": "Deep Black", "hex": "#0B0B0D", "usage": "Backgrounds"},
            {"name": "Charcoal", "hex": "#1E1F22", "usage": "Panels"},
            {"name": "Muted Gold", "hex": "#B8862F", "usage": "Accent"},
            {"name": "Bone White", "hex": "#EDE7DA", "usage": "Text"},
            {"name": "Slate Blue", "hex": "#3C4A5A", "usage": "Secondary"},
            {"name": "Ash Grey", "hex": "#6B6B6B", "usage": "Muted text"},
        ],
        "typography": {
            "headings": "High-contrast serif display, restrained weight",
            "body": "Clean humanist sans, generous leading",
            "accents": "Letter-spaced uppercase labels",
            "treatment": "Minimal, lots of negative space",
        },
        "visual_style": ["Single-source warm light", "Deep shadows", "35mm grain",
                          "Negative space", "Full-bleed atmosphere"],
        "background_style": "Dark textured, vignette, subtle grain",
        "image_style": "Desaturated, cinematic, realistic lighting, high tension",
        "layout_style": "Asymmetric, generous negative space, full-bleed imagery",
        "tags": ["drama", "horror", "thriller", "survival", "slow", "prestige", "dark",
                 "emotional", "art-house", "festival", "suspense", "claustrophobic", "noir"],
    },
    "editorial_warm": {
        "label": "Editorial Warm",
        "mood": "Warm, intimate, human",
        "cinematic_tone": "Tender, grounded, nostalgic",
        "palette": [
            {"name": "Warm Cream", "hex": "#F3E9D8", "usage": "Backgrounds"},
            {"name": "Terracotta", "hex": "#C16A4B", "usage": "Accent"},
            {"name": "Warm Brown", "hex": "#6B4A33", "usage": "Text"},
            {"name": "Sage", "hex": "#8A9A6B", "usage": "Secondary"},
            {"name": "Soft Gold", "hex": "#D9A441", "usage": "Highlight"},
            {"name": "Deep Teal", "hex": "#2F5A57", "usage": "Contrast"},
        ],
        "typography": {
            "headings": "Warm serif with character",
            "body": "Readable book sans",
            "accents": "Italic editorial captions",
            "treatment": "Editorial, magazine-like rhythm",
        },
        "visual_style": ["Golden-hour light", "Soft texture", "Intimate framing",
                         "Natural palette", "Lived-in detail"],
        "background_style": "Warm paper texture, soft gradients",
        "image_style": "Warm, naturalistic, soft contrast, human-centered",
        "layout_style": "Editorial grid, image-led story slides, breathing room",
        "tags": ["family", "romance", "drama", "warm", "emotional", "coming-of-age",
                 "slice-of-life", "romantic", "premium", "realistic"],
    },
    "high_contrast_genre": {
        "label": "High-Contrast Genre",
        "mood": "Bold, kinetic, dangerous",
        "cinematic_tone": "Urgent, high-stakes, punchy",
        "palette": [
            {"name": "Jet Black", "hex": "#050505", "usage": "Backgrounds"},
            {"name": "Blood Red", "hex": "#B22222", "usage": "Accent"},
            {"name": "Steel Grey", "hex": "#3A3F44", "usage": "Panels"},
            {"name": "Bright White", "hex": "#F5F5F5", "usage": "Text"},
            {"name": "Electric Blue", "hex": "#2B6CB0", "usage": "Highlight"},
            {"name": "Ember Orange", "hex": "#D9762B", "usage": "Secondary"},
        ],
        "typography": {
            "headings": "Condensed bold cinematic, tight tracking",
            "body": "Strong grotesque sans",
            "accents": "All-caps tactical labels",
            "treatment": "High contrast, hard edges",
        },
        "visual_style": ["Hard key light", "Deep blacks", "Bold silhouettes",
                         "Motion energy", "Saturated accents"],
        "background_style": "Dark high-contrast, dramatic gradients",
        "image_style": "High-contrast, punchy, dramatic, poster-like",
        "layout_style": "Poster covers, bold blocks, grid-based market slides",
        "tags": ["action", "thriller", "noir", "crime", "survival", "horror", "gritty",
                 "massy", "suspense", "urgent", "chaotic"],
    },
    "playful_bright": {
        "label": "Playful Bright",
        "mood": "Bright, joyful, energetic",
        "cinematic_tone": "Light, charming, upbeat",
        "palette": [
            {"name": "Sunny Yellow", "hex": "#F4C430", "usage": "Accent"},
            {"name": "Coral", "hex": "#FF6F61", "usage": "Highlight"},
            {"name": "Sky Blue", "hex": "#5BC0EB", "usage": "Secondary"},
            {"name": "Mint", "hex": "#9BE3A2", "usage": "Support"},
            {"name": "Cream", "hex": "#FFF7E6", "usage": "Backgrounds"},
            {"name": "Ink", "hex": "#2B2B2B", "usage": "Text"},
        ],
        "typography": {
            "headings": "Rounded friendly display",
            "body": "Cheerful geometric sans",
            "accents": "Playful pill labels",
            "treatment": "Bright, rounded, energetic",
        },
        "visual_style": ["Bright even light", "Saturated color", "Pop framing",
                         "Clean shapes", "Friendly motion"],
        "background_style": "Bright flat color, soft shapes",
        "image_style": "Bright, saturated, cheerful, clean",
        "layout_style": "Playful cards, bold color blocks, friendly grids",
        "tags": ["comedy", "romcom", "fun", "family", "bright", "entertainer",
                 "feel-good", "spiritual", "animation", "animated", "anime", "cartoon",
                 "toon", "manga", "2d", "3d", "kids", "cel"],
    },
    "pulp_stylized": {
        "label": "Pulp Stylized",
        "mood": "Stylized, lurid, genre-forward",
        "cinematic_tone": "Heightened, bold, unapologetic",
        "palette": [
            {"name": "Deep Purple", "hex": "#3B1E54", "usage": "Backgrounds"},
            {"name": "Neon Pink", "hex": "#E83E8C", "usage": "Accent"},
            {"name": "Toxic Green", "hex": "#4FB286", "usage": "Highlight"},
            {"name": "Gold", "hex": "#E2B15C", "usage": "Secondary"},
            {"name": "Jet Black", "hex": "#0A0A0A", "usage": "Contrast"},
            {"name": "Off White", "hex": "#EDE6F2", "usage": "Text"},
        ],
        "typography": {
            "headings": "Stylized display, genre swagger",
            "body": "Confident sans",
            "accents": "Neon-styled labels",
            "treatment": "Lurid contrast, stylized flair",
        },
        "visual_style": ["Colored gels", "Hard shadows", "Stylized grain",
                         "Bold silhouettes", "Genre iconography"],
        "background_style": "Saturated stylized gradients, texture",
        "image_style": "Stylized, saturated, genre-forward, poster art",
        "layout_style": "Pulp poster covers, bold stylized blocks",
        "tags": ["pulp", "gore", "fantasy", "spiritual", "stylized", "b-movie",
                 "exploitation", "crime", "horror"],
    },
}

DEFAULT_REGISTER = "restrained_cinematic"

# Display font per register (keys map to fonts loaded on the frontend).
FONT_BY_REGISTER: dict[str, str] = {
    "restrained_cinematic": "cormorant",
    "editorial_warm": "playfair",
    "high_contrast_genre": "oswald",
    "playful_bright": "poppins",
    "pulp_stylized": "anton",
}


def select_register(genres: list[str] | None, tone: list[str] | None, extra: str = "") -> str:
    """Score genre+tone keywords to pick the best-fit register id."""
    haystack = " ".join([*(genres or []), *(tone or []), extra]).lower()
    best, best_score = DEFAULT_REGISTER, -1
    for key, reg in REGISTERS.items():
        score = sum(1 for tag in reg["tags"] if tag in haystack)
        if score > best_score:
            best, best_score = key, score
    return best


def _parse_palette_override(raw: str) -> list[dict] | None:
    """Turn a free-text 'color_palette' field into tokens (names only, no hex)."""
    parts = [p.strip() for p in raw.replace("·", ",").split(",") if p.strip()]
    if not parts:
        return None
    return [{"name": p.title(), "hex": "", "usage": ""} for p in parts[:6]]


def design_direction_fallback(
    genres: list[str] | None,
    tone: list[str] | None,
    intake: dict | None,
    register_id: str | None = None,
) -> dict:
    """Deterministic DesignDirection (camelCase) derived from the matched register + intake."""
    intake = intake or {}
    reg_id = register_id or select_register(genres, tone, intake.get("genreBlend", ""))
    reg = REGISTERS[reg_id]

    visual = [s for s in [intake.get("visualAesthetic"), intake.get("visualMood")] if s]
    visual_style = reg["visual_style"] + visual

    rationale = (
        f"Matched the '{reg['label']}' register from the project's genre and tone. "
        f"{reg['mood']}. The palette and visual language keep every slide coherent while "
        f"honoring the story's emotional register."
    )

    return {
        "mood": intake.get("designDirection") or reg["mood"],
        "cinematicTone": reg["cinematic_tone"] + (f" — {', '.join(tone)}" if tone else ""),
        "palette": reg["palette"],
        "typography": {
            "headings": reg["typography"]["headings"],
            "body": reg["typography"]["body"],
            "accents": reg["typography"]["accents"],
            "treatment": reg["typography"]["treatment"],
        },
        "visualStyle": visual_style,
        "backgroundStyle": intake.get("textureStyle") or reg["background_style"],
        "imageStyle": reg["image_style"],
        "layoutStyle": reg["layout_style"],
        "rationale": rationale,
        "fonts": {"display": FONT_BY_REGISTER.get(reg_id, "cormorant"), "body": "sans"},
        "_register": reg_id,  # internal hint, dropped before API serialization
    }
