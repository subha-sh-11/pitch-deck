"""Golden-set eval for the intake-interview agent — regression-tests INTENT UNDERSTANDING.

The complaint this guards against: the producer replies with a recap, a field menu, or a
build pointer instead of answering what the director actually said. Each case sends one
real director message against a fixed mid-conversation state and asserts on STRUCTURE —
the right brief field changed, the message contains the requested content in the requested
shape — never on exact wording, so cases stay stable across model updates.

Usage (from backend/, venv active, a real LLM key in .env):
    python scripts/intake_intent_eval.py                 # run every case
    python scripts/intake_intent_eval.py --case greet    # only cases whose name contains "greet"
    python scripts/intake_intent_eval.py --repeat 3      # run the set N times (flakiness check)

Add a case EVERY time the producer misreads a director in production — the correction IS
the regression test. Exit code = number of failed case-runs (0 when green).
"""
from __future__ import annotations

import argparse
import copy
import sys
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.agents import intake_interview  # noqa: E402

# ── Fixture: a stable mid-conversation project the cases run against ────────

SCRIPT = """\
DHOOP — a Telugu crime drama.

1. EXT. WAREHOUSE DISTRICT, VIJAYAWADA - NIGHT
RAVI (19), wiry and restless, counts cash under a sodium lamp. His younger brother
CHINNA (14) keeps watch from a stolen scooter.

2. INT. TEA STALL - DAY
MEERA (40s), a transport officer with a limp, questions the stall owner about the
warehouse. Her informer PANDU (30s, gold tooth, never stops smiling) listens from a bench.

3. EXT. CANAL ROAD - DUSK
Ravi hands the cash to VIKRAM ANNA (50s), the syndicate boss. Vikram Anna ruffles
Chinna's hair. Meera photographs the exchange from her jeep.

4. INT. RAVI'S HOME - NIGHT
Ravi's mother LAKSHMI serves dinner. Chinna shows her his school medal. Ravi watches
from the doorway, cash still in his jacket.
"""

OLD_SYNOPSIS = ("Two brothers in Vijayawada run errands for a smuggling syndicate to pay "
                "their mother's debts, until a transport officer starts closing in.")

PILLARS: dict = {
    "title": "Dhoop",
    "logline": "A teenage courier must choose between the syndicate that feeds his family "
               "and the officer offering his brother a way out.",
    "synopsis": OLD_SYNOPSIS,
}

BRIEF: dict = {
    "title": {"value": "Dhoop", "method": "extract", "confidence": 0.95},
    "logline": {"value": PILLARS["logline"], "method": "extract", "confidence": 0.9},
    "synopsis": {"value": OLD_SYNOPSIS, "method": "extract", "confidence": 0.9},
    "genreBlend": {"value": "Crime drama", "method": "infer", "confidence": 0.7},
    "tone": {"value": "Gritty, grounded", "method": "infer", "confidence": 0.7},
}

# ── Expectation helpers (structural, wording-agnostic) ──────────────────────

Check = Callable[[dict], str | None]  # returns an error string, or None when satisfied


def _brief_value(res: dict, field: str) -> str:
    cell = (res.get("brief") or {}).get(field)
    v = cell.get("value") if isinstance(cell, dict) else cell
    return ", ".join(str(x) for x in v) if isinstance(v, list) else str(v or "")


def expect_message_has(*needles: str, want: int = 1) -> Check:
    """At least `want` of the needles appear in the chat message."""
    def check(res: dict) -> str | None:
        msg = (res.get("message") or "").lower()
        hits = [n for n in needles if n.lower() in msg]
        return None if len(hits) >= want else \
            f"message has {len(hits)}/{want} of {needles}: {msg[:140]!r}"
    return check


def expect_message_lacks(*needles: str) -> Check:
    def check(res: dict) -> str | None:
        msg = (res.get("message") or "").lower()
        hits = [n for n in needles if n.lower() in msg]
        return f"message must not contain {hits}: {msg[:140]!r}" if hits else None
    return check


def expect_brief_has(field: str, *needles: str, want: int = 1) -> Check:
    def check(res: dict) -> str | None:
        val = _brief_value(res, field).lower()
        if not val or val == "none":
            return f"brief.{field} is empty"
        hits = [n for n in needles if n.lower() in val]
        return None if len(hits) >= want else \
            f"brief.{field} has {len(hits)}/{want} of {needles}: {val[:120]!r}"
    return check


def expect_brief_changed(field: str, old: str) -> Check:
    def check(res: dict) -> str | None:
        val = _brief_value(res, field)
        return None if val.strip() and val.strip() != old.strip() else \
            f"brief.{field} unchanged: {val[:120]!r}"
    return check


def expect_brief_empty(*fields: str) -> Check:
    """No fabrication: these fields must not have been invented."""
    def check(res: dict) -> str | None:
        filled = [f for f in fields if _brief_value(res, f).strip() not in ("", "None")]
        return f"fabricated fields {filled}" if filled else None
    return check


def expect_numbered_message() -> Check:
    def check(res: dict) -> str | None:
        msg = res.get("message") or ""
        return None if "1." in msg and "2." in msg else \
            f"message is not a numbered list: {msg[:140]!r}"
    return check


def expect_no_sections() -> Check:
    return lambda res: None if not (res.get("sections") or []) else \
        f"expected no sections, got {[s.get('id') for s in res.get('sections', [])]}"


def expect_intent(*types: str) -> Check:
    """The agent's own intent classification (soft signal, but drift here predicts drift
    in behaviour — keep it asserted)."""
    def check(res: dict) -> str | None:
        t = ((res.get("intent") or {}).get("type") or "").lower()
        return None if t in types else f"intent.type={t!r}, expected one of {types}"
    return check


def expect_brief_lacks(field: str, *needles: str) -> Check:
    def check(res: dict) -> str | None:
        val = _brief_value(res, field).lower()
        hits = [n for n in needles if n.lower() in val]
        return f"brief.{field} must not contain {hits}: {val[:120]!r}" if hits else None
    return check


def expect_brief_nonempty(*fields: str) -> Check:
    def check(res: dict) -> str | None:
        empty = [f for f in fields if _brief_value(res, f).strip() in ("", "None")]
        return f"brief fields still empty: {empty}" if empty else None
    return check


def expect_sections_at_least(n: int) -> Check:
    def check(res: dict) -> str | None:
        got = len(res.get("sections") or [])
        return None if got >= n else f"only {got} sections, wanted >= {n} (one-pass rule)"
    return check


def expect_missing_includes(*fields: str) -> Check:
    """Asserts the server-side missingRequired recompute (_enforce_honesty) stays wired."""
    def check(res: dict) -> str | None:
        mr = [str(x).lower() for x in (res.get("missingRequired") or [])]
        absent = [f for f in fields if f.lower() not in mr]
        return f"missingRequired lacks {absent}: {mr}" if absent else None
    return check


def expect_any_field_has(fields: list[str], *needles: str) -> Check:
    def check(res: dict) -> str | None:
        for f in fields:
            if any(n.lower() in _brief_value(res, f).lower() for n in needles):
                return None
        return f"none of {fields} contains any of {needles}"
    return check


def expect_no_markdown() -> Check:
    """The chat renders raw text; run() strips markdown — this asserts the strip stays wired."""
    def check(res: dict) -> str | None:
        msg = res.get("message") or ""
        return f"markdown syntax in message: {msg[:140]!r}" if ("**" in msg or "##" in msg) else None
    return check


def expect_no_selected_fact_options() -> Check:
    """Fact fields (team/budget/status/distribution) must never carry a pre-selected option —
    the brief panel auto-commits selections, which would write an invented claim into the deck.
    Asserts the force-deselect in _enforce_honesty stays wired."""
    fact = {"creativeTeam", "budget", "productionStatus", "distribution"}
    def check(res: dict) -> str | None:
        bad = [s.get("field") for s in (res.get("sections") or [])
               if isinstance(s, dict) and s.get("field") in fact
               and any(o.get("selected") for o in (s.get("options") or []) if isinstance(o, dict))]
        return f"fact fields with pre-selected options: {bad}" if bad else None
    return check


# ── The golden set ──────────────────────────────────────────────────────────
# Every case documents the real failure it guards against. `message` is the director's
# latest turn; optional `history` precedes it; pillars/brief/script default to the fixture.

CASES: list[dict[str, Any]] = [
    {
        # A direct question used to get a field menu / recap instead of an answer.
        "name": "question-characters-answered",
        "message": "who are the main characters in my script?",
        "checks": [
            expect_message_has("Ravi", "Chinna", "Meera", "Pandu", "Vikram", want=3),
            expect_message_lacks("which field", "unique selling point", "hit build deck"),
            expect_no_markdown(),
            expect_intent("question"),
        ],
    },
    {
        # "rewrite X" used to return the OLD value while claiming it changed.
        "name": "edit-synopsis-actually-changes",
        "message": ("rewrite the synopsis — lean harder into the crime, and the brothers "
                    "should be in real danger by the end"),
        "checks": [
            expect_brief_changed("synopsis", OLD_SYNOPSIS),
            expect_intent("edit"),
        ],
    },
    {
        # The worked example from the system prompt: resolve the reference, don't ask
        # "which field?" — read the names straight off the script.
        "name": "keep-names-from-script",
        "message": "keep the main characters' names exactly as in the script",
        "checks": [
            expect_brief_has("mainCharacters", "Ravi", "Meera", "Chinna", "Vikram", want=2),
            expect_message_has("Ravi", "Meera", "Chinna", "Vikram", want=2),
            expect_message_lacks("which field"),
        ],
    },
    {
        # "make it points" must re-deliver the CONTENT in numbered shape, in the message
        # itself — not a one-line "I've numbered them".
        "name": "format-renumber-in-message",
        "history": [
            {"role": "user", "text": "what key scenes would you anchor the deck on?"},
            {"role": "assistant",
             "text": ("I'd anchor it on the warehouse cash count under the sodium lamp, the "
                      "tea-stall interrogation, the canal-road exchange Meera photographs, "
                      "and the family dinner where Chinna shows his medal.")},
        ],
        "message": "make those into numbered points",
        "checks": [
            expect_numbered_message(),
            expect_message_has("warehouse", "tea", "canal", "dinner", want=3),
            expect_intent("format"),
        ],
    },
    {
        # A bare greeting used to trigger fabricated films / premature question rounds.
        "name": "greeting-no-fabrication",
        "message": "hello",
        "pillars": {},
        "brief": None,
        "script": None,
        "checks": [
            expect_no_sections(),
            expect_brief_empty("mainCharacters", "genreBlend", "synopsis", "title"),
            expect_intent("greeting"),
        ],
    },
    {
        # After the build pointer has been said once, an edit gets a short confirmation —
        # never another "hit Build deck" recap.
        "name": "edit-no-build-repeat",
        "history": [
            {"role": "user", "text": "looks good"},
            {"role": "assistant",
             "text": ("Everything's set from your side — we can build the pitch deck now. "
                      "Review the summary on the right, then hit Build deck.")},
        ],
        "message": "make it 17 slides",
        "checks": [
            expect_brief_has("deckLength", "17"),
            expect_message_lacks("build deck", "everything's set"),
            expect_intent("edit", "new_info", "pick"),
        ],
    },
    {
        # Meta/process questions get a real answer about the actual flow — not a recap and
        # not an intake interrogation.
        "name": "meta-question-answered",
        "message": "can I build the deck without a full synopsis?",
        "pillars": {"title": "Dhoop"},
        "brief": {"title": {"value": "Dhoop", "method": "extract", "confidence": 0.95}},
        "script": None,
        "checks": [
            expect_message_lacks("unique selling point", "creative team", "which field"),
            expect_intent("question", "meta"),
        ],
    },
    # ── Cases from the 2026-07-23 live director session (Godari) ───────────────
    {
        # The agent invented a generic usp + keyScenes (method "ask") on a logistics turn to
        # justify "everything's set" — while the logline it had flagged as missing was empty.
        "name": "no-filler-on-logistics-turn",
        "message": ("ok lets do 12 slides, budget is 8 to 10 crores, and i'll send it as a "
                    "pdf on whatsapp"),
        "brief": {k: v for k, v in BRIEF.items() if k != "logline"},
        "checks": [
            expect_brief_empty("usp", "keyScenes"),
            expect_brief_has("deckLength", "12"),
            expect_brief_has("budget", "8"),
            expect_missing_includes("logline"),
            expect_no_markdown(),
        ],
    },
    {
        # A pasted bio lost its award (festival + year) and the 2M views — the exact facts a
        # producer checks — and wrote "Director: You" into a deck-bound field.
        "name": "bio-preserves-credits",
        "message": ("about me - i directed 2 short films. Nalla Cheruvu won best short at the "
                    "Indian Film Festival of Hyderabad 2023, and Bommala Koluvu did 2M views on "
                    "youtube. before that i was an AD for 2 years on a big period action "
                    "production. my DOP Ramesh is already confirmed, he shot both my shorts"),
        "checks": [
            # every name survives…
            expect_brief_has("creativeTeam", "Nalla", "Bommala", "Ramesh", want=3),
            # …and BOTH credibility facts survive in some spelling: the award (festival/year)
            # and the view count.
            expect_brief_has("creativeTeam", "Hyderabad", "2023", want=1),
            expect_brief_has("creativeTeam", "2M", "million", want=1),
            expect_brief_lacks("creativeTeam", "director: you"),
        ],
    },
    {
        # "Jersey meets Kantara" is a comparable — it was filed under visualReferences and
        # showCross stayed empty; "mass appeal" also leaked into the visual mood field.
        "name": "comps-route-to-showcross",
        "message": "jersey meets kantara feel. konchem mass ga undali second half lo",
        "checks": [
            expect_brief_has("showCross", "Jersey", "Kantara", want=2),
            expect_brief_lacks("visualMood", "mass"),
        ],
    },
    {
        # A premise turn produced an EMPTY logline box instead of a drafted logline, and only
        # two follow-up sections instead of the one-pass suggestion round.
        "name": "logline-drafted-from-premise",
        "message": ("its a survival drama set on the godavari. an old boatman and his daughter "
                    "in law cant stand each other - she blames him for her husbands death. but "
                    "when the old bridge collapses in the floods they are the only two who can "
                    "ferry the village school children across overnight"),
        "pillars": {"title": "Godari"},
        "brief": None,
        "script": None,
        "checks": [
            expect_brief_nonempty("logline", "synopsis"),
            expect_sections_at_least(3),
            expect_intent("new_info"),
        ],
    },
    {
        # A look preference embedded in a meta question ("rain soaked look") was acknowledged
        # in chat but written nowhere in the brief.
        "name": "preference-captured-during-meta",
        "message": ("can i see how the cover slide looks before we build the whole thing? "
                    "i want a rain soaked monsoon look on it"),
        "checks": [
            expect_any_field_has(
                ["visualMood", "visualAesthetic", "designDirection", "colorPalette",
                 "textureStyle", "visualReferences", "tone"],
                "rain", "monsoon", "wet"),
            expect_intent("meta", "question", "new_info"),
        ],
    },
    {
        # "What's missing" cherry-picked 3 items and skipped budget & production status — the
        # first things a producer looks for.
        "name": "missing-list-includes-money",
        "message": "whats still missing for a strong producer pitch? list it out",
        "checks": [
            expect_message_has("budget"),
            expect_numbered_message(),
            expect_missing_includes("budget", "productionStatus"),
            expect_no_markdown(),
        ],
    },
    {
        # "8 episodes" went into deckLength (the SLIDE count) — downstream that builds an
        # 8-slide deck. Episode counts belong in format.
        "name": "episodes-not-slides",
        "message": "actually i want this as an 8 episode series, not a film",
        "brief": {**BRIEF,
                  "deckLength": {"value": "Standard 10-15 slides", "method": "pick",
                                 "confidence": 0.9}},
        "checks": [
            expect_brief_lacks("deckLength", "episode"),
            expect_brief_has("format", "episode", "series", want=1),
        ],
    },
    {
        # The one-pass round pre-selected invented guesses for FACT fields ("Established
        # director with crime drama experience") and the panel auto-committed them — fabricated
        # deck claims the director never made. Fact fields arrive unselected and unwritten.
        "name": "fact-fields-never-preselected",
        "message": ("its about a woman constable in palasa, the cashew town on the andhra-odisha "
                    "border. she discovers her own younger brother is the courier for the "
                    "smuggling ring she is investigating"),
        "pillars": {"title": "Palasa Nights"},
        "brief": None,
        "script": None,
        "checks": [
            expect_no_selected_fact_options(),
            expect_brief_empty("creativeTeam", "budget", "productionStatus"),
        ],
    },
    {
        # After the director gives character names, fields that mention those characters must
        # switch to the names — the synopsis kept saying "the brothers / the officer".
        "name": "names-propagate-to-synopsis",
        "message": ("in the synopsis use the actual names - the brothers are Ravi and Chinna, "
                    "and the officer is Meera"),
        "checks": [
            expect_brief_has("synopsis", "Ravi", "Chinna", "Meera", want=2),
            expect_brief_changed("synopsis", OLD_SYNOPSIS),
        ],
    },
]


def run_case(case: dict[str, Any]) -> list[str]:
    history = list(case.get("history") or []) + [{"role": "user", "text": case["message"]}]
    brief = case["brief"] if "brief" in case else BRIEF  # a case may pin brief/script to None
    res = intake_interview.run(
        history,
        case.get("pillars", PILLARS),
        copy.deepcopy(brief) if brief else None,
        script=case["script"] if "script" in case else SCRIPT,
    )
    errors = [e for e in (check(res) for check in case["checks"]) if e]
    if errors:  # show what the agent actually did, for debugging
        errors.append("intent=" + str(res.get("intent")))
        errors.append("message=" + (res.get("message") or "")[:200].replace("\n", " | "))
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
