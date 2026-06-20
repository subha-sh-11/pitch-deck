"""Design Direction agent → DesignDirection (palette, typography, visual language).

This is the agent that "determines the visual representation from genre/tone". It always
starts from the matched style register (a strong prior) and, when an LLM is available,
refines the language while keeping a coherent, genre-appropriate palette.
"""
from __future__ import annotations

import json

from app.ai.llm import complete_json
from app.ai.registers import (
    FONT_BY_REGISTER,
    REGISTERS,
    design_direction_fallback,
    select_register,
)

# Display fonts the frontend can actually load, and graphic motifs it can render. The LLM is
# constrained to these so a reference-driven choice always maps to something renderable.
_VALID_FONTS = {"cormorant", "playfair", "oswald", "poppins", "anton"}
_VALID_MOTIFS = {"film_strip", "grain", "vignette", "frame"}


_SYSTEM = (
    "You are a film art director designing the complete visual identity for a cinematic pitch deck "
    "— the kind a director carries into a studio meeting. This is NOT a business presentation: it "
    "is a piece of visual storytelling that must make a producer FEEL the film before a single "
    "scene is shot. You are given the project's genre, tone, intake notes (which may include "
    "observations from the director's own reference images — honour those above all), and a "
    "recommended style register with a base palette.\n"
    "Craft rules:\n"
    "  • PALETTE (6 colors, real hex): build it like a colorist grading the film — a dominant base "
    "for slide grounds (DARK by default, BUT when reference images are attached take the base FROM "
    "THEM: if the references are warm/amber/light, the slide grounds must be warm/amber/light too — "
    "never force a dark base over warm references), one signature accent that carries the story's "
    "emotional temperature, supporting mid-tones, and a text tone that CONTRASTS the base (light "
    "text on a dark base, dark text on a light/warm base). Name colors evocatively for THIS "
    "story ('Monsoon Slate', not 'Dark Gray') and give each a concrete `usage` (backgrounds / "
    "headlines / accents / captions) so every slide applies them identically — consistency across "
    "the deck is the difference between curated and assembled.\n"
    "  • cinematicTone: the deck's emotional register in one line, as a DP would describe the "
    "film's look.\n"
    "  • TYPOGRAPHY: choose with intent — headings that carry the genre's voice (epic serif, "
    "brutalist sans, elegant editorial), body built for fast producer reading, accents (caps "
    "tracking, numerals) used sparingly; `treatment` states the rule, e.g. 'oversized serif "
    "headlines, generous tracking on caps labels, never more than two faces'.\n"
    "  • visualStyle: 3-5 precise art-direction phrases a designer could execute (composition "
    "habits, image treatment, graphic motifs) — not vague adjectives.\n"
    "  • backgroundStyle / imageStyle: how slide grounds and imagery are treated so every image "
    "in the deck feels pulled from the SAME film (consistent grade, grain, light).\n"
    "  • layoutStyle: the compositional philosophy — where negative space lives, how hierarchy "
    "flows, full-bleed vs framed imagery.\n"
    "  • rationale: one tight paragraph connecting every choice back to the story's emotion — "
    "why THIS look sells THIS film.\n"
    "REFERENCE IMAGES: if reference images are attached, they ARE the director's chosen look — "
    "read them and let them DRIVE the system. Sample the actual palette and make the slide "
    "BACKGROUND match the references' dominant ground (a warm amber reference → warm amber slide "
    "grounds, NOT near-black). Match the typography CHARACTER you see (bold condensed display vs "
    "elegant serif), the mood, and the graphic treatment. Prioritise what you SEE over the register.\n"
    "  • displayFont: the ONE display font that best matches the look — exactly one of: cormorant, "
    "playfair, oswald, poppins, anton (oswald/anton = bold condensed; cormorant/playfair = elegant "
    "serif; poppins = clean modern).\n"
    "  • motifs: recurring GRAPHIC motifs the deck should carry, each exactly one of: film_strip, "
    "grain, vignette, frame. Include a motif ONLY when the story/references genuinely call for it "
    "(a film-strip border for a filmmaking story, grain for a gritty look); use [] when none fit — "
    "never decorate gratuitously.\n"
    "Return ONLY JSON with keys: mood, cinematicTone, palette (array of {name, hex, usage}), "
    "typography ({headings, body, accents, treatment}), visualStyle (array), backgroundStyle, "
    "imageStyle, layoutStyle, displayFont, motifs (array), rationale."
)


def run(project: dict, intake: dict, reference_images: list[dict] | None = None) -> dict:
    """Design direction for the deck. ``reference_images`` ([{"mediaType","data": <base64>}]) are
    the director's visual-direction references; when present they're shown to the vision model so
    the palette, typography character and graphic motifs are pulled FROM the references."""
    genres = project.get("genres") or []
    tone = project.get("tone") or []
    register_id = select_register(genres, tone, (intake or {}).get("genreBlend", ""))
    fallback = lambda: design_direction_fallback(genres, tone, intake, register_id)

    reg = REGISTERS[register_id]
    payload = {
        "genres": genres,
        "tone": tone,
        "intake": {k: (intake or {}).get(k) for k in
                   ("visualAesthetic", "colorPalette", "textureStyle", "visualMood",
                    "designDirection", "genreBlend")},
        "recommendedRegister": {"id": register_id, "label": reg["label"], "palette": reg["palette"]},
    }
    if reference_images:
        payload["note"] = ("Reference images are ATTACHED — extract the palette, typography "
                           "character, mood and graphic motifs from them and prioritise them.")
    result = complete_json(
        system=_SYSTEM,
        prompt="Design brief:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=fallback,
        cache_prefix="design",
        images=reference_images,
    )
    if isinstance(result, dict):
        result.setdefault("_register", register_id)
        # Font: honour the LLM's reference-matched displayFont when valid, else the register default.
        df = str(result.get("displayFont") or "").strip().lower()
        display = df if df in _VALID_FONTS else FONT_BY_REGISTER.get(register_id, "cormorant")
        result["fonts"] = {"display": display, "body": "sans"}
        # Motifs: keep only ones the frontend can render; default to none.
        motifs = result.get("motifs")
        result["motifs"] = (
            [m for m in motifs if isinstance(m, str) and m in _VALID_MOTIFS]
            if isinstance(motifs, list) else []
        )
    return result
