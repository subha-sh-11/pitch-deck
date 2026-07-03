"""Live health check for the conversational agents — run while the backend is up.

Usage (any Python 3.9+, stdlib only — venv not required):
    python scripts/agent_live_check.py [base_url]

Checks, in order:
  1. API + database reachability   (GET  /health/ready)
  2. LLM provider actually working (POST /projects/{id}/interview — a real agent turn)
  3. Deck-edit agent tool calling  (POST /projects/{id}/deck/command — expects a set_accent)

Prints PASS/FAIL per step with the reason, and exits non-zero on any failure.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/") + "/api/v1"

ok_count = 0
fail_count = 0


def report(name: str, passed: bool, detail: str) -> None:
    global ok_count, fail_count
    tag = "PASS" if passed else "FAIL"
    ok_count += passed
    fail_count += not passed
    print(f"[{tag}] {name}: {detail}")


def call(method: str, path: str, body: dict | None = None, timeout: int = 120):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def main() -> int:
    # 1. API + DB
    try:
        r = call("GET", "/health/ready")
        report("api+db", r.get("database") == "ok", json.dumps(r))
    except Exception as exc:  # noqa: BLE001
        report("api+db", False, f"{exc} — is uvicorn running and postgres up?")
        return 1

    # Need a project to exercise the agents
    try:
        projects = call("GET", "/projects")
    except Exception as exc:  # noqa: BLE001
        report("projects", False, str(exc))
        return 1
    if not projects:
        report("projects", False, "no projects in DB — create one in the app first")
        return 1
    pid = projects[0]["id"]
    print(f"       using project: {projects[0].get('title')} ({pid})")

    # 2. Interview agent (conversational intake) — a greeting turn
    try:
        r = call("POST", f"/projects/{pid}/interview",
                 {"history": [{"role": "user", "text": "hello"}], "pillars": {}})
        msg = (r.get("message") or "")[:140]
        provider = r.get("provider", "?")
        offline = "offline" in msg.lower() or "can't reach" in msg.lower()
        report("interview agent", bool(msg) and not offline,
               f"provider={provider} message={msg!r}")
        if offline:
            print("       → the LLM key/quota is the problem; agents are running on canned fallbacks")
    except Exception as exc:  # noqa: BLE001
        report("interview agent", False, str(exc))

    # 3. Deck-edit agent (native tool calling) — expect a set_accent action
    try:
        r = call("POST", f"/projects/{pid}/deck/command",
                 {"instruction": "make the accent color gold", "slides": []})
        actions = r.get("actions") or []
        has_accent = any(a.get("op") == "set_accent" and str(a.get("hex", "")).startswith("#")
                         for a in actions)
        report("deck-edit agent", has_accent,
               f"actions={json.dumps(actions)} discarded={r.get('discarded')} "
               f"message={(r.get('message') or '')[:120]!r}")
        if not actions and "can't reach" in (r.get("message") or ""):
            print("       → LLM unreachable; fix the API key/quota in backend/.env, restart uvicorn")
    except Exception as exc:  # noqa: BLE001
        report("deck-edit agent", False, str(exc))

    print(f"\n{ok_count} passed, {fail_count} failed")
    return 1 if fail_count else 0


if __name__ == "__main__":
    sys.exit(main())
