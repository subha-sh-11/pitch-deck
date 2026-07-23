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
    infer_brightness,
    select_register,
)

# Display fonts the frontend can actually load, and graphic motifs it can render. The LLM is
# constrained to these so a reference-driven choice always maps to something renderable.
_VALID_FONTS = {"cormorant", "playfair", "oswald", "poppins", "anton"}
_VALID_MOTIFS = {"film_strip", "grain", "vignette", "frame"}

# Per-build "take" axes: the build token deterministically assigns one of each, so two builds
# of the same brief diverge on purpose instead of both converging to the register's default
# look. Accents are FAMILIES the model tunes to the story (a crime noir picks the grittiest
# member of "warm ember"; a romance the softest), never literal hex values.
_ACCENT_TAKES = [
    "warm ember — amber / burnt copper / rust",
    "cold electric — teal / cyan / ice blue",
    "sodium night — tungsten gold / burnt yellow",
    "blood signal — crimson / vermilion / oxblood",
    "dusk violet — plum / magenta / bruised purple",
    "verdigris — sea green / oxidised bronze",
]
_COMPOSITION_TAKES = [
    "high-contrast graphic — hard shadows, bold blocking, poster-like negative space",
    "tonal atmospheric — layered gradients, soft light falloff, immersive full-bleed imagery",
    "editorial minimal — restrained ink-on-paper feel, generous whitespace, precise hierarchy",
    "textured tactile — heavy grain, print texture, weathered surfaces, analogue warmth",
]


_SYSTEM = (
    "You are a film art director designing the complete visual identity for a cinematic pitch deck "
    "— the kind a director carries into a studio meeting. This is NOT a business presentation: it "
    "is a piece of visual storytelling that must make a producer FEEL the film before a single "
    "scene is shot. You are given the project's genre, tone, intake notes (which may include "
    "observations from the director's own reference images — honour those above all), and a "
    "recommended style register with a base palette. The payload may also include a "
    "`referenceDeck` with the dominant colours (hex) and font names pulled from a deck the "
    "director uploaded — when present, ANCHOR the palette to those colours and echo those "
    "fonts in typography, so the result clearly resembles their reference, then refine for "
    "cinematic quality and contrast.\n"
    "Craft rules:\n"
    "  • GENRE REGISTER — tune the WHOLE system to the genre; do NOT default every deck to the "
    "same dark look. Crime/thriller/horror → dark, gritty, high-contrast, cold. Romance → warm, "
    "soft, airy. Comedy → bright, playful, saturated. Sports → energetic, punchy, motion. "
    "Mythology/fantasy → grand, rich, ornamental. Family/feel-good → warm and luminous. Match the "
    "story's emotional temperature, not a house style. The payload's targetBrightness "
    "(light | dark | neutral) is BINDING: light -> light/warm slide grounds, dark -> deep dark "
    "grounds, neutral -> tasteful mid-tones; never force near-black on a light or neutral brief.\n"
    "  • PALETTE (6 colors, real hex), covering these 5 ROLES at minimum: a base for slide grounds, "
    "primary text, secondary text, one signature accent that carries the story's emotional "
    "temperature, and a highlight/CTA. Build it like a colorist grading the film. The base is "
    "GENRE-TUNED, not dark-by-default: gritty crime/thriller/horror → deep dark grounds; "
    "romance/comedy/sports/feel-good → warm, bright or light grounds. When reference images are "
    "attached, take the base FROM THEM (warm/amber/light references → warm/amber/light grounds — "
    "never force a dark base over warm references). The text tone must CONTRAST the base (light "
    "text on a dark base, dark text on a light/warm base). NEVER make everything black — even a "
    "dark deck needs breathing space and tonal range. Name colors evocatively for THIS story "
    "('Monsoon Slate', not 'Dark Gray') and give each a concrete `usage` (backgrounds / headlines / "
    "captions / accents / highlight) so every slide applies them identically — consistency across "
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
    "in the deck feels pulled from the SAME film (consistent grade, grain, light). imageStyle is "
    "fed VERBATIM to a text-to-image diffusion model, so describe only photographic qualities and "
    "never use words like 'poster', 'title', 'typography', 'text' or 'lettering' in it — a "
    "diffusion model that reads them paints gibberish writing into the artwork.\n"
    "  • layoutStyle: the compositional philosophy — where negative space lives, how hierarchy "
    "flows, full-bleed vs framed imagery.\n"
    "  • rationale: one tight paragraph connecting every choice back to the story's emotion — "
    "why THIS look sells THIS film.\n"
    "REFERENCE IMAGES: if reference images are attached, they ARE the director's chosen look — "
    "read them and let them DRIVE the system. Sample the actual palette and make the slide "
    "BACKGROUND match the references' dominant ground (a warm amber reference → warm amber slide "
    "grounds, NOT near-black). Match the typography CHARACTER you see (bold condensed display vs "
    "elegant serif), the mood, and the graphic treatment. Prioritise what you SEE over the register.\n"
    "REFERENCE FIDELITY — read the director's notes (intake.designDirection) for HOW to use the "
    "references and calibrate: 'match exactly / follow this template / same style' → REPRODUCE the "
    "reference look faithfully (its palette, type character, composition habits become the system, "
    "applied consistently to every slide; layoutStyle should say 'uniform, template-faithful'); "
    "'inspiration / vibe / loosely' (or no note) → TRANSLATE the reference's feeling into an "
    "original system rather than copying it, and say so in the rationale.\n"
    "  • displayFont: the ONE display font that best matches the GENRE and look — exactly one of: "
    "cormorant, playfair, oswald, poppins, anton (oswald/anton = bold condensed, for crime / "
    "thriller / sports / action; cormorant/playfair = elegant serif, for romance / drama / period / "
    "mythology; poppins = clean modern, for comedy / contemporary / feel-good). Paired with a "
    "clean readable body face — never more than two faces total.\n"
    "  • motifs: recurring GRAPHIC motifs the deck should carry, each exactly one of: film_strip, "
    "grain, vignette, frame. Include a motif ONLY when the story/references genuinely call for it "
    "(a film-strip border for a filmmaking story, grain for a gritty look); use [] when none fit — "
    "never decorate gratuitously.\n"
    "Return ONLY JSON with keys: mood, cinematicTone, palette (array of {name, hex, usage}), "
    "typography ({headings, body, accents, treatment}), visualStyle (array), backgroundStyle, "
    "imageStyle, layoutStyle, displayFont, motifs (array), rationale."
)


def run(project: dict, intake: dict, reference_images: list[dict] | None = None,
        reference: dict | None = None, visual_profile: dict | None = None,
        variation: str | None = None) -> dict:
    """Design direction for the deck. ``reference_images`` ([{"mediaType","data": <base64>}]) are
    the director's visual-direction references; when present they're shown to the vision model so
    the palette, typography character and graphic motifs are pulled FROM the references.
    ``reference`` is a director-supplied reference DECK (extracted colours/fonts) the palette and
    typography are additionally anchored to. ``visual_profile`` is the reference_analysis agent's
    structured profile of the whole reference set — when present it is the BINDING synthesis of
    the references, and a slim copy is embedded in the result (``referenceProfile``) so every
    downstream consumer of the design dict (layout, content, image prompts, QA) reads it."""
    genres = project.get("genres") or []
    tone = project.get("tone") or []
    genre_blend = (intake or {}).get("genreBlend", "")
    register_id = select_register(genres, tone, genre_blend)
    fallback = lambda: design_direction_fallback(genres, tone, intake, register_id)

    reg = REGISTERS[register_id]
    payload = {
        "genres": genres,
        "tone": tone,
        # light | dark | neutral — the slide grounds MUST follow this. Pairs with the system
        # rule (genre-tuned, never dark-by-default) so instruction and grounding agree.
        "targetBrightness": infer_brightness(genres, tone, genre_blend),
        "intake": {k: (intake or {}).get(k) for k in
                   ("visualAesthetic", "colorPalette", "textureStyle", "visualMood",
                    "designDirection", "genreBlend")},
        "recommendedRegister": {"id": register_id, "label": reg["label"], "palette": reg["palette"]},
    }
    # Per-build variation: busts the 24h prompt cache (which otherwise replays the previous
    # build's design byte-for-byte) AND assigns a CONCRETE take. A polite "please vary" nudge
    # measurably converges back to the same look — the genre prior is that strong — so the
    # token deterministically picks an accent family + composition philosophy for this build.
    if variation:
        try:
            take_n = int(variation, 16)
        except ValueError:
            take_n = abs(hash(variation))
        accent = _ACCENT_TAKES[take_n % len(_ACCENT_TAKES)]
        philosophy = _COMPOSITION_TAKES[(take_n // 13) % len(_COMPOSITION_TAKES)]
        payload["freshTake"] = {
            "token": variation,
            "assignedTake": {"accentFamily": accent, "compositionPhilosophy": philosophy},
            "note": ("This is a NEW build. EXECUTE the assignedTake: build the signature accent "
                     "from the assigned accent family (tuned to this story's temperature) and "
                     "let the assigned composition philosophy drive layoutStyle, backgroundStyle "
                     "and visualStyle — so this build is visibly a different deck from any other "
                     "build of the same brief. Genre register and targetBrightness stay binding. "
                     "If the director supplied references or an explicit palette, THOSE win over "
                     "the accent assignment — express the take through composition and pacing "
                     "instead. When two display faces fit the genre equally, let the take pick "
                     "the one it suits better."),
        }
    if reference_images:
        payload["note"] = ("Reference images are ATTACHED — extract the palette, typography "
                           "character, mood and graphic motifs from them and prioritise them.")
    # A director-supplied reference deck: anchor the palette/typography to its real
    # colours and fonts so the generated deck looks like the one they handed us.
    if reference and (reference.get("colors") or reference.get("fonts")):
        payload["referenceDeck"] = {
            "colors": (reference.get("colors") or [])[:6],
            "fonts": (reference.get("fonts") or [])[:3],
        }
    # The reference_analysis agent's synthesis of the WHOLE reference set. It has already
    # resolved multi-reference conflicts and per-reference roles, so it is BINDING: the design
    # system must execute this profile (the raw images remain attached for visual grounding).
    from app.ai.agents.reference_analysis import slim as _slim_profile

    profile_slim = _slim_profile(visual_profile)
    if profile_slim:
        payload["visualProfile"] = profile_slim
        payload["visualProfileNote"] = (
            "visualProfile is the analysed synthesis of the director's references — treat every "
            "field as a binding design decision: palette from its dominant/accent colours and "
            "ground, typography matching its character/scale, layoutStyle executing its "
            "layout/composition (density, whitespace, symmetry, image-to-text ratio), "
            "backgroundStyle/imageStyle matching its imageTreatment and surface language."
        )
    result = complete_json(
        system=_SYSTEM,
        prompt="Design brief:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=fallback,
        # Reference-anchored designs (deck or images) must not collide with the cached generic one.
        cache_prefix="design:ref" if (payload.get("referenceDeck") or reference_images
                                      or profile_slim) else "design",
        images=reference_images,
        # A fresh build should actually explore — default temperature converges on the
        # register's house look even with an assigned take.
        **({"temperature": 0.85} if variation else {}),
    )
    if isinstance(result, dict):
        result.setdefault("_register", register_id)
        # Ride the build token on the design dict itself (like referenceProfile): layout,
        # content, image prompts and diffusion seeds all receive `design`, so one token
        # varies the whole pipeline per build with no extra plumbing.
        if variation:
            result["buildSeed"] = variation
        # Carry the profile on the design itself: deck.design_direction persists it, and every
        # downstream agent that receives `design` (layout, content, image prompts, QA) can read
        # design["referenceProfile"] with no extra plumbing.
        if profile_slim:
            result["referenceProfile"] = profile_slim
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
