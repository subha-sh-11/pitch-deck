"""Reference Analysis agent → a structured VISUAL PROFILE from the director's references.

This is the dedicated reference-understanding stage that runs BEFORE deck generation.
It looks at every visual reference the director shared (inspiration images, mood boards,
posters, stills — plus the parsed .pptx reference deck's colours/fonts/structure) and
converts what it sees into a machine-usable design system: palette, typography character,
layout grammar, image treatment, composition habits, per-reference roles, and one unified
synthesis. Downstream agents (design, layout, content, image prompts, quality review) read
this profile instead of each re-interpreting the raw references, so the whole deck follows
ONE coherent, reference-derived visual language.

The profile is persisted on ``Project.visual_profile`` keyed by a fingerprint of the
reference set, so it is computed once per reference set and reused (and recomputed the
moment the director adds/removes references or changes their usage notes).

Contract mirrors the other agents: ``run()`` calls ``llm.complete_json`` with a
deterministic fallback, so a no-key environment still works.
"""
from __future__ import annotations

import hashlib
import json

from app.ai.llm import complete_json

_SYSTEM = """\
You are a senior production designer + art director analysing a director's visual references
for a cinematic pitch deck. The attached images (and any described reference deck) ARE the
director's chosen direction — your job is to READ their visual grammar precisely and encode it
as a structured profile that a design system can execute. Study them like a cinematographer and
an editorial designer at once.

ANALYSE (ground every field in what you actually observe — never generic filler):
- PALETTE: dominant colour families (real hex), supporting colours, accent colours, and whether
  grounds are dark / light / textured / image-based.
- TYPOGRAPHY: character (condensed bold / elegant serif / clean grotesque / handwritten…),
  scale (oversized display vs small editorial), hierarchy habits, casing, any type you SEE.
- LAYOUT: density (minimal vs dense), whitespace (low/medium/high), symmetry (symmetrical vs
  asymmetrical), grid habits, image-to-text ratio, how titles are positioned, how much text
  appears per composition.
- COMPOSITION: single hero images vs collages vs grids vs layered compositions; full-bleed vs
  framed; where negative space lives.
- IMAGE TREATMENT: cropping behaviour (tight close crops / wide cinematic), grading (warm, cold,
  high-contrast, muted), grain/texture, overlays/scrims, black-and-white vs colour.
- SURFACE LANGUAGE: borders, frames, masks, film-strip treatments, paper textures, gradients,
  decorative motifs, divider style.
- MOOD: the emotional temperature in a DP's words.

MULTI-REFERENCE SYNTHESIS — do not average everything blindly:
- Identify what is COMMON across the references (that becomes the core direction).
- Assign each reference a ROLE from what it is and any director notes: overall | palette |
  typography | layout | mood | image_treatment | character_slides | cover. When the director's
  notes name a purpose ("use this only for colour"), that note WINS over your inference.
- Assign each a WEIGHT: primary | secondary | supporting. A full deck/lookbook usually leads;
  single stills usually support.
- If references CONFLICT (e.g. one dark cinematic, one bright corporate), pick the dominant
  direction from weights + notes, note the conflict in `conflicts`, and fold the minority
  reference in only where it harmonises (e.g. its accent colour) — never a random mixture.

OUTPUT — return ONLY this JSON object (every value grounded in the references; use "" or []
when genuinely not inferable):
{
  "style": "<3-6 word design personality, e.g. 'cinematic, gritty, contemporary'>",
  "mood": "<one line, a DP describing the emotional temperature>",
  "palette": {
    "dominant": ["#hex", ...],           // 2-4
    "supporting": ["#hex", ...],         // 0-3
    "accent": ["#hex", ...],             // 1-2
    "ground": "dark | light | textured | image-based | mixed"
  },
  "typography": {
    "character": "<e.g. 'large condensed sans, tight tracking'>",
    "scale": "oversized | large | moderate | small-editorial",
    "hierarchy": "<how heading/body/caption relate, e.g. 'huge titles, minimal body copy'>"
  },
  "layout": {
    "density": "minimal | moderate | dense",
    "whitespace": "low | medium | high",
    "symmetry": "symmetrical | asymmetrical | mixed",
    "imageToText": "image-led | balanced | text-led",
    "titlePlacement": "<e.g. 'lower-left over image', 'centered'>",
    "textPerSlide": "very little | short blocks | substantial"
  },
  "composition": "<the reference's compositional habit, e.g. 'one dominant full-bleed image,
                   text anchored low; occasional 3-up collage'>",
  "imageTreatment": {
    "cropping": "<e.g. 'tight close-ups and wide cinematic frames, no mid shots'>",
    "grading": "<e.g. 'warm amber highlights, crushed teal shadows'>",
    "texture": "<e.g. 'film grain, slight halation' or ''>",
    "overlays": "<e.g. 'dark bottom scrim under text' or ''>"
  },
  "surface": {
    "backgrounds": "<ground treatment, e.g. 'near-black with subtle grain'>",
    "framing": "<borders/frames/masks/film-strip/none>",
    "motifs": ["<recurring graphic motif>", ...],
    "dividers": "<section-divider style, e.g. 'full-bleed image + one huge word'>"
  },
  "slideTreatments": {
    "cover": "<how a title/cover slide should feel per the references>",
    "character": "<how character introductions should be presented>",
    "moodBoard": "<collage vs single-image atmosphere>"
  },
  "references": [
    {"name": "<file/ref name>", "role": "overall|palette|typography|layout|mood|image_treatment|character_slides|cover",
     "weight": "primary|secondary|supporting", "summary": "<one line: what this reference contributes>"}
  ],
  "synthesis": "<one tight paragraph: the unified visual direction — what the deck must look like>",
  "conflicts": "<how conflicting references were resolved, or ''>"
}"""


def fingerprint(reference_hashes: list[str], reference_deck: dict | None,
                notes: str = "") -> str:
    """Stable key for the CURRENT reference set — profile recomputes only when this changes."""
    basis = {
        "images": sorted(h for h in reference_hashes if h),
        "deck": (reference_deck or {}).get("fileName") or "",
        "deckSlides": (reference_deck or {}).get("slideCount") or 0,
        "notes": (notes or "").strip().lower(),
    }
    return hashlib.sha256(json.dumps(basis, sort_keys=True).encode()).hexdigest()


def run(reference_images: list[dict], reference_deck: dict | None = None,
        intake: dict | None = None, image_names: list[str] | None = None) -> dict:
    """Analyse the reference set → structured visual profile.

    ``reference_images``: [{"mediaType", "data": <base64>}] — shown to the vision model.
    ``reference_deck``: the parsed .pptx reference ({fileName, slideCount, slides, colors, fonts}).
    ``intake``: the intake form — ``designDirection`` / ``visualReferences`` notes tell the agent
    HOW the director wants each reference used (those notes override inference).
    """
    intake = intake or {}
    notes = str(intake.get("designDirection") or "").strip()
    payload: dict = {
        "referenceCount": len(reference_images or []),
        "referenceNames": image_names or [],
        "directorNotes": notes or "(none — infer each reference's purpose from its content)",
        "storyContext": {k: intake.get(k) for k in
                         ("genreBlend", "tone", "visualMood", "visualAesthetic")
                         if intake.get(k)},
    }
    if reference_deck and (reference_deck.get("colors") or reference_deck.get("slides")):
        payload["referenceDeck"] = {
            "fileName": reference_deck.get("fileName"),
            "slideCount": reference_deck.get("slideCount"),
            "colors": (reference_deck.get("colors") or [])[:8],
            "fonts": (reference_deck.get("fonts") or [])[:4],
            "slideTitles": [s.get("title") for s in (reference_deck.get("slides") or [])[:12]],
        }
    return complete_json(
        system=_SYSTEM,
        prompt="Analyse these references:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=lambda: _fallback(reference_deck, intake),
        cache_prefix="reference_analysis",
        images=reference_images or None,
        max_tokens=1800,
        temperature=0.4,
    )


def slim(profile: dict | None) -> dict | None:
    """The compact form embedded in the design direction (design["referenceProfile"]) so every
    downstream agent that already receives ``design`` reads the profile with no new plumbing."""
    if not isinstance(profile, dict) or not profile:
        return None
    keep = ("style", "mood", "palette", "typography", "layout", "composition",
            "imageTreatment", "surface", "slideTreatments", "synthesis")
    out = {k: profile[k] for k in keep if profile.get(k)}
    return out or None


def _fallback(reference_deck: dict | None, intake: dict | None) -> dict:
    """Offline: a minimal profile from the reference deck's extracted colours + intake words —
    enough to keep palette anchoring working without a vision model."""
    intake = intake or {}
    colors = (reference_deck or {}).get("colors") or []
    return {
        "style": str(intake.get("visualAesthetic") or "cinematic"),
        "mood": str(intake.get("visualMood") or ""),
        "palette": {"dominant": colors[:3], "supporting": colors[3:5],
                    "accent": colors[5:6], "ground": ""},
        "typography": {"character": "", "scale": "", "hierarchy": ""},
        "layout": {"density": "", "whitespace": "", "symmetry": "",
                   "imageToText": "", "titlePlacement": "", "textPerSlide": ""},
        "composition": "",
        "imageTreatment": {"cropping": "", "grading": "", "texture": "", "overlays": ""},
        "surface": {"backgrounds": "", "framing": "", "motifs": [], "dividers": ""},
        "slideTreatments": {"cover": "", "character": "", "moodBoard": ""},
        "references": [],
        "synthesis": "",
        "conflicts": "",
        "_offline": True,
    }
