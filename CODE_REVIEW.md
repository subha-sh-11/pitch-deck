# Production Readiness Review — Pitch Deck

**Date:** 2026-06-11 · **Branch:** `feat/editor-page-design` · **Scope:** backend, frontend, UI polish, infra
**Verdict:** Strong product foundation, **not production-ready yet**. Blockers are auth, secrets/infra hardening, and error handling. UI is *nearly premium* — one major theme inconsistency holds it back.

---

## 🔴 Critical — must fix before any deployment

### 1. No real authentication or authorization
`backend/app/routers/deps.py` — `get_current_owner()` is a stub returning a hardcoded dev user, and `get_owned_project()` only checks existence, **not ownership**:

```python
async def get_current_owner(db: AsyncSession = Depends(get_db)) -> User:
    """Stub auth — returns the dev owner. Replace with JWT verification later."""
    return await project_service.get_default_owner(db)
```

Any caller can read/mutate any project, deck, slide, or asset. Expensive endpoints (generation, slide regeneration) are also unauthenticated — direct cost-abuse vector against your LLM/image API keys. **Fix:** implement JWT (NEXTAUTH_SECRET already exists), add `owner_id` checks in `get_owned_project`, protect asset serving.

### 2. Secrets hygiene
- Real API keys (Anthropic, Google, OpenAI, fal, Replicate) live in `.env`; the file was captured in a **git stash** (`git log --all -- .env`). Stashes don't push, but rotate keys if this repo/machine is ever shared.    
- `docker-compose.yml`: default credentials everywhere — Postgres `pitchdeck/pitchdeck`, MinIO `minioadmin/minioadmin`, Redis with no password — and all three bind to host ports.
- `.env` has space-padded keys (`GOOGLE_API_KEY =`) which pydantic-settings may parse unexpectedly — verify these load.
v      
### 3. No deployment story
No Dockerfile for backend or frontend (backend starts via `start-backend.ps1`, dev-mode only), no CI (`.github/workflows` absent), **zero tests anywhere**, no TLS or security headers in `nginx/`, no healthchecks/restart policies in compose. Nothing here can currently be shipped reproducibly.

---

## 🟠 High

**Backend**
- **20 `except Exception` blocks** across `backend/app` — many swallow errors without logging (worst offenders in `ai/images.py`, `ai/llm.py`, worker tasks). Failures vanish silently; users see decks stuck "generating."
- Celery task failures aren't persisted to job/deck state — the frontend polls forever. Add a failure state + `on_failure` handler in `workers/tasks.py`.
- Missing/inconsistent timeouts on outbound LLM and image-provider HTTP calls — a hung provider call ties up a worker indefinitely.
- Rate limiting (`core/rate_limit.py`) fails **open** when Redis is down.
- Dev defaults will leak to prod: `CELERY_EAGER`, `AI_OFFLINE`, `IMAGE_PROVIDER=none` fallbacks, MinIO defaults baked into `core/config.py`.

**Frontend**
- ~10 silent `catch {}` blocks across `lib/api/*` and features — errors swallowed, no user feedback.
- No React error boundaries — one component crash blanks the whole app. Add `app/error.tsx` + `global-error.tsx`.
- API client (`lib/api/client.ts`) has a hardcoded `localhost:8000` fallback and no request timeout/AbortController.
- Object URLs from file uploads never revoked (`URL.revokeObjectURL`) — memory leak in the intake/upload flow.
- Generation flow allows concurrent duplicate deck builds (no in-flight guard).

**Infra**
- `requirements.txt` is entirely `>=` loose pins — builds are non-reproducible. Pin exact versions (`pip freeze` or pip-tools).
- Root `package-lock.json` is 95 bytes (orphaned/corrupt) — delete it; the real lockfile is `frontend/package-lock.json`.
- CORS: `allow_methods=["*"]`, `allow_headers=["*"]` — tighten for prod.

---

## 🟡 Medium

- **Git hygiene:** 121 generated SVG assets under `backend/_assets/generated/` are still tracked despite the gitignore (added after commit) — `git rm -r --cached backend/_assets/generated`. ~220 modified files sitting uncommitted on the feature branch — commit in reviewable chunks.
- Single Alembic migration (`0001_baseline.py`) being mutated in place instead of new revisions — fine pre-launch, must stop at first deploy.
- No JSONB validation at the DB boundary; slide content shape is enforced only by convention. Missing indexes on commonly filtered columns (e.g., `project_id`, `deck_id`, `status`).
- Deck replacement has a read-modify-write race (no optimistic locking / version column).
- Frontend: duplicated intake logic between the wizard and `ChatIntake` (known WIP) — consolidate before merging; several data-fetching components missing loading/empty states.
- No `depends_on: condition: service_healthy` in compose — startup order is racy.

---

## ✨ Premium audit (UI/UX)

**Verdict: Nearly premium (8/10).** The design system is genuinely good — coherent dark cinematic palette (`styles/cinematic.css`, 5-level surface scale, warm peach accent), elegant typography (Geist + Cormorant, `clamp()` scaling), 14 truly distinct slide templates with graceful image fallbacks, consistent easing (`cubic-bezier(0.22,1,0.36,1)`), `prefers-reduced-motion` support, a polished `GeneratingOverlay`, themed scrollbars, no emoji-as-icons, no `alert()`s, no lorem ipsum.

**The one thing that breaks it:** the **editor is light-themed while everything else is dark**. `bg-white`, `text-[#1A1A1F]`, `border-[#E0E0E5]` across **25 files** (`PitchTopBar.tsx`, `PropertiesPanel.tsx`, `SlideContextBar.tsx`, `EditorToolbar.tsx`, `SlideNavigator.tsx`, …). The user journey goes dark landing → dark setup → dark preview → **bright white editor** → dark export. It reads as half-finished or two design teams. This is the single highest-impact fix in the whole review (~3 hrs).

Remaining polish items, by effort-to-impact: replace ~42 hardcoded hex values in slide templates with theme tokens; remove 6 `!important` rules in `preview-page-refined.css`; add a toast component (full-page modal is overkill for "saved"); designed empty states ("Start your first pitch"); aria-labels/alt text on slides; a defined border-radius scale.

---

## ✅ What's already good

Clean layered architecture (thin routers → services → JSONB models), provider-agnostic AI layer with graceful degradation (`AI_OFFLINE`, `IMAGE_PROVIDER=none`), strict TypeScript with essentially zero `any`, proper hydration guards, clean event-listener/interval cleanup, distinct well-crafted slide templates, accurate and honest `CLAUDE.md`/`ARCHITECTURE.md`.

---

## Prioritized fix order

| # | Fix | Effort |
|---|-----|--------|
| 1 | Real JWT auth + ownership checks on every resource (incl. assets, generation) | 2–3 d |
| 2 | Rotate API keys; strong creds in compose; stop binding infra to host in prod | 0.5 d |
| 3 | Dockerfiles (backend + frontend) + minimal CI (lint, build, future tests) | 1–2 d |
| 4 | Fix 20 silent `except Exception` blocks: log + propagate; Celery failure states | 1–2 d |
| 5 | Dark-theme the editor (25 files) | 0.5 d |
| 6 | Frontend error boundaries + surface API errors to users; request timeouts | 1 d |
| 7 | Pin `requirements.txt`; delete root `package-lock.json` | 0.5 d |
| 8 | nginx: TLS, security headers, body-size limits, long timeouts for AI routes | 0.5 d |
| 9 | Untrack `backend/_assets/generated` (121 files); commit the 220-file WIP in chunks | 0.5 d |
| 10 | Timeouts on all outbound LLM/image calls; rate limiter fail-closed | 0.5 d |

Rough total: **~2 weeks of focused work** to be safely deployable; items 5 + the polish list get the UI to genuinely premium in another 2–3 days.
