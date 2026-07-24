"""Quality Review agent → a structural QA pass over the assembled deck.

Runs AFTER content + images are generated. Combines deterministic checks (repeated images,
missing producer slides, readability, generic copy, character consistency) with an optional
LLM pass (spelling, "too generic", commercial conviction). Degrades gracefully: the
deterministic checks always run; the LLM pass returns nothing offline (complete_json falls back).

Output (stored on Deck.quality_review):
{
  "score": 0-100,
  "summary": "one-line verdict",
  "issues": [{"severity": "high|medium|low", "slideNumber": int|None,
              "slideType": str|None, "category": str, "message": str}],
  "checkedAt": iso8601,
}
"""
from __future__ import annotations

import datetime
import json
import re
from collections import Counter

from app.ai.llm import complete_json

# Slides a producer-facing deck should carry to make the business case.
_PRODUCER_SLIDES = {
    "usp": "Unique Selling Points",
    "target_audience": "Target Audience",
    "market_potential": "Market Potential",
}

# Marketing froth / vagueness that reads as "auto-generated" rather than specific to THIS film.
_GENERIC_PHRASES = re.compile(
    r"\b(a world like no other|like never before|truly|compelling|takes us on a journey|"
    r"a journey like no other|unique story|edge of your seat|rollercoaster|"
    r"something for everyone|game[- ]?changer|unlike anything)\b",
    re.IGNORECASE,
)


def _text_of(content: dict) -> str:
    """All human-readable copy on a slide, flattened — for spelling/generic scans."""
    bits: list[str] = []
    for k in ("heading", "subheading", "body", "footer"):
        v = content.get(k)
        if isinstance(v, str):
            bits.append(v)
    bullets = content.get("bullets")
    if isinstance(bullets, list):
        bits += [x for x in bullets if isinstance(x, str)]
    for coll in ("items", "characters", "comps", "moodBlocks", "relationships"):
        v = content.get(coll)
        if isinstance(v, list):
            for it in v:
                if isinstance(it, dict):
                    bits += [str(it.get(f, "")) for f in
                             ("title", "description", "name", "role", "note", "label", "wound")]
    return " ".join(b for b in bits if b)


def _issue(severity: str, category: str, message: str, slide: dict | None = None) -> dict:
    return {"severity": severity, "category": category, "message": message,
            "slideNumber": (slide or {}).get("slideNumber"),
            "slideType": (slide or {}).get("slideType")}


def _deterministic_issues(slides: list[dict]) -> list[dict]:
    issues: list[dict] = []

    # 1. Repeated images — the same generated URL reused on multiple slides.
    urls: list[str] = []
    for s in slides:
        u = (s.get("content") or {}).get("imageUrl")
        if isinstance(u, str) and u.strip():
            urls.append(u.strip())
    for url, count in Counter(urls).items():
        if count > 1:
            issues.append(_issue(
                "medium", "repeated_images",
                f"The same image is used on {count} slides — regenerate so each slide has its own "
                "visual (the deck should not repeat a frame)."))

    # 2. Missing producer slides.
    present = {s.get("slideType") for s in slides}
    for stype, label in _PRODUCER_SLIDES.items():
        if stype not in present:
            issues.append(_issue(
                "medium", "missing_producer_slide",
                f"No '{label}' slide — producers expect it to assess the case for the film."))

    # 3. Readability — missing heading / overlong body on a non-prose slide.
    for s in slides:
        c = s.get("content") or {}
        if not (isinstance(c.get("heading"), str) and c["heading"].strip()):
            issues.append(_issue("low", "readability", "Slide has no heading.", s))
        body = c.get("body")
        if (isinstance(body, str) and len(body) > 700
                and s.get("slideType") not in ("synopsis", "story_world")):
            issues.append(_issue(
                "low", "readability",
                "Body copy runs long — tighten to a few lines so a producer grasps it in seconds.", s))

    # 4. Generic copy.
    for s in slides:
        hits = sorted({m.group(0).lower() for m in _GENERIC_PHRASES.finditer(_text_of(s.get("content") or {}))})
        if hits:
            issues.append(_issue(
                "low", "generic_copy",
                "Generic phrasing (" + ", ".join(hits) + ") — make it specific to this story.", s))

    # 5. Character consistency — character slides should carry named leads.
    for s in slides:
        if s.get("slideType") in ("character", "supporting_characters"):
            chars = (s.get("content") or {}).get("characters")
            if not (isinstance(chars, list) and chars):
                issues.append(_issue(
                    "medium", "character_consistency",
                    "Character slide has no characters — add the story's named leads.", s))

    return issues


_SYSTEM = (
    "You are a ruthless pitch-deck editor doing a FINAL QA pass before a film pitch deck goes to "
    "producers and investors. You are given the film's basics and every slide's title + copy. Find "
    "ONLY real problems a sharp producer would notice: spelling or grammar errors, copy that is "
    "vague or generic rather than specific to THIS story, slides that contradict each other, and "
    "places where the commercial case is unconvincing or missing. Quote the slide. Never invent "
    "praise or padding. If a slide is fine, say nothing about it.\n"
    "When a `referenceProfile` is provided, the director shared visual references and the deck "
    "committed to that visual language — also flag REFERENCE-ALIGNMENT drift you can see from the "
    "copy: slides whose text length/density contradicts the profile's textPerSlide, copy whose "
    "mood clashes with the profile's mood, or slides that clearly abandon the promised treatment "
    "(category \"reference_alignment\").\n"
    "Return ONLY JSON: {\"issues\": [{\"severity\": \"high|medium|low\", \"slideNumber\": <int or "
    "null>, \"category\": \"spelling|generic|consistency|commercial|clarity|reference_alignment\", "
    "\"message\": \"<specific, actionable note>\"}], \"summary\": \"<one-line overall verdict>\"}."
)


def _llm_issues(slides: list[dict], intake: dict, design: dict | None = None) -> tuple[list[dict], str]:
    payload = {
        "film": {k: intake.get(k) for k in ("title", "logline", "genreBlend", "tone")
                 if isinstance(intake.get(k), str) and intake.get(k).strip()},
        "slides": [{"slideNumber": s.get("slideNumber"), "slideType": s.get("slideType"),
                    "title": s.get("title"), "text": _text_of(s.get("content") or {})[:600]}
                   for s in slides],
    }
    profile = (design or {}).get("referenceProfile")
    if isinstance(profile, dict) and profile:
        payload["referenceProfile"] = {
            k: profile.get(k) for k in ("style", "mood", "layout", "synthesis") if profile.get(k)
        }
    result = complete_json(
        system=_SYSTEM,
        prompt="QA this deck:\n" + json.dumps(payload, ensure_ascii=False),
        fallback=lambda: {},          # offline / no key → no LLM issues, deterministic checks stand
        cache_prefix="quality_review",
        max_tokens=1200,
        temperature=0.2,
    )
    issues: list[dict] = []
    summary = ""
    if isinstance(result, dict):
        summary = str(result.get("summary") or "").strip()
        for raw in result.get("issues") or []:
            if not isinstance(raw, dict) or not str(raw.get("message") or "").strip():
                continue
            sev = str(raw.get("severity") or "low").lower()
            if sev not in ("high", "medium", "low"):
                sev = "low"
            num = raw.get("slideNumber")
            issues.append({"severity": sev,
                           "category": str(raw.get("category") or "clarity"),
                           "message": str(raw["message"]).strip(),
                           "slideNumber": num if isinstance(num, int) else None,
                           "slideType": None})
    return issues, summary


def run(slides: list[dict], intake: dict | None = None, design: dict | None = None) -> dict:
    """QA the finished deck. ``slides`` = [{slideNumber, slideType, title, content}]."""
    slides = slides or []
    intake = intake or {}
    issues = _deterministic_issues(slides)
    llm_issues, summary = _llm_issues(slides, intake, design)
    issues += llm_issues

    # Score from a clean 100, weighted by severity (a few low notes barely dent it).
    weights = {"high": 12, "medium": 6, "low": 2}
    score = max(0, 100 - sum(weights.get(i["severity"], 2) for i in issues))
    if not summary:
        if score >= 90:
            summary = "Strong, producer-ready deck with only minor polish notes."
        elif score >= 70:
            summary = "Solid deck; a few fixes will sharpen the pitch."
        else:
            summary = "Several issues to address before this deck is pitch-ready."

    return {
        "score": score,
        "summary": summary,
        "issues": issues,
        "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
