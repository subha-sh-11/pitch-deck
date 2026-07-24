"""Golden-set eval for the slide-edit agent — regression-tests INTENT INTERPRETATION.

Runs real director instructions against a fixed deck + brief and asserts on the STRUCTURE
of the emitted actions (right op, right target slide, constraints carried into fields) —
not on exact wording, so cases stay stable across model updates.

Usage (from backend/, venv active, a real LLM key in .env):
    python scripts/slide_edit_eval.py                 # run every case
    python scripts/slide_edit_eval.py --case count    # only cases whose name contains "count"
    python scripts/slide_edit_eval.py --repeat 3      # run the set N times (flakiness check)

Add a case EVERY time a user has to correct the agent in production ("no, I meant the
comps slide") — the correction IS the regression test. Keep expectations structural.

Exit code = number of failed case-runs (0 when green).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.agents import slide_edit  # noqa: E402

# ── Fixture deck + brief (a stable mini-project the cases run against) ──────

SLIDES: list[dict] = [
    {"id": "s_cover", "slideNumber": 1, "slideType": "cover", "title": "Sitaraa",
     "content": {"heading": "Sitaraa", "body": "Where every shadow tells a tale"}},
    {"id": "s_logline", "slideNumber": 2, "slideType": "logline", "title": "Logline",
     "content": {"body": "A tormented actress enlists two priests to reclaim her daughter's soul."}},
    {"id": "s_usp", "slideNumber": 3, "slideType": "usp", "title": "Why This Film",
     "content": {"items": [{"title": "Genre first", "description": "a Telugu exorcism thriller"},
                            {"title": "Emotional core", "description": "a mother's fight"}]}},
    {"id": "s_comps", "slideNumber": 4, "slideType": "show_cross", "title": "Comparables",
     "content": {"comps": [{"title": "Stree", "note": "horror-comedy hit"},
                            {"title": "The Conjuring", "note": "global horror"}]}},
    {"id": "s_market", "slideNumber": 5, "slideType": "market_potential", "title": "Market Potential",
     "content": {"items": [{"title": "OTT appetite", "description": "horror overperforms on streamers"},
                            {"title": "Theatrical window", "description": "festival-first release"}]}},
    {"id": "s_char", "slideNumber": 6, "slideType": "character", "title": "Meera",
     "content": {"characters": [{"name": "Meera", "role": "lead", "description": "actress and mother"}]}},
    {"id": "s_contact", "slideNumber": 7, "slideType": "contact", "title": "Contact",
     "content": {"body": "studio@sitaraa.film"}},
]

INTAKE: dict = {
    "title": "Sitaraa",
    "genreBlend": "Supernatural horror + family drama",
    "usp": "The first Telugu-language exorcism thriller anchored in a mother-daughter bond",
    "targetAudience": "18-34 horror fans, Telugu diaspora",
    "logline": "A tormented actress enlists two priests to reclaim her daughter's soul.",
}

# ── Expectation helpers (structural, wording-agnostic) ──────────────────────

Check = Callable[[dict], str | None]  # returns an error string, or None when satisfied


def ops(res: dict) -> list[dict]:
    return res.get("actions") or []


def expect_op(op: str, slide_id: str | None = None) -> Check:
    def check(res: dict) -> str | None:
        hits = [a for a in ops(res) if a["op"] == op and (slide_id is None or a.get("slideId") == slide_id)]
        if not hits:
            return f"expected {op}" + (f" on {slide_id}" if slide_id else "") + f", got {[a['op'] for a in ops(res)]}"
        return None
    return check


def expect_no_op(op: str, slide_id: str | None = None) -> Check:
    def check(res: dict) -> str | None:
        hits = [a for a in ops(res) if a["op"] == op and (slide_id is None or a.get("slideId") == slide_id)]
        return f"must NOT emit {op}" + (f" on {slide_id}" if slide_id else "") if hits else None
    return check


def expect_no_actions() -> Check:
    return lambda res: None if not ops(res) else f"expected NO actions, got {[a['op'] for a in ops(res)]}"


def expect_field_contains(op: str, field: str, *needles: str) -> Check:
    """At least one emitted `op` action must carry `field` containing ANY of the needles."""
    def check(res: dict) -> str | None:
        vals = [str(a.get(field, "")) for a in ops(res) if a["op"] == op]
        if not vals:
            return f"no {op} action emitted"
        if not any(n.lower() in v.lower() for v in vals for n in needles):
            return f"{op}.{field} lost the specifics {needles}: {vals[0][:120]!r}"
        return None
    return check


def expect_items_count(slide_id: str, n: int) -> Check:
    def check(res: dict) -> str | None:
        for a in ops(res):
            if a["op"] == "edit_slide" and a.get("slideId") == slide_id and isinstance(a.get("items"), list):
                return None if len(a["items"]) == n else f"items={len(a['items'])}, wanted {n}"
        return f"no edit_slide with items on {slide_id}"
    return check


def expect_message_contains(*needles: str) -> Check:
    def check(res: dict) -> str | None:
        msg = (res.get("message") or "").lower()
        return None if any(n.lower() in msg for n in needles) else \
            f"message lacks {needles}: {msg[:140]!r}"
    return check


# ── The golden set ──────────────────────────────────────────────────────────
# name, instruction, checks, and optional kwargs (history / selected_slide_id).
# Every case documents the real failure it guards against.

CASES: list[dict[str, Any]] = [
    {
        # "add a slide about X" used to throw X away (schema had only slideType).
        "name": "add-carries-contentbrief",
        "instruction": ("add a slide about our festival strategy — the three target festivals "
                        "are MAMI, IFFI and Busan"),
        "checks": [expect_op("add_slide"),
                   expect_field_contains("add_slide", "contentBrief", "MAMI", "IFFI", "Busan")],
    },
    {
        # "regenerate it punchier" used to drop the "punchier".
        "name": "regen-carries-direction",
        "instruction": "regenerate the USP slide — punchier, and lead with the mother-daughter angle",
        "checks": [expect_op("regenerate_slide", "s_usp"),
                   expect_field_contains("regenerate_slide", "direction", "punch", "mother")],
    },
    {
        # Explicit counts must be honoured exactly (Layer-4 verify backstops this).
        "name": "exact-count-5-points",
        "instruction": "make the market potential slide exactly 5 points",
        "checks": [expect_items_count("s_market", 5)],
    },
    {
        # Editing market_potential when the director said "comparables" is the classic
        # name→type mixup the prompt forbids. Also guards the comps-field path: edit_slide
        # had no `comps` field at first, so comps edits were silently discarded.
        "name": "comps-not-market",
        "instruction": "on the comparables slide, swap Stree out for Tumbbad",
        "checks": [expect_op("edit_slide", "s_comps"),
                   expect_no_op("edit_slide", "s_market"),
                   expect_field_contains("edit_slide", "comps", "Tumbbad")],
    },
    {
        # A bare ordinal answering the agent's own question is a slide REFERENCE, not a move.
        "name": "ordinal-answers-question",
        "instruction": "the 4th",
        "history": [
            {"role": "user", "text": "add an image"},
            {"role": "assistant", "text": "Which slide should get the image?"},
        ],
        "checks": [expect_op("generate_image", "s_comps"), expect_no_op("move_slide")],
    },
    {
        # Read-backs must answer in chat with the REAL content and touch nothing.
        "name": "readback-no-tools",
        "instruction": "what's on the market slide?",
        "checks": [expect_no_actions(), expect_message_contains("OTT", "theatrical")],
    },
    {
        # "change the IMAGE" is image-only — a full regen would wipe the copy.
        "name": "image-not-regen",
        "instruction": "change the image on the cover",
        "checks": [expect_op("generate_image", "s_cover"),
                   expect_no_op("regenerate_slide", "s_cover")],
    },
    {
        # Unnamed target defaults to the slide the director is looking at.
        "name": "selected-slide-default",
        "instruction": "make this slide minimal",
        "selected_slide_id": "s_char",
        "checks": [expect_op("set_appearance", "s_char")],
    },
    {
        # New copy must come from the BRIEF (the intake USP), not be invented.
        "name": "grounded-in-brief",
        "instruction": "rewrite the usp slide so it actually states our USP",
        "checks": [expect_op("edit_slide", "s_usp"),
                   expect_field_contains("edit_slide", "items", "exorcism", "mother-daughter")],
    },
    {
        # Character slides were uneditable at first (edit_slide had no characters field) —
        # renames were silently discarded.
        "name": "character-rename",
        "instruction": "on the character slide, rename Meera to Meenakshi (same role and story)",
        "checks": [expect_op("edit_slide", "s_char"),
                   expect_field_contains("edit_slide", "characters", "Meenakshi")],
    },
    {
        # The model trusted chat history ("Done — recoloured") over deck state and replied
        # "already done as per your previous instruction" with ZERO actions — while the deck
        # still showed the old accent. History is not state: re-asked edits must re-emit.
        "name": "history-claim-is-not-state",
        "instruction": "change the accent colour to a deep blood red across the whole deck",
        "history": [
            {"role": "user",
             "text": "change the accent colour to a deep blood red across the whole deck"},
            {"role": "assistant", "text": "Done — recoloured the accent."},
        ],
        "checks": [expect_op("set_accent")],
    },
    {
        # "undo that" must call undo_last — never a manual re-edit reconstruction.
        "name": "undo-calls-undo-last",
        "instruction": "undo that",
        "history": [
            {"role": "user", "text": "make the cover title punchier"},
            {"role": "assistant", "text": "Rewrote the cover title to 'Sitaraa: Shadows Speak'."},
        ],
        "checks": [expect_op("undo_last"), expect_no_op("edit_slide")],
    },
]


def run_case(case: dict[str, Any]) -> list[str]:
    res = slide_edit.run(
        case["instruction"],
        SLIDES,
        history=case.get("history"),
        selected_slide_id=case.get("selected_slide_id"),
        intake=INTAKE,
        purpose="investor",
    )
    errors = [e for e in (check(res) for check in case["checks"]) if e]
    if errors:  # show what the agent actually did, for debugging
        errors.append("actions=" + str([{k: str(v)[:80] for k, v in a.items()} for a in ops(res)]))
        errors.append("message=" + (res.get("message") or "")[:160].replace("\n", " | "))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", default="", help="only run cases whose name contains this")
    parser.add_argument("--repeat", type=int, default=1, help="run the whole set N times")
    args = parser.parse_args()

    from app.ai import llm

    if llm.resolve_provider() is None:
        print("FAIL: no LLM provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY) — "
              "the eval exercises the real model.")
        return 1

    selected = [c for c in CASES if args.case.lower() in c["name"].lower()]
    if not selected:
        print(f"no cases match {args.case!r}; available: {[c['name'] for c in CASES]}")
        return 1

    failures = 0
    for round_no in range(1, args.repeat + 1):
        if args.repeat > 1:
            print(f"— round {round_no}/{args.repeat}")
        for case in selected:
            try:
                errors = run_case(case)
            except Exception as exc:  # noqa: BLE001 — a crash is a failing case, keep going
                errors = [f"exception: {exc}"]
            tag = "PASS" if not errors else "FAIL"
            failures += bool(errors)
            print(f"[{tag}] {case['name']}")
            for e in errors:
                print(f"       {e}")
    total = len(selected) * args.repeat
    print(f"\n{total - failures}/{total} passed")
    return failures


if __name__ == "__main__":
    sys.exit(main())
