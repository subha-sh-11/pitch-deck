"""Design Candidates agent → 4-5 distinct, story-grounded visual SYSTEMS to choose from.

Where `design.py` picks ONE direction, this proposes several complete visual identities (a
"template" each: palette, typography/fonts, visual language, layout, image style + a one-line
vibe so the director instantly gets the feeling). Grounded in the film summary; falls back to the
built-in style registers (which are themselves complete systems) when no LLM is available.
"""
from __future__ import annotations

import json
from typing import Any

from app.ai.llm import complete_json
from app.ai.registers import (
    FONT_BY_REGISTER,
    REGISTERS,
    design_direction_fallback,
    select_register,
)

_VALID_FONTS = set(FONT_BY_REGISTER.values()) | {"cormorant", "playfair", "oswald", "poppins", "anton"}
_VALID_MOTIFS = {"film_strip", "grain", "vignette", "frame"}

_SYSTEM = (
    "You are an art director proposing SEVERAL distinct visual systems ('templates') for a cinematic "
    "film pitch deck, so the director can choose the direction that fits their story. You are given "
    "the film's summary (story, genre, tone, audience, mood) and a set of base style registers.\n\n"
    "Produce 4-5 candidates that are GENUINELY DIFFERENT from each other — different moods, palettes, "
    "typography, and layout philosophy — yet each one a credible, coherent fit for THIS story. Each "
    "candidate is a COMPLETE visual system, not just a background colour: palette, typography, visual "
    "language, layout behaviour and image treatment that stay consistent across every slide.\n\n"
    "For EACH candidate:\n"
    "  - label: a short evocative name for the look ('Monsoon Noir', 'Sunlit Ensemble').\n"
    "  - vibe: ONE line naming the genre/feeling so anyone seeing it instantly gets it ('gritty "
    "neo-noir crime', 'warm feel-good comedy', 'premium prestige drama').\n"
    "  - font: the display font, ONE of exactly: cormorant, playfair, oswald, poppins, anton.\n"
    "  - design: { mood, cinematicTone, palette (6 × {name, hex, usage}), typography ({headings, "
    "body, accents, treatment}), visualStyle (array of 3-5 art-direction phrases), backgroundStyle, "
    "imageStyle, layoutStyle, motifs, rationale }.\n"
    "  - motifs (inside design): graphic motifs that system carries, each one of exactly: "
    "film_strip, grain, vignette, frame; use [] when none fit.\n"
    "PALETTE RULES: include one entry with usage 'background' (the slide base), one 'text', one "
    "'accent'; real 6-digit hex; name colours evocatively for THIS story. Vary brightness ACROSS "
    "candidates — include at least one LIGHT system (light background) and at least one DARK one so "
    "the director has a real choice.\n"
    "REFERENCE IMAGES: if reference images are attached, make at least ONE candidate that closely "
    "MATCHES them — sample their palette, typography character and motifs — so the director can pick "
    "the exact look they referenced.\n\n"
    "Return ONLY JSON: { \"candidates\": [ {\"id\", \"label\", \"vibe\", \"font\", \"design\": {...}}, ... ] }"
)


def _ranked_registers(genres: list[str], tone: list[str], extra: str) -> list[str]:
    """Best-fit register first, then the rest — for a diverse fallback set."""
    primary = select_register(genres, tone, extra)
    return [primary] + [r for r in REGISTERS if r != primary]


def _fallback(genres: list[str], tone: list[str], intake: dict) -> dict:
    """Offline: turn the top registers into distinct candidates (each a real visual system)."""
    extra = (intake or {}).get("genreBlend", "")
    out: list[dict[str, Any]] = []
    for rid in _ranked_registers(genres, tone, extra)[:5]:
        reg = REGISTERS[rid]
        out.append({
            "id": rid,
            "label": reg["label"],
            "vibe": reg["mood"],
            "font": FONT_BY_REGISTER.get(rid, "cormorant"),
            "design": design_direction_fallback(genres, tone, intake, rid),
        })
    return {"candidates": out}


def _normalize(result: dict, genres: list[str], tone: list[str], intake: dict) -> dict:
    """Guarantee each candidate is renderable: valid fonts, an id, and a usable design."""
    cands = (result or {}).get("candidates")
    if not isinstance(cands, list) or not cands:
        return _fallback(genres, tone, intake)
    clean: list[dict[str, Any]] = []
    for i, c in enumerate(cands[:5]):
        if not isinstance(c, dict):
            continue
        design = c.get("design")
        if not isinstance(design, dict) or not design.get("palette"):
            continue
        font = c.get("font")
        if font not in _VALID_FONTS:
            font = "cormorant"
        design["fonts"] = {"display": font, "body": "sans"}
        motifs = design.get("motifs")
        design["motifs"] = (
            [m for m in motifs if isinstance(m, str) and m in _VALID_MOTIFS]
            if isinstance(motifs, list) else []
        )
        design.pop("_register", None)
        clean.append({
            "id": str(c.get("id") or f"candidate-{i+1}"),
            "label": str(c.get("label") or f"Direction {i+1}"),
            "vibe": str(c.get("vibe") or ""),
            "design": design,
        })
    return {"candidates": clean} if clean else _fallback(genres, tone, intake)


def run(project: dict, intake: dict, reference_images: list[dict] | None = None) -> dict:
    """Return {"candidates": [{id, label, vibe, design}]} — 4-5 distinct visual systems.

    ``reference_images`` ([{"mediaType","data": <base64>}]): the director's references; when
    present they're shown to the vision model so at least one candidate matches their look."""
    genres = project.get("genres") or []
    tone = project.get("tone") or []
    summary = {k: (intake or {}).get(k) for k in (
        "title", "logline", "synopsis", "genreBlend", "tone", "themes", "storyWorld",
        "targetAudience", "visualMood", "visualAesthetic", "mainCharacters",
    )}
    registers = [
        {"id": rid, "label": reg["label"], "mood": reg["mood"], "palette": reg["palette"]}
        for rid, reg in REGISTERS.items()
    ]
    payload = {"summary": summary, "genres": genres, "tone": tone, "baseRegisters": registers}
    if reference_images:
        payload["note"] = "Reference images are attached — make at least one candidate match them."
    result = complete_json(
        system=_SYSTEM,
        prompt="Propose visual-system candidates for this film:\n"
        + json.dumps(payload, ensure_ascii=False),
        fallback=lambda: _fallback(genres, tone, intake),
        cache_prefix="design_candidates",
        max_tokens=3500,
        images=reference_images,
    )
    return _normalize(result if isinstance(result, dict) else {}, genres, tone, intake)
