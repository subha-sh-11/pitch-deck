# Production Roadmap — Pitch Deck

**Goal:** private beta on a VPS (Docker), custom JWT auth, premium UI.
**Companion doc:** `CODE_REVIEW.md` (the audit these phases resolve).
**Working agreement:** before each phase I explain the approach; after every change you get a file-by-file changelog with reasoning; each phase ends with a checkpoint you can verify yourself.

---

## Phase 0 — Repo hygiene & safety net (~0.5 day)

*Why first: everything after this creates diffs. We need a clean, committed baseline so changes are reviewable, and no live secrets at risk.*

| Step | What | Why |
|---|---|---|
| 0.1 | You rotate all API keys (Anthropic, OpenAI, Google, fal, Replicate) in their dashboards; update `.env` | Keys were captured in a git stash; cheap insurance |
| 0.2 | Untrack `backend/_assets/generated/` (121 files) via `git rm -r --cached` | Generated artifacts bloat the repo; gitignore already exists |
| 0.3 | Delete corrupt root `package-lock.json` (95 bytes) | Orphaned; real lockfile is in `frontend/` |
| 0.4 | Commit the ~220-file WIP in logical chunks (backend / frontend / docs) | Clean baseline; reviewable history |
| 0.5 | Pin `backend/requirements.txt` to exact versions | Reproducible builds before we touch anything |

**Checkpoint:** `git status` is clean; app still starts locally.

---

## Phase 1 — Backend auth: JWT (~2–3 days)

*Why now: the stub auth is the #1 blocker, and every later feature should be built on real user context — retrofitting ownership checks later is how holes happen.*

| Step | What | Why |
|---|---|---|
| 1.1 | Extend `User` model: `email` (unique), `hashed_password`; Alembic revision | Foundation; bcrypt via `passlib` |
| 1.2 | New `routers/auth.py`: `POST /auth/register`, `POST /auth/login` → access token (short-lived) + refresh token | Standard JWT flow, `python-jose`; secret from `NEXTAUTH_SECRET` env |
| 1.3 | Replace `get_current_owner()` stub in `routers/deps.py` with real JWT verification (Bearer header) | The actual fix for the audit's #1 critical |
| 1.4 | Add ownership enforcement in `get_owned_project()` and every deck/slide/asset/job path | Existence ≠ ownership; closes cross-user access |
| 1.5 | Protect generation + regeneration endpoints; keep per-user rate limits | Closes the LLM-cost abuse vector |
| 1.6 | Secure asset serving (signed URLs or auth-checked streaming) | Assets are currently world-readable |
| 1.7 | Dev-mode escape hatch: `AUTH_DISABLED=true` env flag preserving today's behavior | Keeps local vibe-coding friction-free |

**Checkpoint:** API rejects requests without a token (401); two test users cannot see each other's projects; `AUTH_DISABLED=true` still works for local dev.

---

## Phase 2 — Frontend auth (~1–2 days)

*Why now: backend auth is useless until the UI speaks it; doing it immediately after keeps the auth context fresh.*

| Step | What | Why |
|---|---|---|
| 2.1 | Login / register pages styled to the cinematic theme | First thing beta users see — must look premium |
| 2.2 | Token handling in `lib/api/client.ts`: attach Bearer header, auto-refresh, redirect to login on 401 | One place, every call covered |
| 2.3 | Route protection for `/dashboard` and `/projects/*` (middleware) | No flashes of protected content |
| 2.4 | Logout + minimal account display in the header | Baseline expectations |

**Checkpoint:** full flow — register → login → create project → logout → blocked from `/dashboard` → login again, project still there.

---

## Phase 3 — Error handling & resilience (~2 days)

*Why now: with auth done, error paths include auth failures; and fixing this before UI work means problems become visible instead of silent.*

| Step | What | Why |
|---|---|---|
| 3.1 | Backend: triage all 20 `except Exception` blocks — log with context, re-raise or return typed errors; never swallow | Audit's top reliability issue |
| 3.2 | Celery: `on_failure` handlers persist a `failed` status + reason on jobs/decks | Kills the infinite "generating…" hang |
| 3.3 | Timeouts + bounded retries on all outbound LLM / image / TMDB calls | A hung provider must not freeze a worker |
| 3.4 | Rate limiter fails **closed** in production (env-aware) | Currently fails open when Redis dies |
| 3.5 | Frontend: error boundaries (`app/error.tsx`, `global-error.tsx`) | One crash must not blank the app |
| 3.6 | API client: timeout + AbortController; remove hardcoded `localhost:8000` fallback (env-driven) | Hanging requests, prod URL correctness |
| 3.7 | Toast component (cinematic-styled); surface the ~10 silent frontend catches as user-visible messages | Users must know when something fails |
| 3.8 | Generation in-flight guard (disable button / dedupe) | Stops duplicate concurrent deck builds |
| 3.9 | Fix unrevoked Object URLs in upload flow | Memory leak |

**Checkpoint:** kill the backend mid-generation → UI shows a styled error toast, deck marked failed, retry works. No console silence.

---

## Phase 4 — Premium UI pass (~1–2 days)

*Why now: zero-risk visual work that benefits from Phase 3's toasts/error states; the last thing beta users' eyes touch.*

| Step | What | Why |
|---|---|---|
| 4.1 | **Dark-theme the editor** — replace `bg-white` / `text-[#1A1A1F]` / `border-[#E0E0E5]` across 25 files with theme tokens | The single biggest premium-feel fix in the audit |
| 4.2 | Replace ~42 hardcoded hex values in 13 slide templates with CSS variables | Consistency; future re-theming becomes trivial |
| 4.3 | Remove 6 `!important` rules in `preview-page-refined.css` | CSS hygiene |
| 4.4 | Designed empty states (e.g., dashboard "Start your first pitch") | Premium apps never show bare nothing |
| 4.5 | aria-labels / alt text on slides; focus-ring consistency check | Accessibility polish |

**Checkpoint:** click through landing → setup → editor → preview → export; one continuous dark cinematic theme, no white flash.

---

## Phase 5 — Deployment: VPS + Docker (~2 days)

*Why last: Dockerfiles and TLS only make sense once the app behind them is sound.*

| Step | What | Why |
|---|---|---|
| 5.1 | `backend/Dockerfile` (multi-stage, non-root) + `frontend/Dockerfile` (Next standalone build) | Reproducible images |
| 5.2 | `docker-compose.prod.yml`: strong creds from env, internal network only (no host-bound Postgres/Redis/MinIO), healthchecks, `restart: unless-stopped`, `depends_on: service_healthy` | Fixes default-creds + exposure + startup races |
| 5.3 | nginx: TLS (Let's Encrypt/certbot), security headers (HSTS, CSP, X-Frame-Options), upload body-size limits, long timeouts on AI routes, SSE support for streaming | The audit's full nginx list |
| 5.4 | Minimal CI (GitHub Actions): lint + typecheck + build both apps on every push | Catches breakage before deploy |
| 5.5 | Deploy runbook: server setup, DNS, first deploy, backup command for Postgres | So you can operate it without me |

**Checkpoint:** `docker compose -f docker-compose.prod.yml up` serves the app over HTTPS on the VPS; CI green.

---

## Phase 6 — Beta-readiness verification (~0.5 day)

End-to-end pass as a hostile stranger: try to access another user's deck, hammer generation endpoints, upload junk files, kill workers mid-job. Fix what leaks. Produce a short go/no-go checklist.

---

## Deliberately deferred (post-beta)

Monitoring/alerting (Sentry, uptime), automated test suite, DB backups automation, Google OAuth as a second login option, mobile editor optimization, dark-mode toggle. These matter for public launch, not private beta.

**Total estimate: ~9–11 working days.**
