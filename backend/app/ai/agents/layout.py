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


def _profile_traits(design: dict | None) -> dict:
    """Layout traits from the reference-derived visual profile (design["referenceProfile"]).

    The profile's structured layout fields (density / whitespace / imageToText / composition)
    are a much stronger signal than adjective-sniffing the design language, so when a director
    shared references these traits STEER the deck's pacing: quiet references → quiet deck,
    image-led references → full-bleed-leaning compositions, dense editorial references → denser
    split/framed compositions. Empty dict when no profile exists (no references shared).
    """
    profile = (design or {}).get("referenceProfile")
    if not isinstance(profile, dict):
        return {}
    layout = profile.get("layout") or {}
    comp = str(profile.get("composition") or "").lower()
    whitespace = str(layout.get("whitespace") or "").lower()
    density = str(layout.get("density") or "").lower()
    image_to_text = str(layout.get("imageToText") or "").lower()
    traits: dict = {}
    if whitespace == "high" or density == "minimal":
        traits["quiet"] = True
    if density == "dense" or whitespace == "low":
        traits["loud"] = True
    if "image-led" in image_to_text or "full-bleed" in comp or "full bleed" in comp:
        traits["image_led"] = True
    if "collage" in comp or "grid" in comp:
        traits["collage"] = True
    return traits


def run(slide_type: str, design: dict | None = None,
        content: dict | None = None, has_image: bool | None = None,
        rng: random.Random | None = None) -> dict:
    """Pick the layout variant for this slide from its content shape.

    ``has_image``: whether a generated image will be bound to this slide (known to the
    pipeline before the image URL exists on content). Falls back to content.imageUrl.
    ``rng``: a per-deck seeded generator. When provided, slide types with more than one
    renderable variant pick between them (content rules still win) so decks don't all
    open and read the same way; without it the choice stays deterministic (regen paths).
    """
    content = content or {}
    if has_image is None:
        has_image = bool(content.get("imageUrl"))
    layout_style = ((design or {}).get("layoutStyle") or "").lower()

    def pick(preferred: str, alternative: str, alt_chance: float) -> str:
        """Seeded variety between two RENDERABLE variants (frontend supports both)."""
        if rng is not None and rng.random() < alt_chance:
            return alternative
        return preferred

    layout_type = _LAYOUT_TYPE.get(slide_type, "text_led")

    if slide_type == "cover":
        # No image (or an explicitly centred/symmetric design language — NOT "asymmetric",
        # which contains the same substring) → typographic centre.
        centred_language = "centered" in layout_style or (
            "symmetr" in layout_style and "asymmetr" not in layout_style
        )
        if not has_image or centred_language:
            layout_type = "centered_title"
        else:
            layout_type = pick("full_bleed", "centered_title", 0.25)
    elif slide_type == "logline":
        # A long logline reads better anchored left with the rail; a tight one lands
        # centred like a title card — with an occasional rail treatment for variety.
        layout_type = "left_rail" if _text_len(content) > 140 else pick("centered_statement", "left_rail", 0.3)
    elif slide_type == "synopsis":
        # No image → don't render an empty image panel; go editorial columns. Very long
        # synopses also need the full width.
        if not has_image or _text_len(content) > 700:
            layout_type = "text_columns"
        else:
            layout_type = pick("split_image_text", "text_columns", 0.25)
    elif slide_type == "story_world":
        # Location cards want the bottom-anchored composition; pure prose over imagery
        # reads better in a side caption panel.
        items = content.get("items")
        if not (isinstance(items, list) and items) and has_image:
            layout_type = "caption_panel"
        elif has_image:
            layout_type = pick("atmospheric", "caption_panel", 0.25)
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


def plan_appearances(slide_types: list[str], design: dict | None = None,
                     seed: str | None = None, uniform: bool = False) -> list[dict]:
    """A per-deck VISUAL RHYTHM — one appearance per slide, planned for the whole deck at once.

    This is what makes two films' decks pace differently (DESIGN_BIBLE: per-film identity,
    layout variety, deck pacing) instead of every deck reusing the same fixed type→layout
    table. Seeded (e.g. with the deck id) so a build is reproducible, but every NEW build
    gets its own rhythm:
    - a deck-level personality (which variant text slides lean to, split-vs-framed
      preference, starting image side) drawn from the design language + seed;
    - image sides alternate through the deck; compositions never repeat back-to-back;
    - an occasional full-bleed punch beat mid-deck;
    - never three consecutive slides with the same style variant — contrast beats.

    ``uniform=True`` — TEMPLATE-FAITHFUL mode, for when the director said to follow their
    reference exactly: one consistent scheme across every slide (same composition family,
    same variant per role, sides still alternating for readability), no punch beats, no
    contrast injections — the deck reads as one rigorously applied template.
    """
    rng = random.Random(seed)

    if uniform:
        vs0 = (design or {}).get("visualStyle")
        mood0 = " ".join([
            str((design or {}).get("layoutStyle") or ""),
            " ".join(vs0) if isinstance(vs0, list) else str(vs0 or ""),
        ]).lower()
        quiet0 = _profile_traits(design).get("quiet") or any(
            w in mood0 for w in ("minimal", "negative space", "restrained", "quiet", "elegant"))
        text_variant = "minimal" if quiet0 else "standard"
        hero_variant0 = "standard" if quiet0 else "bold"
        comp0 = rng.choice(["split", "framed"])
        side0 = "left"
        plan0: list[dict] = []
        for st in slide_types:
            variant = hero_variant0 if st in _BOLD else ("minimal" if st in _MINIMAL else text_variant)
            appearance: dict = {"styleVariant": variant}
            if st in _COMPOSABLE:
                appearance["composition"] = comp0
                appearance["imageSide"] = side0
                side0 = "right" if side0 == "left" else "left"
            plan0.append(appearance)
        return plan0
    vs = (design or {}).get("visualStyle")
    mood = " ".join([
        str((design or {}).get("layoutStyle") or ""),
        " ".join(vs) if isinstance(vs, list) else str(vs or ""),
        str((design or {}).get("mood") or ""),
    ]).lower()
    # Reference-derived traits win over adjective-sniffing: when the director shared
    # references, their analysed layout grammar sets the deck's personality.
    traits = _profile_traits(design)
    quiet = traits.get("quiet") or any(
        w in mood for w in ("minimal", "negative space", "restrained", "quiet", "elegant"))
    loud = (traits.get("loud") and not traits.get("quiet")) or any(
        w in mood for w in ("bold", "poster", "maximal", "vibrant", "mass", "high-energy"))

    # Deck-level personality — per-film, seeded.
    base_text_variant = "minimal" if quiet else rng.choice(["standard", "minimal", "cinematic"])
    hero_variant = "bold" if loud else rng.choice(["bold", "cinematic"])
    prefer, alt = rng.choice([("split", "framed"), ("framed", "split")])
    side = rng.choice(["left", "right"])
    # Image-led references (full-bleed hero compositions) → the deck leans full-bleed:
    # cinematic text pacing and a much higher chance of full-bleed punch beats.
    image_led = bool(traits.get("image_led"))
    punch_chance = 0.4 if image_led else 0.18
    if image_led and base_text_variant == "standard":
        base_text_variant = "cinematic"

    plan: list[dict] = []
    last_comp: str | None = None
    last_variant: str | None = None
    variant_run = 0
    for slide_type in slide_types:
        if slide_type in _BOLD:
            variant = "standard" if quiet and slide_type != "cover" else hero_variant
        elif slide_type in _MINIMAL:
            variant = "minimal"
        else:
            variant = base_text_variant

        # Contrast beat: never three slides in a row with the same variant.
        if variant == last_variant:
            variant_run += 1
            if variant_run >= 2:
                variant = rng.choice([v for v in _STYLE_OPTIONS if v != variant])
                variant_run = 0
        else:
            variant_run = 0
        last_variant = variant

        appearance: dict = {"styleVariant": variant}
        if slide_type in _COMPOSABLE:
            comp = prefer if last_comp != prefer else alt
            # Occasional full-bleed punch beat (not on dense business slides, never twice in a
            # row) — much more frequent when the references are image-led/full-bleed.
            if slide_type not in ("budget", "team") and last_comp != "full" and rng.random() < punch_chance:
                comp = "full"
            appearance["composition"] = comp
            if comp != "full":
                appearance["imageSide"] = side
                side = "left" if side == "right" else "right"
            last_comp = comp
        plan.append(appearance)
    return plan


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
